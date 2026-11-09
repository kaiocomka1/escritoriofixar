const floorBrl=value=>Math.floor(Math.max(0,value)*100+1e-9)/100;
const round=value=>Math.round((value+Number.EPSILON)*100)/100;
const ceilRatio=value=>Math.ceil(value*100-1e-9)/100;
const minMargin=0.15;

export function analyzeAds(input){
 const {revenue,spend,platform,mode,configuredTarget,cashLimit,orders,impressions,clicks,paidConversions}=input;
 const legacyProjection=platform===undefined&&input.financialRevenue===undefined&&input.contributionRate!==undefined;
 const financialRevenue=input.financialRevenue??(legacyProjection?revenue:undefined);
 const contribution=input.contributionBeforeAds??(financialRevenue!==undefined&&input.contributionRate!==undefined
  ?financialRevenue*input.contributionRate:undefined);
 const financialComplete=financialRevenue!==undefined&&contribution!==undefined;
 const profitAfterAds=financialComplete?round(contribution-spend):null;
 const profitMargin=financialComplete&&financialRevenue>0?(contribution-spend)/financialRevenue:null;
 const headroom=financialComplete?contribution-financialRevenue*minMargin:null;
 const maxSpendForTarget=headroom===null?null:floorBrl(headroom);
 const financialRoasFloor=financialRevenue>0&&maxSpendForTarget>0?ceilRatio(financialRevenue/maxSpendForTarget):null;
 const targetBasisMatches=input.sameRevenueBasis===true&&financialRevenue===revenue;
 const boost=platform==='shopee'&&mode==='custom_roas'&&input.rapidBoost===true;
 const stressTarget=boost&&configuredTarget>0?round(configuredTarget*0.7):null;
 const cashExceeded=cashLimit!==undefined&&spend>cashLimit;
 const canMeetMarginWithoutAds=headroom===null?null:financialRevenue>0&&headroom>=-1e-9;
 const campaignTargetApplies=mode==='custom_roas'||mode==='target_roi';
 const applicableSpendLimit=maxSpendForTarget===null||cashLimit===undefined?null:Math.min(cashLimit,maxSpendForTarget);
 let assessment='missing_financial_data';
 if(cashExceeded)assessment='cash_limit_exceeded';
 else if(financialComplete)assessment=profitMargin!==null&&profitMargin>=minMargin-1e-9?'meets_margin_target':'below_margin_target';

 return {
  platform:platform??null,mode:mode??null,
  roas:spend>0?revenue/spend:null,acosPercent:revenue>0?round(100*spend/revenue):null,
  spend,reportedRevenue:revenue,reportedRevenueMayIncludeOrganicAndAffiliate:platform==='tiktok_shop',
  costPerReportedOrder:orders>0?round(spend/orders):null,
  ctrPercent:impressions>0&&clicks!==undefined?round(100*clicks/impressions):null,
  cpc:clicks>0?round(spend/clicks):null,
  paidConversionRatePercent:clicks>0&&paidConversions!==undefined?round(100*paidConversions/clicks):null,
  financialRevenue:financialRevenue??null,
  profitAfterAds,projectedMarginPercent:profitMargin===null?null:round(profitMargin*100),
  breakEvenRoas:financialRevenue>0&&contribution>0?financialRevenue/contribution:null,
  minimumRoasForTarget:financialRoasFloor,
  maxAcosPercentForTarget:financialRevenue>0&&maxSpendForTarget!==null?Math.floor(maxSpendForTarget/financialRevenue*10000+1e-9)/100:null,
  minMarginPercent:15,canMeetMarginWithoutAds,maxSpendForTarget,
  remainingSpendWithinCashAndMargin:applicableSpendLimit===null?null:floorBrl(applicableSpendLimit-spend),
  maxSpendWithinCashAndMargin:applicableSpendLimit,cashLimit:cashLimit??null,cashExceeded,
  configuredTarget:campaignTargetApplies?configuredTarget??null:null,
  shopeeRapidBoostStressRoas:stressTarget,
  shopeeTargetNeededWithRapidBoost:boost&&targetBasisMatches&&financialRoasFloor!==null?ceilRatio(financialRoasFloor/0.7):null,
  targetBelowFinancialFloor:campaignTargetApplies&&configuredTarget>0&&targetBasisMatches&&financialRoasFloor!==null
   ?(boost?configuredTarget*0.7:configuredTarget)<financialRoasFloor:null,
  assessment,source:legacyProjection?'projection_on_reported_revenue':'user_supplied_campaign_and_financial_data'
 };
}
