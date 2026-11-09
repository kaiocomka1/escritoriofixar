// Motor financeiro deterministico. Valores monetarios em BRL por unidade/pedido.
// Nunca autoriza publicacao com dados ausentes ou fora de limites.
const isValid=(v)=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
const money=(v)=>Math.round((v+Number.EPSILON)*100)/100;
const floorMoney=(v)=>Math.floor(Math.max(0,v)*100+1e-9)/100;
export function evaluatePricing(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))return {approved:false,reason:'invalid_input',minMarginPercent:15};
 const adsPerOrder=input.adsCostPerOrder!==undefined;
 if(adsPerOrder&&input.adsRate!==undefined)return {approved:false,reason:'duplicate_ads_cost',minMarginPercent:15};
 const adsField=adsPerOrder?'adsCostPerOrder':'adsRate';
 const required=['materialCost','packagingCost','laborCost','overheadCost','fixedMarketplaceFee','shippingCost','otherFixedCost','marketplaceRate','taxRate',adsField,'affiliateRate','couponRate','returnsReserveRate'];
 const missing=required.filter(k=>!isValid(input[k]));
 const minMargin=0.15;
 if(missing.length)return {approved:false,reason:'missing_or_invalid_costs',missing,minMarginPercent:15};
 const rates=['marketplaceRate','taxRate','affiliateRate','couponRate','returnsReserveRate',...(adsPerOrder?[]:['adsRate'])];
 if(rates.some(k=>input[k]>1))return {approved:false,reason:'rates_must_be_fractions_between_0_and_1',minMarginPercent:15};
 const fixedWithoutAds=['materialCost','packagingCost','laborCost','overheadCost','fixedMarketplaceFee','shippingCost','otherFixedCost'].reduce((sum,k)=>sum+input[k],0);
 const fixed=fixedWithoutAds+(adsPerOrder?input.adsCostPerOrder:0);
 const rate=rates.reduce((sum,k)=>sum+input[k],0);
 const divisor=1-rate-minMargin;
 if(divisor<=0)return {approved:false,reason:'infeasible_cost_structure',fixedCost:fixed,variableRate:rate,minMarginPercent:15};
 const minPrice=money(Math.ceil((fixed/divisor)*100-1e-9)/100);
 const candidate=input.candidatePrice;
 if(!Number.isFinite(fixed)||!Number.isFinite(minPrice))return {approved:false,reason:'numeric_overflow'};
 if(candidate!==undefined&&(!isValid(candidate)||candidate<=0||Math.abs(candidate*100-Math.round(candidate*100))>1e-7))return {approved:false,reason:'invalid_candidate_price',minPrice,minMarginPercent:15};
 if(candidate===undefined)return {approved:false,reason:'candidate_price_required',minPrice,minMarginPercent:15};
 const contribution=candidate*(1-rate)-fixed;
 const margin=candidate>0?contribution/candidate:-Infinity;
 const currentAdsCost=adsPerOrder?input.adsCostPerOrder:candidate*input.adsRate;
 const profitRequired=candidate*minMargin;
 const adsHeadroom=contribution+currentAdsCost-profitRequired;
 return {approved:margin>=minMargin-1e-9,minMarginPercent:15,minPrice,fixedCost:fixed,variableRate:rate,
  projectedProfit:money(contribution),projectedMarginPercent:money(margin*100),
  currentAdsCostPerOrder:money(currentAdsCost),maxAdsCostPerOrder:floorMoney(adsHeadroom),
  additionalAdsBudgetPerOrder:floorMoney(adsHeadroom-currentAdsCost),
  canMeetTargetWithoutAds:adsHeadroom>=-1e-9,
  profitShortfallToTarget:Math.ceil(Math.max(0,profitRequired-contribution)*100-1e-9)/100,
  reason:margin>=minMargin-1e-9?'passes_projection':'below_minimum_margin',
  note:'Projecao baseada exclusivamente nos custos informados. Nao garante lucro real; exige dados verificados e cenarios de venda.'};
}
