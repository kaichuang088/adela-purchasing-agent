export const countries={
 JP:{zh:'日本',en:'Japan',currency:'JPY'},KR:{zh:'韓國',en:'South Korea',currency:'KRW'},
 US:{zh:'美國',en:'United States',currency:'USD'},GB:{zh:'英國',en:'United Kingdom',currency:'GBP'},
 FR:{zh:'法國',en:'France',currency:'EUR'},DE:{zh:'德國',en:'Germany',currency:'EUR'},IT:{zh:'義大利',en:'Italy',currency:'EUR'},
 AU:{zh:'澳洲',en:'Australia',currency:'AUD'},CA:{zh:'加拿大',en:'Canada',currency:'CAD'},
 HK:{zh:'香港',en:'Hong Kong',currency:'HKD'},SG:{zh:'新加坡',en:'Singapore',currency:'SGD'},TH:{zh:'泰國',en:'Thailand',currency:'THB'},CN:{zh:'中國',en:'China',currency:'CNY'},
} as const;
export type Country=keyof typeof countries;
export type Currency=typeof countries[Country]['currency'];
