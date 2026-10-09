import copy from './english-errors.json';
import {productCategories} from './product-categories';
export function englishErrorText(message:string):string|undefined{
 const known=(copy as Record<string,string>)[message];if(known)return known;
 for(const [prefix,value]of Object.entries(copy))if(prefix.endsWith('：')&&message.startsWith(prefix))return value+message.slice(prefix.length);
 const minimum=message.match(/^(.*?)：適用商品須滿 NT\$(\d+)（類別券只計算該類別商品）。$/);if(minimum)return `${minimum[1]}: Eligible merchandise requires NT$${minimum[2]} (only matching-category merchandise counts).`;
 const api=message.match(/^AI (?:服務回應|查詢失敗（)(\d+)/);if(api)return `AI service returned ${api[1]}; no data changed.`;
 const slash=message.indexOf(' / ');if(slash>=0&&!/[\u3400-\u9fff]/.test(message.slice(slash+3)))return message.slice(slash+3);
 return productCategories.find(c=>c.zh===message)?.en;
}
