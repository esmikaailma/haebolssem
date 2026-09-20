
import { generateText } from "ai";

const num=v=>Number(String(v??"").replaceAll(",",""))||0;
const known=c=>c?.status==="amount"?num(c.amount):c?.status==="zero"?0:null;
const unknownLabels=s=>{
  const map=[["managementFee","관리비"],["parkingFee","주차비"],["internet","인터넷"],["otherMonthly","기타 월 주거비"],["brokerageFee","중개보수"],["movingFee","이사비"],["cleaningFee","입주 청소비"],["otherInitial","기타 초기 비용"]];
  return map.filter(([k])=>s.housing?.[k]?.status==="unknown").map(([,label])=>label);
};
const financeKey=f=>JSON.stringify({availableFunds:num(f.availableFunds),monthlyIncome:num(f.monthlyIncome),fixedExpenses:num(f.fixedExpenses),minimumFunds:num(f.minimumFunds)});
const spread=(scenarios,fields)=>{
  return fields.map(([key,label,kind])=>{
    const values=scenarios.map(s=>{
      if(key==="deposit") return num(s.housing.deposit);
      if(key==="monthlyRent") return s.transactionType==="monthlyRent"?num(s.housing.monthlyRent):0;
      const v=known(s.housing[key]); return v===null?null:v;
    });
    const knownValues=values.filter(v=>v!==null);
    if(knownValues.length!==values.length||knownValues.length<2) return null;
    return {label,kind,difference:Math.max(...knownValues)-Math.min(...knownValues)};
  }).filter(Boolean).sort((a,b)=>b.difference-a.difference);
};

export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({error:"Method not allowed"});
  try{
    if(!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN){
      return res.status(503).json({error:"AI Gateway 인증 정보가 Preview 환경에 적용되지 않았어요. AI_GATEWAY_API_KEY 환경변수와 Redeploy 여부를 확인해주세요."});
    }
    const scenarios=req.body?.scenarios||[];
    if(scenarios.length<2||scenarios.length>3) return res.status(400).json({error:"2~3개의 조건이 필요합니다."});
    const financeKeys=scenarios.map(s=>financeKey(s.financeSnapshot||{}));
    if(!financeKeys.every(k=>k===financeKeys[0])) {
      return res.status(409).json({error:"선택한 조건의 계산 기준 재정이 서로 달라요. 같은 재정 기준으로 다시 계산한 뒤 비교해주세요."});
    }
    const f=scenarios[0].financeSnapshot;
    const scenarioFacts=scenarios.map(s=>({
      name:s.name,
      transactionType:s.transactionType,
      initialRequired:s.results.initialKnown,
      initialRequiredIsMinimum:Boolean(s.results.initialUnknown),
      initialBalance:s.results.initialBalance,
      initialBalanceIsMaximum:Boolean(s.results.initialUnknown),
      minimumFundsDifference:s.results.minDiff,
      monthlyHousing:s.results.monthlyKnown,
      monthlyHousingIsMinimum:Boolean(s.results.monthlyUnknown),
      monthlyBalanceAfterHousing:s.results.monthlyBalance,
      monthlyBalanceIsMaximum:Boolean(s.results.monthlyUnknown),
      unknownItems:unknownLabels(s)
    }));
    const drivers=spread(scenarios,[
      ["deposit","보증금","initial"],["brokerageFee","중개보수","initial"],["movingFee","이사비","initial"],["cleaningFee","입주 청소비","initial"],["otherInitial","기타 초기 비용","initial"],
      ["monthlyRent","월세","monthly"],["managementFee","관리비","monthly"],["parkingFee","주차비","monthly"],["internet","인터넷","monthly"],["otherMonthly","기타 월 주거비","monthly"]
    ]);
    const deterministic={
      financeBasis:{availableFunds:num(f.availableFunds),monthlyIncome:num(f.monthlyIncome),fixedExpenses:num(f.fixedExpenses),minimumFunds:num(f.minimumFunds)},
      scenarios:scenarioFacts,
      largestInitialDriver:drivers.find(x=>x.kind==="initial"&&x.difference>0)||null,
      largestMonthlyDriver:drivers.find(x=>x.kind==="monthly"&&x.difference>0)||null
    };
    const prompt=[
      "당신은 사용자가 직접 입력한 주거 조건을 사용자의 동일한 재정 기준에서 해석하는 보조자입니다.",
      "반드시 제공된 deterministicFacts만 사용하세요. 숫자를 새로 계산·추정·변경하지 마세요.",
      "특정 조건을 추천하거나 순위화하거나 최적/최악, 안전/위험, 가능/불가능으로 판정하지 마세요.",
      "minimumFundsDifference가 양수면 최소 보유 자금보다 그만큼 더 남고, 음수면 그만큼 부족하다는 사실만 설명하세요.",
      "monthlyBalanceAfterHousing는 식비·교통비 등 변동 생활비를 제외한 값이므로 생활 가능 금액이라고 표현하지 마세요.",
      "unknownItems가 있으면 해당 비용이 비교에 완전히 반영되지 않았다고 알려주세요.",
      "한국어로 아래 JSON만 반환하세요.",
      '{"basis":"재정 기준을 1문장으로 설명","conditions":[{"name":"조건명","interpretation":"초기 부담과 월 부담을 재정 기준에 연결해 1~2문장"}],"tradeoff":"조건들 사이의 주요 비용 구조 차이를 1~2문장","checkPoints":["확인할 점 최대 2개"]}',
      "deterministicFacts:",
      JSON.stringify(deterministic)
    ].join("\n");
    const result=await generateText({model:"alibaba/qwen3.5-flash",prompt,maxOutputTokens:320});
    const raw=result.text||"";
    const cleaned=raw.replace(/^\`\`\`json\s*/,"").replace(/\`\`\`\s*$/,"").trim();
    let parsed;
    try{parsed=JSON.parse(cleaned)}catch{throw new Error("AI_RESPONSE_PARSE_FAILED")}
    return res.status(200).json(parsed);
  }catch(e){
    console.error("AI_COMPARE_ERROR",e);
    const message=String(e?.message||e||"");
    if(message.includes("AI_RESPONSE_PARSE_FAILED")) return res.status(502).json({error:"AI 응답을 정리하는 과정에서 오류가 발생했어요. 잠시 후 다시 시도해주세요."});
    if(/credit card|customer_verification_required/i.test(message)) return res.status(402).json({error:"AI Gateway 사용을 위해 Vercel에서 결제 카드 인증이 필요해요. 카드를 등록한 뒤 AI Gateway 크레딧 상태를 확인해주세요."});
    if(/insufficient|credit|balance|payment method|billing/i.test(message)) return res.status(402).json({error:"AI Gateway 크레딧 또는 결제 설정을 확인해주세요."});
    if(/403|forbidden|access_denied/i.test(message)) return res.status(403).json({error:"AI Gateway 접근이 거부됐어요. API Key의 팀/프로젝트 범위와 크레딧 활성화 상태를 확인해주세요."});
    return res.status(500).json({error:"AI 비교 기능을 불러오지 못했어요. Vercel Runtime Logs에서 AI_COMPARE_ERROR를 확인해주세요."});
  }
}
