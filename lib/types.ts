import type {Country,Currency} from './countries';
export type Product = {
  id: number; nameZh: string; nameEn: string; categoryZh: string; categoryEn: string;
  descriptionZh: string; descriptionEn: string; priceJpy: number; imageKey: string | null;
  status: string; featured: boolean; sortOrder: number;
};

export type CartItem = {
  productId?: number; nameZh: string; nameEn: string; priceJpy: number; quantity: number;
  variant?: string; sourceUrl?: string; custom?: boolean; lineId?: string;
};

export type Order = {
  id: number; orderNo: string; customerName: string; email: string; phone: string; address: string;
  locale: string; status: string; subtotalJpy: number; exchangeRate: number; serviceFeeTwd: number;
  intlShippingTwd: number; localShippingTwd: number; taxTwd: number; totalTwd: number;
  items: CartItem[]; timeline: Array<{ status: string; at: string; note?: string }>;
  customerNotes: string; adminNotes: string; createdAt: string; updatedAt: string;
};

export type RateInfo = { baseRate: number; rate: number; markupPercent: number; source: string; updatedAt: string };

export const statusOrder = ["pending_confirmation", "quoted", "awaiting_payment", "paid", "purchasing", "shipped_japan", "arrived_taiwan", "completed"];

export const statusLabel: Record<string, { zh: string; en: string }> = {
  pending_confirmation: { zh: "待確認", en: "Pending review" }, quoted: { zh: "已報價", en: "Quoted" },
  awaiting_payment: { zh: "待付款", en: "Awaiting payment" }, paid: { zh: "已付款", en: "Paid" },
  purchasing: { zh: "採購中", en: "Purchasing" }, shipped_japan: { zh: "商家寄出", en: "Shipped by seller" },
  arrived_taiwan: { zh: "已抵台", en: "Arrived in Taiwan" }, completed: { zh: "已完成", en: "Completed" },
  cancelled: { zh: "已取消", en: "Cancelled" },
};

export type PriceSource = {
  deliveryAmount?:number;deliveryConfirmed?:boolean;deliveryConditions?:string;deliveryBasis?:'per_order'|'per_unit';
  exactMatch?: boolean; inStock?: boolean; localJapan?:boolean;localCountry?:Country;currency?:Currency;originalPrice?:number;afterTaxPrice?:number|null; taxFreeForResale?:boolean; taxFreeConditions?:string; taxEvidenceUrl?:string;
  storeName: string; url: string; priceTaxIncludedJpy: number; priceTaxFreeJpy: number | null;
  taxFreeEligible: boolean; capturedAt: string; note: string;
};

export type ProductAnalysis = {
  identifiedNameZh: string; identifiedNameEn: string; brand: string; model: string; category: string;
  confidence: number; taxRatePercent: number; evidenceSummaryZh: string; evidenceSummaryEn: string;
  sources: PriceSource[];
};

export type VerifiedQuote = {
  quantity?: number;
  productNameZh: string; productNameEn: string; storeName: string; purchaseUrl: string;
  priceTaxIncludedJpy: number; priceTaxFreeJpy: number; taxRatePercent: number; taxFreeEligible: boolean;
  exchangeRate: number; serviceFeeTwd: number; internationalShippingTwd: number; localShippingTwd: number;
  notesZh: string; notesEn: string; verifiedAt: string;
};

export type ShoppingRequest = {
  kind?: string; quantity?: number; productId?: number | null;
  id: number; requestNo: string; customerName: string; email: string; note: string; imageKey: string;
  imageName: string; imageType: string; status: string; analysisState: string; identifiedNameZh: string;
  identifiedNameEn: string; aiAnalysis: ProductAnalysis | null; quote: VerifiedQuote | null;
  browserNotifications: boolean; createdAt: string; updatedAt: string;
  events: Array<{ id: number; status: string; titleZh: string; titleEn: string; detailZh: string; detailEn: string; createdAt: string }>;
  notifications: Array<{ id: number; titleZh: string; titleEn: string; bodyZh: string; bodyEn: string; deliveryStatus: string; createdAt: string }>;
};

export const requestStatusOrder = ["submitted", "admin_review", "quoted", "customer_confirmed", "purchasing", "shipped_japan", "arrived_taiwan", "completed"];
export const requestStatusLabel: Record<string, { zh: string; en: string }> = {
  submitted: { zh: "已送出", en: "Submitted" }, admin_review: { zh: "辨識與審核中", en: "Identification & review" },
  quoted: { zh: "報價已完成", en: "Quote ready" }, customer_confirmed: { zh: "顧客已確認", en: "Customer confirmed" },
  purchasing: { zh: "採購中", en: "Purchasing" }, shipped_japan: { zh: "商家已寄出", en: "Shipped by seller" },
  arrived_taiwan: { zh: "商品已抵台", en: "Arrived in Taiwan" }, completed: { zh: "訂單已完成", en: "Completed" },
  cancelled: { zh: "已取消", en: "Cancelled" },
};
