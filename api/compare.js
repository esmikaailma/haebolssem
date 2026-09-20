
const num=v=>Number(String(v??"").replaceAll(",",""))||0;
const known=c=>c?.status==="amount"?num(c.amount):c?.status==="zero"?0:null;
const unknownLabels=s=>{
  const map=[["managementFee","관리비"],["parkingFee","주차비"],["internet","인터넷"],["otherMonthly","기타 월 주거비"],["brokerageFee","중개보수"],["movingFee","이사비"],["cleaningFee","입주 청소비"],["otherInitial","기타 초기 비용"]];
  return map.filter(([k])=>s.housing?.[k]?.status==="unknown").map(([,label])=>label);
};
const financeKey=f=>JSON.stringify({availableFunds:num(f.availableFunds),monthlyIncome:num(f.monthlyIncome),fixedExpenses:num(f.fixedExpenses),minimumFunds:num(f.minimumFunds)});
const spread=(scenarios,fields)=>fields.map(([key,label,kind])=>{
  const values=scenarios.map(s=>{
    if(key==="deposit") return num(s.housing.deposit);
    if(key==="monthlyRent") return s.transactionType==="monthlyRent"?num(s.housing.monthlyRent):0;
    const v=known(s.housing[key]);return v===null?null:v;
  });
  const knownValues=values.filter(v=>v!==null);
  if(knownValues.length!==values.length||knownValues.length<2) return null;
  return {label,kind,difference:Math.max(...knownValues)-Math.min(...knownValues)};
}).filter(Boolean).sort((a,b)=>b.difference-a.difference);

function gatewayError(status,text){
  const msg=String(text||"");
  if(/credit card|customer_verification_required/i.test(msg)) return {status:402,error:"AI Gateway 사용을 위해 Vercel에서 결제 카드 인증이 필요해요."};
  if(/insufficient|credit|balance|payment method|billing/i.test(msg)) return {status:402,error:"AI Gateway 크레딧 또는 결제 설정을 확인해주세요."};
  if(status===401) return {status:401,error:"AI Gateway API Key 인증에 실패했어요. Vercel Environment Variable의 AI_GATEWAY_API_KEY를 확인해주세요."};
  if(status===403) return {status:403,error:"AI Gateway 접근이 거부됐어요. API Key의 팀/프로젝트 범위와 크레딧 활성화 상태를 확인해주세요."};
  if(status===429) return {status:429,error:"AI 요청이 잠시 제한됐어요. 잠시 후 다시 시도해주세요."};
  return {status:502,error:"AI Gateway 호출 중 오류가 발생했어요. 잠시 후 다시 시도해주세요."};
}

export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({error:"Method not allowed"});
  try{
    const apiKey=process.env.AI_GATEWAY_API_KEY;
    if(!apiKey) return res.status(503).json({error:"AI_GATEWAY_API_KEY가 Preview 환경에 적용되지 않았어요. 환경변수 저장 후 Redeploy해주세요."});

    const scenarios=req.body?.scenarios||[];
    if(scenarios.length<2||scenarios.length>3) return res.status(400).json({error:"2~3개의 조건이 필요합니다."});

    const financeKeys=scenarios.map(s=>financeKey(s.financeSnapshot||{}));
    if(!financeKeys.every(k=>k===financeKeys[0])){
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
      "monthlyBalanceAfterHousing는 '생활비 사용 가능 금액'으로 표현하세요. 월 소득에서 월 고정지출과 확인된 월 주거비를 뺀 금액이며 식비·교통비·저축 등 실제 지출 전 금액입니다.",
      "조건별 interpretation은 숫자를 반복 나열하지 말고 해당 조건의 초기 자금 상태와 월 부담을 연결해 한 문장으로만 설명하세요.",
      "monthlyComparison은 조건별 생활비 사용 가능 금액의 차이를 가장 이해하기 쉽게 한 문장으로 비교하세요. 추천·순위 표현은 금지합니다.",
      "unknownItems나 monthlyBalanceAfterHousing 같은 내부 필드명은 절대 출력하지 마세요.",
      "한국어로 아래 JSON만 반환하세요.",
      '{"conditions":[{"name":"조건명","interpretation":"조건별 해석 1문장"}],"monthlyComparison":"생활비 사용 가능 금액 비교 1문장"}',
      "deterministicFacts:",
      JSON.stringify(deterministic)
    ].join("\n");

    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),12000);
    let gatewayResponse;
    try{
      gatewayResponse=await fetch("https://ai-gateway.vercel.sh/v1/chat/completions",{
        method:"POST",
        headers:{
          "Authorization":"Bearer "+apiKey,
          "Content-Type":"application/json"
        },
        body:JSON.stringify({
          model:"alibaba/qwen3.5-flash",
          messages:[{role:"user",content:prompt}],
          max_tokens:220,
          temperature:0.1,
          reasoning:{effort:"none"}
        }),
        signal:controller.signal
      });
    }finally{
      clearTimeout(timeout);
    }

    const gatewayText=await gatewayResponse.text();
    if(!gatewayResponse.ok){
      console.error("AI_GATEWAY_HTTP_ERROR",gatewayResponse.status,gatewayText.slice(0,1000));
      const mapped=gatewayError(gatewayResponse.status,gatewayText);
      return res.status(mapped.status).json({error:mapped.error});
    }

    let gatewayJson;
    try{gatewayJson=JSON.parse(gatewayText)}catch{
      console.error("AI_GATEWAY_NON_JSON",gatewayText.slice(0,1000));
      return res.status(502).json({error:"AI Gateway 응답 형식을 읽지 못했어요. 잠시 후 다시 시도해주세요."});
    }

    const raw=gatewayJson?.choices?.[0]?.message?.content||"";
    const cleaned=String(raw).replace(/^\`\`\`json\s*/,"").replace(/\`\`\`\s*$/,"").trim();
    let parsed;
    try{parsed=JSON.parse(cleaned)}catch{
      console.error("AI_RESPONSE_PARSE_FAILED",cleaned.slice(0,1000));
      return res.status(502).json({error:"AI 응답을 정리하는 과정에서 오류가 발생했어요. 잠시 후 다시 시도해주세요."});
    }
    return res.status(200).json(parsed);
  }catch(e){
    console.error("AI_COMPARE_ERROR",e);
    if(e?.name==="AbortError") return res.status(504).json({error:"AI 응답 시간이 길어 요청이 종료됐어요. 다시 시도해주세요."});
    return res.status(500).json({error:"AI 비교 기능 실행 중 오류가 발생했어요. 잠시 후 다시 시도해주세요."});
  }
}
