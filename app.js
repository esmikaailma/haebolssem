
import {OPTIONAL_MONTHLY,OPTIONAL_INITIAL,newHousing,money,num,sanitize,formatInput,escapeHtml,calculate,costDisplay} from "./lib.js";

const $=s=>document.querySelector(s);
const KEY={finance:"haebolssem_finance_v2",calculations:"haebolssem_calculations_v2",ai:"haebolssem_ai_v2"};
const load=k=>{try{return JSON.parse(localStorage.getItem(k))}catch{return null}};
const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const list=()=>load(KEY.calculations)||[];
const saveList=v=>save(KEY.calculations,v);

let state={
  view:"home",
  finance:load(KEY.finance)||{availableFunds:"",monthlyIncome:"",fixedExpenses:"",minimumFunds:""},
  housing:newHousing(),editingId:null,lastResult:null,selected:[],aiResult:null,isDirty:false
};

function row(label,val){return '<div class="row"><span>'+label+'</span><strong>'+val+'</strong></div>'}
function shell(body){return '<main class="app-shell"><div class="topbar"><button class="link-btn brand" data-go="home">해볼셈</button><button class="link-btn" data-go="saved">저장 내역</button></div>'+body+'</main>'}
function metric(label,val,note){return '<div class="metric"><div class="label">'+label+'</div><div class="value">'+val+'</div>'+(note?'<div class="note">'+note+'</div>':'')+'</div>'}
function exportConditionImage(item){
  const r=item.results;
  const canvas=document.createElement("canvas");
  canvas.width=1080; canvas.height=1420;
  const ctx=canvas.getContext("2d");
  ctx.fillStyle="#f8fafc";ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle="#ffffff";ctx.fillRect(64,64,952,1292);
  ctx.fillStyle="#2563eb";ctx.font="700 30px Pretendard, sans-serif";ctx.fillText("해볼셈",112,128);
  ctx.fillStyle="#111827";ctx.font="800 52px Pretendard, sans-serif";ctx.fillText(item.name||"주거 조건",112,210);
  ctx.fillStyle="#6b7280";ctx.font="500 26px Pretendard, sans-serif";ctx.fillText(item.transactionType==="monthlyRent"?"월세":"전세",112,255);
  const lines=[
    ["초기 필요 자금",(r.initialUnknown?"최소 ":"")+money(r.initialKnown)],
    ["초기 비용 후 잔액",(r.initialUnknown?"최대 ":"")+money(r.initialBalance)],
    ["최소 보유 자금 대비",(r.minDiff>=0?"+":"-")+money(Math.abs(r.minDiff))],
    ["월 주거비",(r.monthlyUnknown?"최소 ":"")+money(r.monthlyKnown)],
    ["주거비 반영 후 잔액",(r.monthlyUnknown?"최대 ":"")+money(r.monthlyBalance)]
  ];
  let y=350;
  lines.forEach(([label,value])=>{
    ctx.fillStyle="#6b7280";ctx.font="600 25px Pretendard, sans-serif";ctx.fillText(label,112,y);
    ctx.fillStyle="#111827";ctx.font="800 38px Pretendard, sans-serif";ctx.textAlign="right";ctx.fillText(value,968,y+4);ctx.textAlign="left";
    ctx.strokeStyle="#e5e7eb";ctx.beginPath();ctx.moveTo(112,y+42);ctx.lineTo(968,y+42);ctx.stroke();
    y+=145;
  });
  ctx.fillStyle="#6b7280";ctx.font="500 22px Pretendard, sans-serif";
  ctx.fillText("주거비 반영 후 잔액에는 식비·교통비 등 변동 생활비가 포함되지 않습니다.",112,1135);
  if(r.initialUnknown||r.monthlyUnknown){
    ctx.fillStyle="#9a3412";ctx.font="600 22px Pretendard, sans-serif";
    ctx.fillText("미확인 비용이 있어 현재 확인된 금액 기준으로 표시했습니다.",112,1185);
  }
  ctx.fillStyle="#94a3b8";ctx.font="500 20px Pretendard, sans-serif";ctx.fillText("haebolssem",112,1285);
  const a=document.createElement("a");
  a.download=(item.name||"해볼셈")+"-계산결과.png";
  a.href=canvas.toDataURL("image/png");
  a.click();
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
  return '<section class="hero"><div class="eyebrow">독립 주거 비용 계산기</div><h1>독립, 해 볼 셈이라면<br>먼저 셈해보세요.</h1><p class="muted">독립할 때 필요한 초기 비용과 매달 부담할 주거비를 계산하고 비교해보세요.</p><div class="actions"><button class="btn primary" data-start>계산 시작하기</button><button class="btn secondary" data-go="saved">저장 내역 보기</button></div></section>'
}
function finance(){
  return '<div class="step">1 / 2</div><h2>독립 비용 계산의 기준</h2><p class="muted">내 재정에서 독립 비용을 계산할 기준을 먼저 입력하세요.</p><section class="section stack">'+
  field("availableFunds","가용 자금","독립을 위해 실제로 사용할 수 있는 현금성 자금을 입력하세요.")+
  field("monthlyIncome","월 소득","수입이 일정하지 않다면 최근 1년간 평균 월 소득을 입력하세요.")+
  field("fixedExpenses","월 고정지출","독립 후에도 계속 발생하는 대출 상환·보험료·통신비·정기 구독료 등을 합산해 입력하세요.")+
  field("minimumFunds","최소 보유 자금","독립 비용을 지출한 뒤에도 최소한 남겨두고 싶은 자금을 입력하세요.")+
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
  '</section><div class="actions"><button class="btn primary" data-calc>계산하기</button><button class="btn secondary" data-go="finance">내 재정 변경</button></div>'
}
function result(){
  const r=state.lastResult||calculate(state.finance,state.housing);
  const exists=state.editingId&&list().some(x=>x.id===state.editingId);
  const saved=exists&&!state.isDirty;
  const saveLabel=saved?"저장 완료":(exists?"변경 저장":"저장하기");
  const diff=r.minDiff>=0?'<span class="status-positive">+'+money(r.minDiff)+'</span>':'<span class="status-negative">-'+money(Math.abs(r.minDiff))+'</span>';
  let body='<h2>'+escapeHtml(state.housing.name)+'</h2><p class="muted">'+(state.housing.transactionType==="monthlyRent"?"월세":"전세")+' 조건 계산 결과</p>';
  if(r.initialUnknown||r.monthlyUnknown) body+='<div class="notice">모르는 비용이 있어 확인된 금액 기준으로 계산했습니다. 비용은 최소값, 잔액은 최대값으로 표시됩니다.</div>';
  body+='<section class="section result-grid">'+
    metric("초기 필요 자금",(r.initialUnknown?"최소 ":"")+money(r.initialKnown),r.initialUnknown?"미확인 비용 "+r.initialUnknown+"건":"")+
    metric("초기 비용 후 잔액",(r.initialUnknown?"최대 ":"")+money(r.initialBalance),r.initialUnknown?"미확인 비용 반영 시 실제 잔액은 더 적어질 수 있어요.":"")+
    metric("최소 보유 자금 대비",diff,r.minDiff>=0?"설정한 최소 보유 자금보다 더 남습니다.":"설정한 최소 보유 자금보다 부족합니다.")+
    metric("월 주거비",(r.monthlyUnknown?"최소 ":"")+money(r.monthlyKnown),r.monthlyUnknown?"미확인 비용 "+r.monthlyUnknown+"건":"")+
    metric("주거비 반영 후 잔액",(r.monthlyUnknown?"최대 ":"")+money(r.monthlyBalance),"식비·교통비 등 변동 생활비는 포함되지 않았어요.")+
  '</section>';
  body+='<section class="section"><h3>초기 비용 상세</h3><div class="card breakdown">'+row("보증금",money(num(state.housing.deposit)))+OPTIONAL_INITIAL.map(([k,l])=>row(l,costDisplay(state.housing[k]))).join("")+'</div></section>';
  body+='<section class="section"><h3>월 주거비 상세</h3><div class="card breakdown">'+row("월세",state.housing.transactionType==="monthlyRent"?money(num(state.housing.monthlyRent)):"—")+OPTIONAL_MONTHLY.map(([k,l])=>row(l,costDisplay(state.housing[k]))).join("")+'</div></section>';
  body+='<div class="actions"><button class="btn primary" data-save '+(saved?"disabled":"")+'>'+saveLabel+'</button><button class="btn secondary" data-export-current>결과 이미지로 저장</button><button class="btn secondary" data-edit-housing>주거 조건 변경</button><button class="btn secondary" data-go="finance">내 재정 변경</button><button class="btn ghost" data-new>다른 조건 계산</button><button class="btn ghost" data-go="saved">저장 내역 보기</button></div>';
  return body
}
function saved(){
  const items=list();
  if(!items.length) return '<h2>저장 내역</h2><div class="empty">아직 저장된 계산이 없습니다.<div class="actions"><button class="btn primary" data-start>계산 시작하기</button></div></div>';
  return '<h2>저장 내역</h2><p class="muted">비교할 조건을 2~3개 선택하세요.</p><div class="stack">'+items.map(x=>{
    const r=x.results;
    return '<div class="card saved-card"><div class="saved-head"><div><h3>'+escapeHtml(x.name)+'</h3><div class="muted">'+(x.transactionType==="monthlyRent"?"월세":"전세")+'</div></div><input class="check" type="checkbox" data-select="'+x.id+'" '+(state.selected.includes(x.id)?"checked":"")+'></div>'+
    row("초기 필요 자금",(r.initialUnknown?"최소 ":"")+money(r.initialKnown))+row("초기 비용 후 잔액",(r.initialUnknown?"최대 ":"")+money(r.initialBalance))+row("월 주거비",(r.monthlyUnknown?"최소 ":"")+money(r.monthlyKnown))+row("주거비 반영 후 잔액",(r.monthlyUnknown?"최대 ":"")+money(r.monthlyBalance))+
    '<div class="actions"><button class="btn secondary" data-open="'+x.id+'">결과 보기</button><button class="btn secondary" data-export="'+x.id+'">이미지 저장</button><button class="btn ghost" data-edit="'+x.id+'">주거 조건 변경</button><button class="btn ghost" data-delete="'+x.id+'">삭제</button></div></div>'
  }).join("")+'</div><div class="actions"><button class="btn primary" data-compare '+(state.selected.length<2?"disabled":"")+'>선택한 조건 비교 ('+state.selected.length+')</button><button class="btn secondary" data-new>다른 조건 계산</button></div>'
}
function compare(){
  const chosen=list().filter(x=>state.selected.includes(x.id));
  if(chosen.length<2) return '<div class="empty">비교할 조건을 2개 이상 선택해주세요.</div>';
  const groups=[
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
      ["최소 보유 자금 대비",x=>(x.results.minDiff>=0?"+":"-")+money(Math.abs(x.results.minDiff))],
      ["월 주거비",x=>(x.results.monthlyUnknown?"최소 ":"")+money(x.results.monthlyKnown)],
      ["주거비 반영 후 잔액",x=>(x.results.monthlyUnknown?"최대 ":"")+money(x.results.monthlyBalance)]
    ]}
  ];
  let body='<h2>비교</h2><p class="muted">초기 부담과 매달 부담의 차이를 함께 확인하세요.</p>';
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
      body+='<div class="compare-metric"><div class="compare-metric-label">'+label+'</div><div class="compare-values">'+chosen.map(x=>'<div class="compare-value"><span>'+escapeHtml(x.name)+'</span><strong>'+fn(x)+'</strong></div>').join("")+'</div></div>';
    });
    body+='</section>';
  });
  body+='</div>';
  body+='<section class="section"><h3>AI 비교 해석</h3><p class="muted">조건 간 비용 구조와 주요 차이만 짧게 정리합니다.</p>';
  if(state.aiResult){
    body+='<div class="ai-box">'+(state.aiResult.keyDifferences?'<div class="ai-section"><h3>핵심 차이</h3><p>'+escapeHtml(state.aiResult.keyDifferences)+'</p></div>':'')+(state.aiResult.costStructure?'<div class="ai-section"><h3>비용 구조</h3><p>'+escapeHtml(state.aiResult.costStructure)+'</p></div>':'')+(state.aiResult.mainVariables?'<div class="ai-section"><h3>주요 변수</h3><p>'+escapeHtml(state.aiResult.mainVariables)+'</p></div>':'')+(state.aiResult.summary?'<p>'+escapeHtml(state.aiResult.summary)+'</p>':'')+'</div>'
  }else body+='<button class="btn primary" data-ai>AI로 차이 알아보기</button>';
  body+='</section><div class="actions"><button class="btn secondary" data-go="saved">비교 대상 다시 선택</button></div>';
  return body
}
function validateFinance(){
  const e={}; [["availableFunds","가용 자금"],["monthlyIncome","월 소득"],["fixedExpenses","월 고정지출"],["minimumFunds","최소 보유 자금"]].forEach(([k,l])=>{if(state.finance[k]==="")e[k]=l+"을 입력해주세요."}); return e
}
function validateHousing(){
  const e={}; if(!state.housing.name.trim())e.name="이름을 입력해주세요."; if(state.housing.deposit==="")e.deposit="보증금을 입력해주세요."; if(state.housing.transactionType==="monthlyRent"&&state.housing.monthlyRent==="")e.monthlyRent="월세를 입력해주세요."; return e
}
function snapshot(){
  const old=list().find(x=>x.id===state.editingId);
  return {id:state.editingId||crypto.randomUUID(),name:state.housing.name.trim(),transactionType:state.housing.transactionType,housing:structuredClone(state.housing),financeSnapshot:structuredClone(state.finance),results:calculate(state.finance,state.housing),createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()}
}
function openCalc(id,edit){
  const x=list().find(v=>v.id===id); if(!x)return; state.finance=structuredClone(x.financeSnapshot);state.housing=structuredClone(x.housing);state.lastResult=x.results;state.editingId=x.id;state.isDirty=edit;state.view=edit?"housing":"result";render()
}
async function askAI(){
  const chosen=list().filter(x=>state.selected.includes(x.id)); const b=$("[data-ai]"); if(b){b.disabled=true;b.textContent="차이를 정리하는 중..."}
  try{const r=await fetch("/api/compare",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({scenarios:chosen})});const d=await r.json();if(!r.ok)throw new Error(d.error||"AI 해석을 불러오지 못했습니다.");state.aiResult=d}catch(e){state.aiResult={summary:e.message+" 계산 및 비교 기능은 정상적으로 사용할 수 있습니다."}} render()
}
function render(){
  const views={home,finance,housing,result,saved,compare}; $("#app").innerHTML=shell((views[state.view]||home)()); bind()
}
function bind(){
  document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>{state.view=b.dataset.go;state.aiResult=null;render()});
  document.querySelectorAll("[data-start]").forEach(b=>b.onclick=()=>{state.view="finance";state.editingId=null;state.housing=newHousing();state.isDirty=false;render()});
  document.querySelectorAll("[data-finance]").forEach(i=>i.oninput=e=>{state.finance[i.dataset.finance]=sanitize(e.target.value);state.isDirty=!!state.editingId;e.target.value=formatInput(state.finance[i.dataset.finance])});
  $("[data-next-finance]")?.addEventListener("click",()=>{const e=validateFinance();document.querySelectorAll("[data-error]").forEach(x=>x.textContent=e[x.dataset.error]||"");if(Object.keys(e).length)return;save(KEY.finance,state.finance);state.view="housing";render()});
  document.querySelectorAll("[data-type]").forEach(b=>b.onclick=()=>{state.housing.transactionType=b.dataset.type;state.isDirty=!!state.editingId;if(b.dataset.type==="jeonse")state.housing.monthlyRent="";render()});
  document.querySelectorAll("[data-housing]").forEach(i=>i.oninput=e=>{const k=i.dataset.housing;state.housing[k]=k==="name"?e.target.value:sanitize(e.target.value);state.isDirty=!!state.editingId;if(k!=="name")e.target.value=formatInput(state.housing[k])});
  document.querySelectorAll("[data-cost]").forEach(b=>b.onclick=()=>{const [k,s]=b.dataset.cost.split(":");state.housing[k]={status:s,amount:s==="amount"?"":null};state.isDirty=!!state.editingId;render()});
  document.querySelectorAll("[data-cost-amount]").forEach(i=>i.oninput=e=>{const k=i.dataset.costAmount;state.housing[k].amount=sanitize(e.target.value);state.isDirty=!!state.editingId;e.target.value=formatInput(state.housing[k].amount)});
  $("[data-calc]")?.addEventListener("click",()=>{const e=validateHousing();document.querySelectorAll("[data-error]").forEach(x=>x.textContent=e[x.dataset.error]||"");if(Object.keys(e).length)return;state.lastResult=calculate(state.finance,state.housing);state.view="result";render()});
  $("[data-save]")?.addEventListener("click",()=>{const item=snapshot(),a=list(),i=a.findIndex(x=>x.id===item.id);if(i>=0)a[i]=item;else a.unshift(item);saveList(a);state.editingId=item.id;state.isDirty=false;render()});
  $("[data-export-current]")?.addEventListener("click",()=>exportConditionImage({name:state.housing.name.trim(),transactionType:state.housing.transactionType,housing:structuredClone(state.housing),financeSnapshot:structuredClone(state.finance),results:calculate(state.finance,state.housing)}));
  $("[data-edit-housing]")?.addEventListener("click",()=>{state.view="housing";render()});
  document.querySelectorAll("[data-new]").forEach(b=>b.onclick=()=>{state.housing=newHousing();state.editingId=null;state.lastResult=null;state.isDirty=false;state.view="housing";render()});
  document.querySelectorAll("[data-select]").forEach(i=>i.onchange=e=>{const id=i.dataset.select;if(e.target.checked&&!state.selected.includes(id)){if(state.selected.length>=3){alert("비교는 최대 3개까지 가능해요.");return render()}state.selected.push(id)}else state.selected=state.selected.filter(x=>x!==id);render()});
  document.querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>openCalc(b.dataset.open,false));
  document.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>openCalc(b.dataset.edit,true));
  document.querySelectorAll("[data-export]").forEach(b=>b.onclick=()=>{const x=list().find(v=>v.id===b.dataset.export);if(x)exportConditionImage(x)});
  document.querySelectorAll("[data-delete]").forEach(b=>b.onclick=()=>{saveList(list().filter(x=>x.id!==b.dataset.delete));state.selected=state.selected.filter(x=>x!==b.dataset.delete);render()});
  $("[data-compare]")?.addEventListener("click",()=>{state.view="compare";state.aiResult=null;render()});
  $("[data-ai]")?.addEventListener("click",askAI)
}
render();
