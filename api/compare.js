
import { generateText } from "ai";

export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({error:"Method not allowed"});
  try{
    const scenarios=req.body?.scenarios||[];
    if(scenarios.length<2||scenarios.length>3) return res.status(400).json({error:"2~3개의 조건이 필요합니다."});
    const compact=scenarios.map(s=>({
      name:s.name,transactionType:s.transactionType,finance:s.financeSnapshot,results:s.results,
      costs:{
        deposit:s.housing.deposit,monthlyRent:s.housing.monthlyRent,managementFee:s.housing.managementFee,
        parkingFee:s.housing.parkingFee,internet:s.housing.internet,otherMonthly:s.housing.otherMonthly,
        brokerageFee:s.housing.brokerageFee,movingFee:s.housing.movingFee,cleaningFee:s.housing.cleaningFee,
        otherInitial:s.housing.otherInitial
      }
    }));
    const prompt=[
      "당신은 주거 비용 비교 결과를 짧고 정확하게 구조화하는 분석 보조자입니다.",
      "반드시 주어진 JSON 데이터만 사용하세요.",
      "새 숫자를 계산하거나 추정하지 마세요.",
      "특정 조건을 추천하거나 순위화하거나 안전/위험·가능/불가능을 판정하지 마세요.",
      "unknown 항목은 0원으로 취급하지 마세요.",
      "한국어로 아래 JSON 형태만 반환하세요.",
      '{"keyDifferences":"핵심 차이 1~2문장","costStructure":"초기 부담과 월 부담의 trade-off 1~2문장","mainVariables":"차이를 만든 주요 비용 항목 1~2문장"}',
      "데이터:",JSON.stringify(compact)
    ].join("\n");
    const result=await generateText({
      model:"google/gemma-4-26b-a4b-it",
      prompt
    });
    const raw=result.text||"";
    const cleaned=raw.replace(/^\`\`\`json\s*/,"").replace(/\`\`\`\s*$/,"").trim();
    let parsed;
    try{parsed=JSON.parse(cleaned)}catch{parsed={summary:cleaned||"AI 해석 결과를 읽지 못했습니다."}}
    return res.status(200).json(parsed);
  }catch(e){
    return res.status(500).json({error:"AI 해석 중 오류가 발생했습니다. Vercel AI Gateway/OIDC 설정을 확인해주세요."});
  }
}
