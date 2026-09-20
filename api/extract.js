
import { generateText } from "ai";

export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({error:"Method not allowed"});
  const text=String(req.body?.text||"").trim();
  if(!text) return res.status(400).json({error:"매물 정보를 입력해주세요."});
  if(text.length>5000) return res.status(400).json({error:"매물 정보는 5,000자 이내로 입력해주세요."});
  try{
    const prompt=[
      "당신은 한국 주거 매물 설명에서 비용 정보를 구조화하는 추출기입니다.",
      "사용자가 제공한 텍스트에 명시된 내용만 추출하세요. 절대 추정하거나 보완하지 마세요.",
      "금액은 모두 원 단위 정수로 변환하세요. 예: 1000만원 -> 10000000.",
      "언급되지 않은 항목은 null로 두세요.",
      "비용이 없거나 포함이라고 명시된 경우 status는 zero, 금액이 명시되면 amount, 금액을 모른다고 명시된 경우 unknown, 언급이 없으면 unset으로 두세요.",
      "transactionType은 monthlyRent 또는 jeonse 또는 null입니다.",
      "name은 텍스트에 매물 이름/지역/건물명이 명확히 있으면 짧게 추출하고 아니면 null입니다.",
      "다음 JSON만 반환하세요.",
      '{"name":null,"transactionType":null,"deposit":null,"monthlyRent":null,"managementFee":{"status":"unset","amount":null},"parkingFee":{"status":"unset","amount":null},"internet":{"status":"unset","amount":null},"otherMonthly":{"status":"unset","amount":null},"brokerageFee":{"status":"unset","amount":null},"movingFee":{"status":"unset","amount":null},"cleaningFee":{"status":"unset","amount":null},"otherInitial":{"status":"unset","amount":null}}',
      "매물 정보:",text
    ].join("\n");
    const result=await generateText({model:"google/gemma-4-26b-a4b-it",prompt});
    const raw=result.text||"";
    const cleaned=raw.replace(/^\`\`\`json\s*/,"").replace(/\`\`\`\s*$/,"").trim();
    let parsed;
    try{parsed=JSON.parse(cleaned)}catch{return res.status(502).json({error:"AI가 입력 정보를 구조화하지 못했습니다. 다시 시도해주세요."})}
    return res.status(200).json(parsed);
  }catch(e){
    return res.status(500).json({error:"AI 입력 도우미를 사용할 수 없습니다. Vercel AI Gateway/OIDC 설정을 확인해주세요."});
  }
}
