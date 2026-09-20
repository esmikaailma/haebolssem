
export const OPTIONAL_MONTHLY = [
  ["managementFee","관리비"],["parkingFee","주차비"],["internet","인터넷"],["otherMonthly","기타 월 주거비"]
];
export const OPTIONAL_INITIAL = [
  ["brokerageFee","중개보수"],["movingFee","이사비"],["cleaningFee","입주 청소비"],["otherInitial","기타 초기 비용"]
];
export const blankCost = () => ({status:"unset",amount:null});
export const newHousing = () => ({
  name:"",transactionType:"monthlyRent",deposit:"",monthlyRent:"",
  managementFee:blankCost(),parkingFee:blankCost(),internet:blankCost(),otherMonthly:blankCost(),
  brokerageFee:blankCost(),movingFee:blankCost(),cleaningFee:blankCost(),otherInitial:blankCost()
});
export const money = n => new Intl.NumberFormat("ko-KR").format(Math.trunc(Number(n)||0))+"원";
export const num = v => Number(String(v ?? "").replaceAll(",",""))||0;
export const sanitize = v => String(v).replace(/[^\d]/g,"");
export const formatInput = v => v==="" ? "" : new Intl.NumberFormat("ko-KR").format(num(v));
export const escapeHtml = (s="") => String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
export const knownAmount = c => c?.status==="amount" ? num(c.amount) : 0;
export const unknownCount = (obj,keys) => keys.filter(([k])=>obj[k]?.status==="unknown").length;
export function calculate(finance,h){
  const initialKnown=num(h.deposit)+OPTIONAL_INITIAL.reduce((s,[k])=>s+knownAmount(h[k]),0);
  const monthlyKnown=(h.transactionType==="monthlyRent"?num(h.monthlyRent):0)+OPTIONAL_MONTHLY.reduce((s,[k])=>s+knownAmount(h[k]),0);
  const initialUnknown=unknownCount(h,OPTIONAL_INITIAL);
  const monthlyUnknown=unknownCount(h,OPTIONAL_MONTHLY);
  const initialBalance=num(finance.availableFunds)-initialKnown;
  return {
    initialKnown,monthlyKnown,initialUnknown,monthlyUnknown,initialBalance,
    minDiff:initialBalance-num(finance.minimumFunds),
    monthlyBalance:num(finance.monthlyIncome)-num(finance.fixedExpenses)-monthlyKnown
  };
}
export function costDisplay(c){
  if(!c||c.status==="unset") return "미입력";
  if(c.status==="unknown") return "모름";
  return money(knownAmount(c));
}
