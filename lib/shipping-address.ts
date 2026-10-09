import {ShopError} from './commerce';

export type ShippingAddress={recipient:string;phone:string;postalCode:string;street:string};

export function shippingAddress(value:unknown):ShippingAddress{
 const input=value&&typeof value==='object'?value as Record<string,unknown>:{};
 const recipient=String(input.recipient||'').trim().slice(0,80);
 const phone=String(input.phone||'').replace(/[\s-]/g,'').slice(0,24);
 const postalCode=String(input.postalCode||'').trim().slice(0,10);
 const street=String(input.street||'').trim().slice(0,240);
 if(!recipient||!/^09\d{8}$/.test(phone)||!/^\d{3}(\d{2,3})?$/.test(postalCode)||street.length<6)throw new ShopError('請填寫收件人、台灣手機、郵遞區號與完整配送地址。 / Enter a complete Taiwan delivery address.');
 return{recipient,phone,postalCode,street};
}
