// Only new requests use this policy. Confirmation uses the recorded bonus.
export const topupPlans = [{amount:2000,bonus:160,percent:8},{amount:5000,bonus:600,percent:12}] as const;
export function topupPlan(amount:number){return topupPlans.find(plan=>plan.amount===amount);}
