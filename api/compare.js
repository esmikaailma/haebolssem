
export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({error:"Method not allowed"});
  if(!process.env.OPENAI_API_KEY) return res.status(503).json({error:"AI 기능 설정이 아직 완료되지 않았습니다."});
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
    const instruction=[
      "당신은 주거비 비교 결과를 짧고 정확하게 구조화하는 분석 보조자입니다.",
      "주어진 JSON 데이터만 사용하세요.",
      "숫자를 새로 만들거나 계산하지 말고, 특정 조건을 추천·순위화·안전/위험 판정하지 마세요.",
      "unknown 항목은 0원으로 취급하지 마세요.",
      "한국어로 아래 JSON 형태만 반환하세요.",
      '{"keyDifferences":"핵심 숫자 차이 1~2문장","costStructure":"초기 부담과 월 부담의 trade-off 1~2문장","mainVariables":"차이를 만든 주요 비용 항목 1~2문장"}',
      "데이터:",
      JSON.stringify(compact)
    ].join("\n");
    const r=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":"Bearer "+process.env.OPENAI_API_KEY},
      body:JSON.stringify({model:process.env.OPENAI_MODEL||"gpt-5.6-luna",input:instruction,max_output_tokens:450})
    });
    const data=await r.json();
    if(!r.ok) throw new Error(data?.error?.message||"OpenAI API error");
    const raw=data.output_text||data.output?.flatMap(x=>x.content||[]).map(x=>x.text||"").join("")||"";
    const cleaned=raw.replace(/^\`\`\`json\s*/,"").replace(/\`\`\`\s*$/,"").trim();
    let parsed; try{parsed=JSON.parse(cleaned)}catch{parsed={summary:cleaned||"AI 해석 결과를 읽지 못했습니다."}}
    return res.status(200).json(parsed);
  }catch(e){
    return res.status(500).json({error:"AI 해석 중 오류가 발생했습니다."});
  }
}
