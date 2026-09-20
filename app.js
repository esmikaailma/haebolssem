
import {OPTIONAL_MONTHLY,OPTIONAL_INITIAL,newHousing,money,num,sanitize,formatInput,escapeHtml,calculate,costDisplay} from "./lib.js";

const $=s=>document.querySelector(s);
const KEY={finance:"haebolssem_finance_v2",calculations:"haebolssem_calculations_v2",ai:"haebolssem_ai_v3"};
const load=k=>{try{return JSON.parse(localStorage.getItem(k))}catch{return null}};
const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const list=()=>load(KEY.calculations)||[];
const saveList=v=>save(KEY.calculations,v);
const normalizeConditionName=v=>String(v??"").normalize("NFKC").trim().replace(/\s+/g," ").toLocaleLowerCase("ko-KR");
const isDuplicateConditionName=name=>{
  const normalized=normalizeConditionName(name);
  return normalized!==""&&list().some(x=>x.id!==state.editingId&&normalizeConditionName(x.name)===normalized);
};

let state={
  view:"home",
  finance:load(KEY.finance)||{availableFunds:"",monthlyIncome:"",fixedExpenses:"",minimumFunds:""},
  housing:newHousing(),editingId:null,lastResult:null,selected:[],aiResult:null,isDirty:false,selectedMinPct:null
};

function row(label,val){return '<div class="row"><span>'+label+'</span><strong>'+val+'</strong></div>'}
function signedMoney(v){return v>0?"+"+money(v):v<0?"-"+money(Math.abs(v)):money(0)}
function diffStatusClass(v){return v>0?"status-positive":v<0?"status-negative":"status-neutral"}
function diffStatusNote(v){return v>0?"설정한 최소 보유 자금보다 더 남습니다.":v<0?"설정한 최소 보유 자금보다 부족합니다.":"설정한 최소 보유 자금과 같습니다."}
function shell(body){return '<main class="app-shell"><div class="topbar"><button class="link-btn brand" data-go="home">해볼셈</button><button class="link-btn" data-go="saved">저장 내역</button></div>'+body+'</main>'}
function metric(label,val,note){return '<div class="metric"><div class="label">'+label+'</div><div class="value">'+val+'</div>'+(note?'<div class="note">'+note+'</div>':'')+'</div>'}
function unknownLabels(h,keys){return keys.filter(([k])=>h[k]?.status==="unknown").map(([,label])=>label)}
function knownFormulaParts(h,keys){return keys.map(([k,label])=>[label,costDisplay(h[k])])}
function calcLine(label,formula,result,note=""){return '<div class="calc-line"><div class="calc-line-title">'+label+'</div><div class="calc-formula">'+formula+'</div><strong>'+result+'</strong>'+(note?'<div class="helper">'+note+'</div>':'')+'</div>'}
function exportConditionImage(item){
  const r=item.results;
  const unknown=[...unknownLabels(item.housing,OPTIONAL_INITIAL),...unknownLabels(item.housing,OPTIONAL_MONTHLY)];
  const canvas=document.createElement("canvas");
  canvas.width=1080;canvas.height=2200;
  const ctx=canvas.getContext("2d");
  const left=104,right=976;
  ctx.fillStyle="#f8fafc";ctx.fillRect(0,0,1080,2200);
  ctx.fillStyle="#ffffff";ctx.fillRect(54,54,972,2092);
  const dash=y=>{ctx.strokeStyle="#cbd5e1";ctx.setLineDash([10,10]);ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();ctx.setLineDash([])};
  const wrapText=(text,x,y,maxWidth,lineHeight)=>{
    const words=String(text).split(" ");let line="";let cursor=y;
    words.forEach(word=>{const test=line?line+" "+word:word;if(ctx.measureText(test).width>maxWidth&&line){ctx.fillText(line,x,cursor);line=word;cursor+=lineHeight}else line=test});
    if(line)ctx.fillText(line,x,cursor);return cursor;
  };
  let y=118;
  const sectionTitle=title=>{ctx.fillStyle="#111827";ctx.font="800 27px Pretendard, sans-serif";ctx.textAlign="left";ctx.fillText(title,left,y);y+=48};
  const smallRow=(label,value,color="#111827")=>{
    ctx.fillStyle="#6b7280";ctx.font="500 22px Pretendard, sans-serif";ctx.textAlign="left";ctx.fillText(label,left,y);
    ctx.fillStyle=color;ctx.font="700 22px Pretendard, sans-serif";ctx.textAlign="right";ctx.fillText(value,right,y);ctx.textAlign="left";y+=43;
  };
  const totalRow=(label,value,color="#111827")=>{
    y+=5;ctx.strokeStyle="#e5e7eb";ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();y+=43;
    ctx.fillStyle="#374151";ctx.font="700 23px Pretendard, sans-serif";ctx.textAlign="left";ctx.fillText(label,left,y);
    ctx.fillStyle=color;ctx.font="800 30px Pretendard, sans-serif";ctx.textAlign="right";ctx.fillText(value,right,y);ctx.textAlign="left";y+=50;
  };

  ctx.fillStyle="#2563eb";ctx.font="800 30px Pretendard, sans-serif";ctx.fillText("해볼셈",left,y);y+=72;
  ctx.fillStyle="#111827";ctx.font="800 48px Pretendard, sans-serif";ctx.fillText(item.name||"주거 조건",left,y);y+=44;
  ctx.fillStyle="#6b7280";ctx.font="500 25px Pretendard, sans-serif";ctx.fillText((item.transactionType==="monthlyRent"?"월세":"전세")+" · 독립 비용 계산 결과",left,y);y+=52;
  dash(y);y+=52;

  sectionTitle("재정 기준");
  smallRow("가용 자금",money(num(item.financeSnapshot.availableFunds)));
  smallRow("월 소득",money(num(item.financeSnapshot.monthlyIncome)));
  smallRow("월 고정지출",money(num(item.financeSnapshot.fixedExpenses)));
  smallRow("최소 보유 자금",money(num(item.financeSnapshot.minimumFunds)));
  y+=16;dash(y);y+=52;

  sectionTitle("초기 비용 계산");
  smallRow("보증금",money(num(item.housing.deposit)));
  OPTIONAL_INITIAL.forEach(([k,label])=>smallRow(label,costDisplay(item.housing[k])));
  totalRow("초기 필요 자금",(r.initialUnknown?"최소 ":"")+money(r.initialKnown));
  smallRow("가용 자금 - 초기 필요 자금",(r.initialUnknown?"최대 ":"")+money(r.initialBalance));
  smallRow("최소 보유 자금 대비",signedMoney(r.minDiff),r.minDiff>0?"#047857":r.minDiff<0?"#b91c1c":"#111827");
  y+=16;dash(y);y+=52;

  sectionTitle("월 주거비 계산");
  if(item.transactionType==="monthlyRent") smallRow("월세",money(num(item.housing.monthlyRent)));
  OPTIONAL_MONTHLY.forEach(([k,label])=>smallRow(label,costDisplay(item.housing[k])));
  totalRow("월 주거비",(r.monthlyUnknown?"최소 ":"")+money(r.monthlyKnown));
  smallRow("월 소득 - 월 고정지출 - 월 주거비",(r.monthlyUnknown?"최대 ":"")+money(r.monthlyBalance));
  y+=16;

  if(unknown.length){
    dash(y);y+=52;sectionTitle("미확인 비용");
    ctx.fillStyle="#9a3412";ctx.font="600 21px Pretendard, sans-serif";
    unknown.forEach(label=>{ctx.fillText("• "+label,left,y);y+=34});
    ctx.fillStyle="#7c2d12";ctx.font="500 19px Pretendard, sans-serif";
    y=wrapText("미확인 비용은 0원으로 처리하지 않고 합계에서 제외했어요. 비용 합계는 최소값, 잔액은 최대값으로 표시됩니다.",left,y+8,right-left,29)+35;
  }

  dash(Math.min(y+16,2040));
  ctx.fillStyle="#6b7280";ctx.font="500 19px Pretendard, sans-serif";
  wrapText("주거비 반영 후 잔액에는 식비·교통비 등 변동 생활비가 포함되지 않습니다.",left,2070,right-left,28);
  ctx.fillStyle="#94a3b8";ctx.font="500 18px Pretendard, sans-serif";ctx.fillText("해볼셈 · 계산 결과",left,2130);

  const a=document.createElement("a");a.download=(item.name||"해볼셈")+"-계산결과.png";a.href=canvas.toDataURL("image/png");a.click();
}

function exportAIComparisonImage(chosen,aiResult){
  if(!chosen.length||!aiResult||aiResult.error)return;
  const canvas=document.createElement("canvas");
  canvas.width=1080;canvas.height=2100;
  const ctx=canvas.getContext("2d");
  const left=104,right=976,maxWidth=right-left;
  ctx.fillStyle="#f8fafc";ctx.fillRect(0,0,1080,2100);
  ctx.fillStyle="#ffffff";ctx.fillRect(54,54,972,1992);
  const wrap=(text,x,y,width,lineHeight)=>{
    const words=String(text||"").split(" ");let line="",cursor=y;
    words.forEach(word=>{const t=line?line+" "+word:word;if(ctx.measureText(t).width>width&&line){ctx.fillText(line,x,cursor);line=word;cursor+=lineHeight}else line=t});
    if(line)ctx.fillText(line,x,cursor);return cursor;
  };
  const dash=y=>{ctx.strokeStyle="#cbd5e1";ctx.setLineDash([10,10]);ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();ctx.setLineDash([])};
  let y=118;
  ctx.fillStyle="#2563eb";ctx.font="800 30px Pretendard, sans-serif";ctx.fillText("해볼셈",left,y);y+=70;
  ctx.fillStyle="#111827";ctx.font="800 46px Pretendard, sans-serif";ctx.fillText("AI 내 재정 기준 비교",left,y);y+=50;
  ctx.fillStyle="#6b7280";ctx.font="500 22px Pretendard, sans-serif";ctx.fillText("저장한 주거 조건의 월 부담과 생활비 사용 가능 금액을 비교한 결과",left,y);y+=48;
  dash(y);y+=48;

  const f=chosen[0].financeSnapshot;
  ctx.fillStyle="#111827";ctx.font="800 26px Pretendard, sans-serif";ctx.fillText("재정 기준",left,y);y+=44;
  const basis=[["가용 자금",f.availableFunds],["월 소득",f.monthlyIncome],["월 고정지출",f.fixedExpenses],["최소 보유 자금",f.minimumFunds]];
  basis.forEach(([label,value])=>{
    ctx.fillStyle="#6b7280";ctx.font="500 20px Pretendard, sans-serif";ctx.textAlign="left";ctx.fillText(label,left,y);
    ctx.fillStyle="#111827";ctx.font="700 20px Pretendard, sans-serif";ctx.textAlign="right";ctx.fillText(money(num(value)),right,y);ctx.textAlign="left";y+=37;
  });
  y+=16;dash(y);y+=48;

  chosen.forEach(item=>{
    const r=item.results;
    const interpretation=(aiResult.conditions||[]).find(c=>normalizeConditionName(c.name)===normalizeConditionName(item.name))?.interpretation||"";
    ctx.fillStyle="#111827";ctx.font="800 28px Pretendard, sans-serif";ctx.fillText(item.name,left,y);y+=38;
    ctx.fillStyle="#6b7280";ctx.font="500 19px Pretendard, sans-serif";ctx.fillText(item.transactionType==="monthlyRent"?"월세":"전세",left,y);y+=40;
    ctx.fillStyle="#6b7280";ctx.font="500 20px Pretendard, sans-serif";ctx.fillText("생활비 사용 가능 금액",left,y);
    ctx.fillStyle=r.monthlyBalance>0?"#047857":r.monthlyBalance<0?"#b91c1c":"#111827";ctx.font="800 29px Pretendard, sans-serif";ctx.textAlign="right";ctx.fillText((r.monthlyUnknown?"최대 ":"")+money(r.monthlyBalance),right,y);ctx.textAlign="left";y+=42;
    ctx.fillStyle="#6b7280";ctx.font="500 20px Pretendard, sans-serif";ctx.fillText("월 주거비",left,y);
    ctx.fillStyle="#111827";ctx.font="700 21px Pretendard, sans-serif";ctx.textAlign="right";ctx.fillText((r.monthlyUnknown?"최소 ":"")+money(r.monthlyKnown),right,y);ctx.textAlign="left";y+=38;
    ctx.fillStyle="#6b7280";ctx.font="500 20px Pretendard, sans-serif";ctx.fillText("최소 보유 자금 대비",left,y);
    ctx.fillStyle=r.minDiff>0?"#047857":r.minDiff<0?"#b91c1c":"#111827";ctx.font="700 21px Pretendard, sans-serif";ctx.textAlign="right";ctx.fillText(signedMoney(r.minDiff),right,y);ctx.textAlign="left";y+=42;
    if(interpretation){
      ctx.fillStyle="#374151";ctx.font="500 19px Pretendard, sans-serif";
      y=wrap(interpretation,left,y,maxWidth,28)+32;
    }
    dash(y);y+=42;
  });

  if(aiResult.monthlyComparison){
    ctx.fillStyle="#111827";ctx.font="800 25px Pretendard, sans-serif";ctx.fillText("생활비 사용 가능 금액 비교",left,y);y+=38;
    ctx.fillStyle="#374151";ctx.font="500 20px Pretendard, sans-serif";
    y=wrap(aiResult.monthlyComparison,left,y,maxWidth,30)+40;
  }

  const checks=[];
  chosen.forEach(item=>{
    const names=[...unknownLabels(item.housing,OPTIONAL_INITIAL),...unknownLabels(item.housing,OPTIONAL_MONTHLY)];
    if(names.length)checks.push(item.name+": "+names.join(", ")+" 미확인");
  });
  if(checks.length){
    dash(y);y+=44;
    ctx.fillStyle="#111827";ctx.font="800 25px Pretendard, sans-serif";ctx.fillText("확인할 점",left,y);y+=38;
    ctx.fillStyle="#9a3412";ctx.font="500 19px Pretendard, sans-serif";
    checks.forEach(t=>{y=wrap("• "+t,left,y,maxWidth,28)+38});
  }

  ctx.fillStyle="#6b7280";ctx.font="500 18px Pretendard, sans-serif";
  wrap("생활비 사용 가능 금액은 월 소득에서 월 고정지출과 확인된 월 주거비를 뺀 금액입니다. 식비·교통비·저축 등 실제 지출 전 기준입니다.",left,1990,maxWidth,27);
  ctx.fillStyle="#94a3b8";ctx.font="500 18px Pretendard, sans-serif";ctx.fillText("해볼셈 · AI 내 재정 기준 비교",left,2070);
  const a=document.createElement("a");a.download="해볼셈-AI비교결과.png";a.href=canvas.toDataURL("image/png");a.click();
}

function field(k,label,helper){
  return '<div class="field"><label>'+label+'</label><div class="input-wrap"><input inputmode="numeric" data-finance="'+k+'" value="'+formatInput(state.finance[k])+'" placeholder="0"><span>원</span></div><div class="helper">'+helper+'</div><div class="error" data-error="'+k+'"></div></div>'
}
function costControl(k,label,helper){
  const c=state.housing[k];
  return '<div class="cost-item"><div><label>'+label+'</label>'+(helper?'<div class="helper">'+helper+'</div>':'')+'</div><div class="cost-controls">'+
  '<button type="button" data-cost="'+k+':amount" class="'+(c.status==="amount"?"active":"")+'">금액 입력</button>'+
  '<button type="button" data-cost="'+k+':zero" class="'+(c.status==="zero"?"active":"")+'">0원</button>'+
  '<button type="button" data-cost="'+k+':unknown" class="'+(c.status==="unknown"?"active":"")+'">모름</button></div>'+
  (c.status==="amount"?'<div class="input-wrap"><input inputmode="numeric" data-cost-amount="'+k+'" value="'+formatInput(c.amount||"")+'" placeholder="0"><span>원</span></div>':'')+'</div>'
}
function home(){
  return '<section class="hero"><div class="eyebrow">독립 주거 비용 계산기</div><h1>독립, 해볼 셈이라면?</h1><p class="muted">독립할 때 필요한 초기 비용과 매달 부담할 주거비를 계산하고 비교해보세요.</p><div class="actions"><button class="btn primary" data-start>계산 시작하기</button><button class="btn secondary" data-go="saved">저장 내역 보기</button></div></section>'
}
function finance(){
  return '<div class="step">1 / 2</div><h2>독립 비용 계산의 기준</h2><p class="muted">내 재정에서 독립 비용을 계산할 기준을 먼저 입력하세요.</p><section class="section stack">'+
  field("availableFunds","가용 자금","독립을 위해 실제로 사용할 수 있는 현금성 자금을 입력하세요.")+
  field("monthlyIncome","월 소득","수입이 일정하지 않다면 최근 1년간 평균 월 소득을 입력하세요.")+
  field("fixedExpenses","월 고정지출","독립 후에도 계속 발생하는 대출 상환·보험료·통신비·정기 구독료 등을 합산해 입력하세요.")+
  '<div class="field reserve-field"><label>최소 보유 자금</label><div class="helper">독립 비용을 지출한 뒤에도 최소한 남겨두고 싶은 자금을 입력하세요.</div>'+
    '<div class="quick-set-buttons"><button type="button" data-min-pct="25" class="'+(state.selectedMinPct===25?"active":"")+'">25% 남기기</button><button type="button" data-min-pct="50" class="'+(state.selectedMinPct===50?"active":"")+'">50% 남기기</button><button type="button" data-min-pct="75" class="'+(state.selectedMinPct===75?"active":"")+'">75% 남기기</button></div>'+
    '<div class="input-wrap"><input inputmode="numeric" data-finance="minimumFunds" value="'+formatInput(state.finance.minimumFunds)+'" placeholder="0"><span>원</span></div>'+
    '<div class="error" data-error="minimumFunds"></div></div>'+
  '</section><div class="actions"><button class="btn primary" data-next-finance>다음</button><button class="btn ghost" data-go="home">취소</button></div>'
}
function housing(){
  const monthly=state.housing.transactionType==="monthlyRent";
  return '<div class="step">2 / 2</div><h2>주거 조건 및 초기 비용</h2><p class="muted">실제 매물이든 가정한 조건이든 같은 방식으로 계산할 수 있어요.</p>'+
  '<section class="section stack"><div class="field"><label>거래 유형</label><div class="segment"><button data-type="monthlyRent" class="'+(monthly?"active":"")+'">월세</button><button data-type="jeonse" class="'+(!monthly?"active":"")+'">전세</button></div></div>'+
  '<div class="field"><label>이름</label><input data-housing="name" value="'+escapeHtml(state.housing.name)+'" placeholder="예: 망원동 A 원룸"><div class="error" data-error="name"></div></div>'+
  '<div class="field"><label>보증금</label><div class="input-wrap"><input inputmode="numeric" data-housing="deposit" value="'+formatInput(state.housing.deposit)+'" placeholder="0"><span>원</span></div><div class="error" data-error="deposit"></div></div>'+
  (monthly?'<div class="field"><label>월세</label><div class="input-wrap"><input inputmode="numeric" data-housing="monthlyRent" value="'+formatInput(state.housing.monthlyRent)+'" placeholder="0"><span>원</span></div><div class="error" data-error="monthlyRent"></div></div>':'')+
  '</section><section class="section"><h3>월 주거비</h3>'+
  costControl("managementFee","관리비","관리비가 없다면 0원, 아직 확인하지 못했다면 모름을 선택하세요.")+
  costControl("parkingFee","주차비","매달 별도로 발생하는 주차 비용입니다.")+
  costControl("internet","인터넷","관리비 등에 포함되어 별도 비용이 없다면 0원을 선택하세요.")+
  costControl("otherMonthly","기타 월 주거비","관리비·주차비·인터넷 외 매달 반복되는 주거 관련 비용입니다.")+
  '</section><section class="section"><h3>초기 비용</h3>'+
  costControl("brokerageFee","중개보수","자동 계산하지 않고 확인하거나 예상한 금액을 직접 입력합니다.")+
  costControl("movingFee","이사비","")+
  costControl("cleaningFee","입주 청소비","")+
  costControl("otherInitial","기타 초기 비용","가구·가전·생활용품·설치비 등 추가 입주 준비 비용을 포함하세요.")+
  '</section><div class="actions"><button class="btn primary" data-calc>계산하기</button><button class="btn secondary" data-go="finance">재정 기준 수정</button></div>'
}
function result(){
  const r=state.lastResult||calculate(state.finance,state.housing);
  const exists=state.editingId&&list().some(x=>x.id===state.editingId);
  const saved=exists&&!state.isDirty;
  const saveLabel=saved?"저장 완료":(exists?"변경 저장":"저장하기");
  const initialUnknownNames=unknownLabels(state.housing,OPTIONAL_INITIAL);
  const monthlyUnknownNames=unknownLabels(state.housing,OPTIONAL_MONTHLY);
  const allUnknown=[...initialUnknownNames,...monthlyUnknownNames];
  const detailCard=(label,value,note,content,klass="")=>'<details class="result-detail-card '+klass+'"><summary><div><div class="label">'+label+'</div><div class="value">'+value+'</div>'+(note?'<div class="note">'+note+'</div>':'')+'</div><span class="detail-toggle">계산 내역</span></summary><div class="result-detail-body">'+content+'</div></details>';
  const savedCount=list().length;
  let body='<h2>'+escapeHtml(state.housing.name)+'</h2><p class="muted">'+(state.housing.transactionType==="monthlyRent"?"월세":"전세")+' 조건 계산 결과</p>'+
  '<section class="finance-summary"><div class="finance-summary-title">재정 기준</div><div class="finance-summary-grid">'+
    '<div><span>가용 자금</span><strong>'+money(num(state.finance.availableFunds))+'</strong></div>'+
    '<div><span>월 소득</span><strong>'+money(num(state.finance.monthlyIncome))+'</strong></div>'+
    '<div><span>월 고정지출</span><strong>'+money(num(state.finance.fixedExpenses))+'</strong></div>'+
    '<div><span>최소 보유 자금</span><strong>'+money(num(state.finance.minimumFunds))+'</strong></div>'+
  '</div></section>';
  if(allUnknown.length) body+='<div class="notice"><strong>미확인 비용: '+allUnknown.map(escapeHtml).join(", ")+'</strong><br>해당 비용은 0원으로 처리하지 않고 합계에서 제외했습니다. 비용은 최소값, 잔액은 최대값으로 표시됩니다.</div>';
  const initialBreakdown=row("보증금",money(num(state.housing.deposit)))+OPTIONAL_INITIAL.map(([k,l])=>row(l,costDisplay(state.housing[k]))).join("")+
    row("확인된 비용 합계",(r.initialUnknown?"최소 ":"")+money(r.initialKnown))+
    (initialUnknownNames.length?'<div class="helper detail-note">미확인 항목('+initialUnknownNames.join(", ")+')은 합계에서 제외했습니다.</div>':'');
  const balanceBreakdown=calcLine("계산식","가용 자금 "+money(num(state.finance.availableFunds))+" - 초기 필요 자금 "+(r.initialUnknown?"최소 ":"")+money(r.initialKnown),(r.initialUnknown?"최대 ":"")+money(r.initialBalance));
  const minBreakdown=calcLine("계산식","초기 비용 후 잔액 - 최소 보유 자금 "+money(num(state.finance.minimumFunds)),signedMoney(r.minDiff),diffStatusNote(r.minDiff));
  const monthlyBreakdown=(state.housing.transactionType==="monthlyRent"?row("월세",money(num(state.housing.monthlyRent))):"")+OPTIONAL_MONTHLY.map(([k,l])=>row(l,costDisplay(state.housing[k]))).join("")+
    row("확인된 월 주거비 합계",(r.monthlyUnknown?"최소 ":"")+money(r.monthlyKnown))+
    (monthlyUnknownNames.length?'<div class="helper detail-note">미확인 항목('+monthlyUnknownNames.join(", ")+')은 합계에서 제외했습니다.</div>':'');
  const monthlyBalanceBreakdown=calcLine("계산식","월 소득 "+money(num(state.finance.monthlyIncome))+" - 월 고정지출 "+money(num(state.finance.fixedExpenses))+" - 월 주거비 "+(r.monthlyUnknown?"최소 ":"")+money(r.monthlyKnown),(r.monthlyUnknown?"최대 ":"")+money(r.monthlyBalance),"식비·교통비 등 변동 생활비는 포함하지 않습니다.");
  body+='<section class="section result-details-grid">'+
    detailCard("초기 필요 자금",(r.initialUnknown?"최소 ":"")+money(r.initialKnown),initialUnknownNames.length?"미확인: "+initialUnknownNames.join(", "):"",initialBreakdown)+
    detailCard("초기 비용 후 잔액",(r.initialUnknown?"최대 ":"")+money(r.initialBalance),r.initialUnknown?"미확인 비용 반영 시 실제 잔액은 더 적어질 수 있어요.":"",balanceBreakdown)+
    detailCard("최소 보유 자금 대비",'<span class="'+diffStatusClass(r.minDiff)+'">'+signedMoney(r.minDiff)+'</span>',diffStatusNote(r.minDiff),minBreakdown,"reserve-card")+
    detailCard("월 주거비",(r.monthlyUnknown?"최소 ":"")+money(r.monthlyKnown),monthlyUnknownNames.length?"미확인: "+monthlyUnknownNames.join(", "):"",monthlyBreakdown)+
    detailCard("주거비 반영 후 잔액",(r.monthlyUnknown?"최대 ":"")+money(r.monthlyBalance),"식비·교통비 등 변동 생활비는 포함되지 않았어요.",monthlyBalanceBreakdown)+
  '</section>';
  if(saved){
    body+='<div class="saved-status">✓ 저장됨</div><div class="actions">'+
      (savedCount>=2?'<button class="btn primary" data-go-compare>저장한 조건 비교하기</button>':'<button class="btn primary" data-new>다른 조건 추가해 비교하기</button>')+
      '<button class="btn secondary" data-export-current>결과 이미지로 저장</button><button class="btn secondary" data-edit-housing>주거 조건 수정</button><button class="btn secondary" data-go="finance">재정 기준 수정</button>'+(savedCount>=2?'<button class="btn ghost" data-new>다른 조건 계산</button>':'')+'</div>';
  }else{
    body+='<div class="compare-hint">이 결과를 저장하면 다른 주거 조건과 비교할 수 있어요.</div><div class="actions"><button class="btn primary" data-save>'+saveLabel+'</button><button class="btn secondary" data-export-current>결과 이미지로 저장</button><button class="btn secondary" data-edit-housing>주거 조건 수정</button><button class="btn secondary" data-go="finance">재정 기준 수정</button><button class="btn ghost" data-new>다른 조건 계산</button></div>';
  }
  return body
}
function saved(){
  const items=list();
  if(!items.length) return '<h2>저장 내역</h2><div class="empty">아직 저장된 계산이 없습니다.<div class="actions"><button class="btn primary" data-start>계산 시작하기</button></div></div>';
  return '<h2>저장 내역</h2><p class="muted">비교할 조건을 2~3개 선택하세요.</p><div class="stack">'+items.map(x=>{
    const r=x.results;
    return '<div class="card saved-card"><div class="saved-head"><div><h3>'+escapeHtml(x.name)+'</h3><div class="muted">'+(x.transactionType==="monthlyRent"?"월세":"전세")+'</div></div><input class="check" type="checkbox" data-select="'+x.id+'" '+(state.selected.includes(x.id)?"checked":"")+'></div>'+
    row("초기 필요 자금",(r.initialUnknown?"최소 ":"")+money(r.initialKnown))+row("초기 비용 후 잔액",(r.initialUnknown?"최대 ":"")+money(r.initialBalance))+row("월 주거비",(r.monthlyUnknown?"최소 ":"")+money(r.monthlyKnown))+row("주거비 반영 후 잔액",(r.monthlyUnknown?"최대 ":"")+money(r.monthlyBalance))+
    '<div class="actions"><button class="btn secondary" data-open="'+x.id+'">결과 보기</button><button class="btn secondary" data-export="'+x.id+'">이미지 저장</button><button class="btn ghost" data-edit="'+x.id+'">주거 조건 수정</button><button class="btn ghost" data-delete="'+x.id+'">삭제</button></div></div>'
  }).join("")+'</div><div class="actions"><button class="btn primary" data-compare '+(state.selected.length<2?"disabled":"")+'>선택한 조건 비교 ('+state.selected.length+')</button><button class="btn secondary" data-new>다른 조건 계산</button></div>'
}
function compare(){
  const chosen=list().filter(x=>state.selected.includes(x.id));
  if(chosen.length<2) return '<div class="empty">비교할 조건을 2개 이상 선택해주세요.</div>';
  const sameFinance=chosen.every(x=>JSON.stringify(x.financeSnapshot)===JSON.stringify(chosen[0].financeSnapshot));
  const financeDiffSummary=()=>{
    const fields=[
      ["가용 자금","availableFunds"],
      ["월 소득","monthlyIncome"],
      ["월 고정지출","fixedExpenses"],
      ["최소 보유 자금","minimumFunds"]
    ];
    return fields.map(([label,key])=>{
      const groups=new Map();
      chosen.forEach(item=>{
        const value=num(item.financeSnapshot[key]);
        const names=groups.get(value)||[];
        names.push(item.name);
        groups.set(value,names);
      });
      if(groups.size<=1)return "";
      const parts=[...groups.entries()].map(([value,names])=>names.map(escapeHtml).join("·")+" "+money(value));
      return '<li><strong>'+label+'</strong>: '+parts.join(" / ")+'</li>';
    }).filter(Boolean).join("");
  };
  const groups=[
    {title:"재정 기준",rows:[
      ["가용 자금",x=>money(num(x.financeSnapshot.availableFunds))],
      ["월 소득",x=>money(num(x.financeSnapshot.monthlyIncome))],
      ["월 고정지출",x=>money(num(x.financeSnapshot.fixedExpenses))],
      ["최소 보유 자금",x=>money(num(x.financeSnapshot.minimumFunds))]
    ]},
    {title:"주거 조건",rows:[
      ["거래 유형",x=>x.transactionType==="monthlyRent"?"월세":"전세"],
      ["보증금",x=>money(num(x.housing.deposit))],
      ["월세",x=>x.transactionType==="monthlyRent"?money(num(x.housing.monthlyRent)):"—"],
      ["관리비",x=>costDisplay(x.housing.managementFee)],
      ["주차비",x=>costDisplay(x.housing.parkingFee)],
      ["인터넷",x=>costDisplay(x.housing.internet)],
      ["기타 월 주거비",x=>costDisplay(x.housing.otherMonthly)]
    ]},
    {title:"초기 비용",rows:[
      ["중개보수",x=>costDisplay(x.housing.brokerageFee)],
      ["이사비",x=>costDisplay(x.housing.movingFee)],
      ["입주 청소비",x=>costDisplay(x.housing.cleaningFee)],
      ["기타 초기 비용",x=>costDisplay(x.housing.otherInitial)]
    ]},
    {title:"계산 결과",rows:[
      ["초기 필요 자금",x=>(x.results.initialUnknown?"최소 ":"")+money(x.results.initialKnown)],
      ["초기 비용 후 잔액",x=>(x.results.initialUnknown?"최대 ":"")+money(x.results.initialBalance)],
      ["최소 보유 자금 대비",x=>signedMoney(x.results.minDiff)],
      ["월 주거비",x=>(x.results.monthlyUnknown?"최소 ":"")+money(x.results.monthlyKnown)],
      ["주거비 반영 후 잔액",x=>(x.results.monthlyUnknown?"최대 ":"")+money(x.results.monthlyBalance)]
    ]}
  ];
  let body='<h2>비교</h2><p class="muted">초기 부담과 매달 부담의 차이를 함께 확인하세요.</p>';
  if(!sameFinance){
    const diffItems=financeDiffSummary();
    body+='<div class="notice"><strong>선택한 조건의 계산 기준 재정이 서로 다릅니다.</strong><div class="finance-diff-title">다른 재정 기준</div><ul class="finance-diff-list">'+diffItems+'</ul><div>같은 기준으로 다시 계산하면 AI 비교를 사용할 수 있어요.</div></div>';
  }
  body+='<div class="compare-desktop"><section class="section"><div class="table-wrap"><table><thead><tr><th>항목</th>'+chosen.map(x=>'<th>'+escapeHtml(x.name)+'</th>').join("")+'</tr></thead><tbody>';
  groups.forEach(group=>{
    body+='<tr class="group-row"><td colspan="'+(chosen.length+1)+'">'+group.title+'</td></tr>';
    body+=group.rows.map(([label,fn])=>'<tr><td>'+label+'</td>'+chosen.map(x=>'<td>'+fn(x)+'</td>').join("")+'</tr>').join("");
  });
  body+='</tbody></table></div></section></div>';
  body+='<div class="compare-mobile">';
  groups.forEach(group=>{
    body+='<section class="compare-section"><h3>'+group.title+'</h3>';
    group.rows.forEach(([label,fn])=>{
      body+='<div class="compare-metric"><div class="compare-metric-label">'+label+'</div><div class="compare-columns" style="grid-template-columns:repeat('+chosen.length+',minmax(0,1fr))">'+chosen.map(x=>'<div class="compare-column"><span>'+escapeHtml(x.name)+'</span><strong>'+fn(x)+'</strong></div>').join("")+'</div></div>';
    });
    body+='</section>';
  });
  body+='</div>';

  body+='<section class="section finance-ai-section"><h3>내 재정 기준 비교</h3><p class="muted">같은 재정 기준에서 각 조건의 월 주거비와 생활비 사용 가능 금액을 비교해요. 특정 조건을 추천하거나 순위를 매기지는 않아요.</p>';
  if(state.aiResult){
    if(state.aiResult.error) body+='<div class="notice">'+escapeHtml(state.aiResult.error)+'</div>';
    else{
      body+='<div class="ai-summary-grid">'+chosen.map(item=>{
        const r=item.results;
        const interp=(state.aiResult.conditions||[]).find(c=>normalizeConditionName(c.name)===normalizeConditionName(item.name))?.interpretation||"";
        return '<div class="ai-summary-card"><div class="ai-summary-head"><strong>'+escapeHtml(item.name)+'</strong><span>'+(item.transactionType==="monthlyRent"?"월세":"전세")+'</span></div>'+
          '<div class="ai-focus-label">생활비 사용 가능 금액</div>'+
          '<div class="ai-focus-value '+(r.monthlyBalance>0?"status-positive":r.monthlyBalance<0?"status-negative":"status-neutral")+'">'+(r.monthlyUnknown?"최대 ":"")+money(r.monthlyBalance)+'</div>'+
          '<div class="ai-mini-row"><span>월 주거비</span><strong>'+(r.monthlyUnknown?"최소 ":"")+money(r.monthlyKnown)+'</strong></div>'+
          '<div class="ai-mini-row"><span>최소 보유 자금 대비</span><strong class="'+diffStatusClass(r.minDiff)+'">'+signedMoney(r.minDiff)+'</strong></div>'+
          (interp?'<p class="ai-card-copy">'+escapeHtml(interp)+'</p>':'')+
        '</div>';
      }).join("")+'</div>';

      if(state.aiResult.monthlyComparison) body+='<div class="ai-section ai-monthly-compare"><h3>생활비 사용 가능 금액 비교</h3><p>'+escapeHtml(state.aiResult.monthlyComparison)+'</p></div>';

      const checks=[];
      chosen.forEach(item=>{
        const names=[...unknownLabels(item.housing,OPTIONAL_INITIAL),...unknownLabels(item.housing,OPTIONAL_MONTHLY)];
        if(names.length) checks.push('<li><strong>'+escapeHtml(item.name)+'</strong>: '+names.map(escapeHtml).join(", ")+' 미확인</li>');
      });
      if(checks.length) body+='<div class="ai-section ai-checks"><h3>확인할 점</h3><ul>'+checks.join("")+'</ul><p class="helper">미확인 비용은 합계에서 제외되어 비용은 최소값, 잔액은 최대값으로 표시됩니다.</p></div>';

      body+='<p class="helper ai-balance-note">생활비 사용 가능 금액은 월 소득에서 월 고정지출과 확인된 월 주거비를 뺀 금액입니다. 식비·교통비·저축 등 실제 지출 전 기준입니다.</p>'+
        '<button class="btn secondary" data-export-ai>AI 비교 결과 이미지로 저장</button>';
    }
  }else body+='<button class="btn primary" data-ai '+(!sameFinance?"disabled":"")+'>내 재정 기준으로 비교하기</button>';
  body+='</section><div class="actions"><button class="btn secondary" data-go="saved">비교 대상 다시 선택</button></div>';
  return body
}
function validateFinance(){
  const e={}; [["availableFunds","가용 자금"],["monthlyIncome","월 소득"],["fixedExpenses","월 고정지출"],["minimumFunds","최소 보유 자금"]].forEach(([k,l])=>{if(state.finance[k]==="")e[k]=l+"을 입력해주세요."}); return e
}
function validateHousing(){
  const e={};
  if(!state.housing.name.trim()) e.name="이름을 입력해주세요.";
  else if(isDuplicateConditionName(state.housing.name)) e.name="이미 저장한 조건 이름이에요. 다른 이름으로 구분해주세요.";
  if(state.housing.deposit==="") e.deposit="보증금을 입력해주세요.";
  if(state.housing.transactionType==="monthlyRent"&&state.housing.monthlyRent==="") e.monthlyRent="월세를 입력해주세요.";
  return e
}
function snapshot(){
  const old=list().find(x=>x.id===state.editingId);
  return {id:state.editingId||crypto.randomUUID(),name:state.housing.name.trim(),transactionType:state.housing.transactionType,housing:structuredClone(state.housing),financeSnapshot:structuredClone(state.finance),results:calculate(state.finance,state.housing),createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()}
}
function openCalc(id,edit){
  const x=list().find(v=>v.id===id); if(!x)return; state.finance=structuredClone(x.financeSnapshot);state.housing=structuredClone(x.housing);state.lastResult=x.results;state.editingId=x.id;state.isDirty=edit;state.selectedMinPct=null;state.view=edit?"housing":"result";render()
}
async function askAI(){
  const chosen=list().filter(x=>state.selected.includes(x.id));
  const cacheKey=chosen.map(x=>x.id+":"+x.updatedAt).sort().join("|");
  const cached=(load(KEY.ai)||{})[cacheKey];
  if(cached){state.aiResult=cached;render();return}
  const b=$("[data-ai]"); if(b){b.disabled=true;b.textContent="내 재정 기준으로 정리하는 중..."}
  try{
    const r=await fetch("/api/compare",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({scenarios:chosen})});
    const raw=await r.text();
    let d;
    try{d=JSON.parse(raw)}catch{
      throw new Error(r.ok?"AI 응답 형식을 읽지 못했어요. 잠시 후 다시 시도해주세요.":"AI 서버에서 일시적인 오류가 발생했어요. 잠시 후 다시 시도해주세요.");
    }
    if(!r.ok) throw new Error(d.error||"재정 기준 비교를 불러오지 못했습니다.");
    state.aiResult=d;
    const cache=load(KEY.ai)||{};cache[cacheKey]=d;save(KEY.ai,cache);
  }catch(e){
    state.aiResult={error:e.message};
  }
  render()
}
function render(){
  const views={home,finance,housing,result,saved,compare}; $("#app").innerHTML=shell((views[state.view]||home)()); bind()
}
function bind(){
  document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>{state.view=b.dataset.go;state.aiResult=null;render()});
  document.querySelectorAll("[data-start]").forEach(b=>b.onclick=()=>{state.view="finance";state.editingId=null;state.housing=newHousing();state.isDirty=false;state.selectedMinPct=null;render()});
  document.querySelectorAll("[data-finance]").forEach(i=>i.oninput=e=>{
    const key=i.dataset.finance;
    state.finance[key]=sanitize(e.target.value);
    if(key==="minimumFunds"||key==="availableFunds") state.selectedMinPct=null;
    state.isDirty=!!state.editingId;
    e.target.value=formatInput(state.finance[key]);
  });
  document.querySelectorAll("[data-min-pct]").forEach(b=>b.onclick=()=>{
    if(state.finance.availableFunds===""){
      const e=document.querySelector('[data-error="minimumFunds"]');if(e)e.textContent="가용 자금을 먼저 입력해주세요.";return;
    }
    state.selectedMinPct=Number(b.dataset.minPct);
    state.finance.minimumFunds=String(Math.round(num(state.finance.availableFunds)*state.selectedMinPct/100));
    state.isDirty=!!state.editingId;render();
  });
  $("[data-next-finance]")?.addEventListener("click",()=>{const e=validateFinance();document.querySelectorAll("[data-error]").forEach(x=>x.textContent=e[x.dataset.error]||"");if(Object.keys(e).length)return;save(KEY.finance,state.finance);state.view="housing";render()});
  document.querySelectorAll("[data-type]").forEach(b=>b.onclick=()=>{state.housing.transactionType=b.dataset.type;state.isDirty=!!state.editingId;if(b.dataset.type==="jeonse")state.housing.monthlyRent="";render()});
  document.querySelectorAll("[data-housing]").forEach(i=>i.oninput=e=>{const k=i.dataset.housing;state.housing[k]=k==="name"?e.target.value:sanitize(e.target.value);state.isDirty=!!state.editingId;if(k!=="name")e.target.value=formatInput(state.housing[k])});
  document.querySelectorAll("[data-cost]").forEach(b=>b.onclick=()=>{const [k,s]=b.dataset.cost.split(":");state.housing[k]={status:s,amount:s==="amount"?"":null};state.isDirty=!!state.editingId;render()});
  document.querySelectorAll("[data-cost-amount]").forEach(i=>i.oninput=e=>{const k=i.dataset.costAmount;state.housing[k].amount=sanitize(e.target.value);state.isDirty=!!state.editingId;e.target.value=formatInput(state.housing[k].amount)});
  $("[data-calc]")?.addEventListener("click",()=>{const e=validateHousing();document.querySelectorAll("[data-error]").forEach(x=>x.textContent=e[x.dataset.error]||"");if(Object.keys(e).length)return;state.lastResult=calculate(state.finance,state.housing);state.view="result";render()});
  $("[data-save]")?.addEventListener("click",()=>{
    if(isDuplicateConditionName(state.housing.name)){
      state.view="housing";render();
      const e=document.querySelector('[data-error="name"]');if(e)e.textContent="이미 저장한 조건 이름이에요. 다른 이름으로 구분해주세요.";
      return;
    }
    const item=snapshot(),a=list(),i=a.findIndex(x=>x.id===item.id);
    if(i>=0)a[i]=item;else a.unshift(item);
    saveList(a);state.editingId=item.id;state.isDirty=false;render();
  });
  $("[data-export-current]")?.addEventListener("click",()=>exportConditionImage({name:state.housing.name.trim(),transactionType:state.housing.transactionType,housing:structuredClone(state.housing),financeSnapshot:structuredClone(state.finance),results:calculate(state.finance,state.housing)}));
  $("[data-edit-housing]")?.addEventListener("click",()=>{state.view="housing";render()});
  $("[data-go-compare]")?.addEventListener("click",()=>{state.selected=state.editingId?[state.editingId]:[];state.view="saved";state.aiResult=null;render()});
  document.querySelectorAll("[data-new]").forEach(b=>b.onclick=()=>{state.housing=newHousing();state.editingId=null;state.lastResult=null;state.isDirty=false;state.view="housing";render()});
  document.querySelectorAll("[data-select]").forEach(i=>i.onchange=e=>{const id=i.dataset.select;if(e.target.checked&&!state.selected.includes(id)){if(state.selected.length>=3){alert("비교는 최대 3개까지 가능해요.");return render()}state.selected.push(id)}else state.selected=state.selected.filter(x=>x!==id);render()});
  document.querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>openCalc(b.dataset.open,false));
  document.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>openCalc(b.dataset.edit,true));
  document.querySelectorAll("[data-export]").forEach(b=>b.onclick=()=>{const x=list().find(v=>v.id===b.dataset.export);if(x)exportConditionImage(x)});
  document.querySelectorAll("[data-delete]").forEach(b=>b.onclick=()=>{saveList(list().filter(x=>x.id!==b.dataset.delete));state.selected=state.selected.filter(x=>x!==b.dataset.delete);render()});
  $("[data-compare]")?.addEventListener("click",()=>{state.view="compare";state.aiResult=null;render()});
  $("[data-ai]")?.addEventListener("click",askAI);
  $("[data-export-ai]")?.addEventListener("click",()=>{
    const chosen=list().filter(x=>state.selected.includes(x.id));
    exportAIComparisonImage(chosen,state.aiResult);
  })
}
render();
