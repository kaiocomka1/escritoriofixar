import test from 'node:test';
import assert from 'node:assert/strict';
import {executeTool} from '../api/_lib/agent-tools.js';

test('Arthur computes Shopee ROAS, ACOS, the margin floor and cash headroom',async()=>{
 const result=await executeTool('arthur','analyze_ads',{
  platform:'shopee',mode:'custom_roas',revenue:1000,spend:40,financialRevenue:1000,
  contributionRate:0.3,cashLimit:60,configuredTarget:25,rapidBoost:true,sameRevenueBasis:true
 });
 assert.equal(result.roas,25);
 assert.equal(result.acosPercent,4);
 assert.equal(result.profitAfterAds,260);
 assert.equal(result.minimumRoasForTarget,6.67);
 assert.equal(result.maxAcosPercentForTarget,15);
 assert.equal(result.maxSpendWithinCashAndMargin,60);
 assert.equal(result.remainingSpendWithinCashAndMargin,20);
 assert.equal(result.shopeeRapidBoostStressRoas,17.5);
 assert.equal(result.shopeeTargetNeededWithRapidBoost,9.53);
 assert.equal(result.targetBelowFinancialFloor,false);
});

test('TikTok GMV Max attributed ROI cannot substitute for financial data',async()=>{
 const result=await executeTool('arthur','analyze_ads',{
  platform:'tiktok_shop',mode:'max_delivery',revenue:1000,spend:100,orders:20,contributionRate:0.3,configuredTarget:12
 });
 assert.equal(result.roas,10);
 assert.equal(result.reportedRevenueMayIncludeOrganicAndAffiliate,true);
 assert.equal(result.costPerReportedOrder,5);
 assert.equal(result.profitAfterAds,null);
 assert.equal(result.configuredTarget,null);
 assert.equal(result.assessment,'missing_financial_data');
});

test('high reported ROI does not approve a campaign below 15% or over the cash cap',async()=>{
 const args={platform:'tiktok_shop',mode:'target_roi',revenue:1000,spend:80,financialRevenue:200,contributionBeforeAds:60};
 const result=await executeTool('arthur','analyze_ads',args);
 assert.equal(result.roas,12.5);
 assert.equal(result.profitAfterAds,-20);
 assert.equal(result.projectedMarginPercent,-10);
 assert.equal(result.assessment,'below_margin_target');
 assert.equal((await executeTool('arthur','analyze_ads',{...args,cashLimit:70})).assessment,'cash_limit_exceeded');
});

test('zero denominator and non-comparable platform targets remain undefined',async()=>{
 const result=await executeTool('arthur','analyze_ads',{platform:'shopee',mode:'custom_roas',revenue:0,spend:0});
 assert.equal(result.roas,null);
 assert.equal(result.acosPercent,null);
 assert.equal(result.targetBelowFinancialFloor,null);
 assert.equal((await executeTool('arthur','analyze_ads',{platform:'shopee',mode:'max_delivery',revenue:0,spend:0})).error,'invalid_tool_arguments');
});
