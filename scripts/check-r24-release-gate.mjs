import fs from 'node:fs/promises';
const catalog=JSON.parse(await fs.readFile('verification/r24/catalog-remaining.json','utf8')),photos=JSON.parse(await fs.readFile('verification/r24/photo-decode.json','utf8')),mobile=JSON.parse(await fs.readFile('verification/r24/mobile/results.json','utf8')),workflow=JSON.parse(await fs.readFile('verification/r24/workflows.json','utf8'));
const state=JSON.parse(await fs.readFile('PROJECT_STATE.json','utf8'));
const inventory=JSON.parse(await fs.readFile('verification/r24/source-check-summary.json','utf8'));
const remaining=catalog.unresolvedIssues,photoReady=photos.failed===0,mobileReady=mobile.allPassed===true||mobile.results?.every(x=>x.passed===true)===true;
const blockers=[];if(remaining!==0)blockers.push(`Catalog has ${remaining} unresolved issues`);if(inventory.photosMissingForDraftReferenceRecords>0)blockers.push(`${inventory.photosMissingForDraftReferenceRecords} draft/reference records still lack exact original photos`);if(!photoReady)blockers.push('Some original product photos do not decode');if(!mobileReady)blockers.push('Mobile checks have not all passed');if(!workflow.checks)blockers.push('Functional workflow checks missing');
// A current balance must come from the owner or a non-lagged authoritative balance.
const credit=state.r24Preparation?.verifiedCurrentCredits;if(!Number.isFinite(credit)||credit-30<750)blockers.push('Current credit balance and750 reserve are not confirmed');
const report={at:new Date().toISOString(),publishReady:blockers.length===0,unresolvedIssues:remaining,blockers,productionDeploymentsThisRound:0,paidModelCallsThisRound:0};await fs.writeFile('verification/r24/release-gate.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
if(!report.publishReady)process.exitCode=1;
