export const DEFAULT_DEPARTMENT_STORE_REFUND_FEE_PERCENT=1.55;

export function departmentStoreRefundPrice(taxIncludedJpy:number,taxRatePercent:number,feePercent=DEFAULT_DEPARTMENT_STORE_REFUND_FEE_PERCENT){
 if(!Number.isFinite(taxIncludedJpy)||taxIncludedJpy<=0)return 0;
 if(!Number.isFinite(taxRatePercent)||taxRatePercent<=0)return Math.ceil(taxIncludedJpy);
 const beforeTax=taxIncludedJpy/(1+taxRatePercent/100);
 return Math.ceil(beforeTax*(1+Math.max(0,feePercent)/100));
}
