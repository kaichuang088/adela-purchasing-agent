import {PDFDocument,rgb,StandardFonts} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {stateNames,type ShopOrder} from './commerce-types';
export async function createReceiptPdf(orders:ShopOrder[],fontBytes:Uint8Array){
 const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);const font=await pdf.embedFont(fontBytes,{subset:false});const latin=await pdf.embedFont(StandardFonts.Helvetica);
 pdf.setTitle('Adela’s 代購交易收據與明細');pdf.setAuthor("Adela's Purchasing Agent");
 let page=pdf.addPage([595.28,841.89]),y=788;
 const ink=rgb(.12,.17,.24),muted=rgb(.42,.46,.52),accent=rgb(.85,.24,.18);
 function text(value:string,x=42,size=10,color=ink){page.drawText(value.replace(/[\r\n\t]/g,' '),{x,y,size,font:/^[\x20-\x7e]*$/.test(value)?latin:font,color});}
 function header(){text("Adela's Purchasing Agent",42,18,accent);text('交易收據 / ORDER STATEMENT',286,13);y-=28;text('依已選訂單彙整 · 非政府統一發票',42,9,muted);y-=25;}
 function space(height:number){if(y-height<58){page=pdf.addPage([595.28,841.89]);y=788;header();}}
 function lines(value:string,maxWidth=505,size=10){const result:string[]=[];let line='';for(const c of value){if(c==='\n'||font.widthOfTextAtSize(line+c,size)>maxWidth){result.push(line);line=c==='\n'?'':c;}else line+=c;}if(line)result.push(line);return result;}
 function paragraph(value:string,size=10,color=ink){for(const line of lines(value,505,size)){space(17);text(line,42,size,color);y-=17;}}
 function amount(label:string,n:number){space(22);text(label,42,10);const value='NT$ '+n.toLocaleString('en-US');text(value,553-latin.widthOfTextAtSize(value,11),11);y-=22;}
 header();let total=0,received=0,outstanding=0;
 for(const order of orders){const p=order.pricing!;space(126);page.drawLine({start:{x:42,y},end:{x:553,y},thickness:.7,color:rgb(.85,.87,.90)});y-=23;paragraph(order.requestNo,13);paragraph(order.customerName+' · '+order.email,9,muted);paragraph((stateNames[order.status]?.[0]||order.status)+' · '+(order.paymentMethod==='cod'?'貨到付款':'銀行匯款')+(order.paidAt?' · 收款確認 '+new Date(order.paidAt).toLocaleDateString('zh-TW',{timeZone:'Asia/Taipei'}):' · 尚未確認收款'),9,muted);
 for(const l of p.items){space(78);paragraph(l.nameZh+' / '+l.nameEn+' × '+l.quantity,11);paragraph((l.priceBasis==='allocated_bundle_cost'?'組合拆售分攤成本':l.priceBasis==='local_after_tax_refund'?'當地退稅後價':l.priceBasis==='local_tax_included'?'當地商家含稅現價':'商品原價')+' '+(l.sourceCurrency||'JPY')+' '+(l.sourceAmount??l.originalJpy).toLocaleString()+' / 件',9,muted);amount('商品金額（包含代購費用）',l.goodsTwd+l.feeTwd+l.sizeFeeTwd);}
 amount('配送費',p.shippingTwd);if(p.discountTwd)amount('優惠折抵 / Discount',-p.discountTwd);if(p.creditAppliedTwd)amount('購物金折抵',-p.creditAppliedTwd);amount('此訂單合計',p.totalTwd);paragraph('匯率 '+(p.items[0]?.sourceCurrency||'KRW')+' 1 = TWD '+p.exchangeRate+' · 台幣小數無條件進位',9,muted);
 if(order.eta)paragraph('預計可取貨區間：'+order.eta.slice(0,10)+' – '+(order.etaTo||order.eta).slice(0,10),9,muted);
 if(order.urgent)paragraph('加急訂單 · 優先取貨',9,muted);
 if(order.snackRedeemed)paragraph('韓國小包零食 × 1（30 哩程兌換）',9,muted);
 if(order.status==='cancelled'&&order.refundKind==='store_credit')paragraph('退款已轉為購物金 NT$'+(order.refundAmountTwd||0)+'，下筆自動折抵。',9,muted);
 if(order.status==='refunded')paragraph('此訂單已退款，不計入目前已收款。',9,muted);
 total+=p.totalTwd;if(order.paidAt&&!['refunded','cancelled','rejected'].includes(order.status))received+=p.totalTwd;if(!order.paidAt&&!['refunded','cancelled','rejected'].includes(order.status))outstanding+=p.totalTwd;y-=14;
 }
 space(125);amount('所選 '+orders.length+' 張訂單總額',total);amount('已確認收款（不含已退款）',received);amount('尚待收款',outstanding);paragraph('旅客回報「已匯款」不等於入帳確認。待同意的調價不計入本文件。',9,muted);
 const pages=pdf.getPages();pages.forEach((p,i)=>p.drawText('Adela · '+new Date().toISOString().slice(0,10)+'                                        '+(i+1)+' / '+pages.length,{x:42,y:30,size:8,font:latin,color:muted}));return pdf.save();
}
