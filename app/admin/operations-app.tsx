'use client';
import {productPhoto} from '@/lib/product-photo';
import {productCode} from '@/lib/product-code';
import {AdminNotifications} from './admin-notifications';
import {PriceReports} from './price-reports';

import {AdminAIHub,ChatGPTMark} from './ai-hub';
import {MemberOrderDesk} from './member-order-desk';
import {orderTask} from '@/lib/admin-tasks';
import {OrderTaskList} from './order-task-list';
import {MemberCreditControls} from './member-credit-controls';
import type {CreditWithdrawal} from '@/app/credit-wallet';
import {VariantEvidenceFields} from "./variant-evidence-fields";
import {PriceReview} from './price-review';
import {PerfumePricingSummary} from './perfume-pricing-summary';
import {CatalogReview} from "./catalog-review";
import {PaymentEvidence} from './payment-evidence';
import {fetchReadJson,HttpResponseError,readJsonResponse} from '@/lib/http-response';
import {ServiceStatus} from './service-status';
import {AIScan} from './ai-scan';
import {NotificationContent} from "@/app/notification-content";
import {RevisionCredit} from "@/app/revision-credit";
import {useStoreLocale} from '@/app/store-language';
import {useAdminText,AdminLanguageSelect} from './admin-language';
import {EmailDeliveryPanel} from './email-delivery-panel';
import {AIBulkCommands} from './ai-bulk-commands';
import {ProductKoreanFields} from './product-korean-fields';
import {ProductImageField} from './product-image-field';
import {OrderResolution} from '@/app/order-resolution';
import {StoreSettings,OfferEditor,AdminOrderTools} from './commerce-controls';
import {availableOrderStates,offerLabel} from '@/lib/commerce-policy';
import { BuyerChat } from "@/app/buyer-chat";
import { OrderProgress } from "@/app/order-tools";
import { OrderStatusBadge } from "@/app/order-status-badge";
import { ItemFulfilment, ProcurementList } from "@/app/item-fulfilment-controls";
import { AdminTopups } from "@/app/topup-controls";
import { ReceiptTools } from "@/app/receipt-tools";
import { AIPricePanel } from "@/app/ai-price-panel";
import { BrandLockup } from "@/app/brand-lockup";
import { PriceBreakdown } from "@/app/price-breakdown";
import { Fragment, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  MoreHorizontal,
  Bot,
  ChevronRight,
  CircleDollarSign,
  Cloud,
  ExternalLink,
  Gift,
  Headphones,
  KeyRound,
  LayoutDashboard,
  Loader2,
  LogOut,
  MessageCircle,
  Package,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  ShoppingBag,
  Store,
  Ticket,
  Truck,
  Upload,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import {
  feeRates,
  stateNames,
  tierNames,
  tiers,
  type Member,
  type Offer,
  type ShopOrder,
  type ShopProduct,
  type Tier,
} from "@/lib/commerce-types";
import { submissionKey } from "@/lib/submission-key";
import {productCategories} from "@/lib/product-categories";
type SettingsData = {
  fees?:typeof feeRates;
  enabledCountries: string[];
  arrivalWindow: {
    from: string;
    to: string;
    eta: string;
  } | null;
  rateMode: string;
  manualRate: number;
  shippingTwd: number;
  paymentInstructions: string;
};
type AdminData = {
  exchange?:{rate:number}|null;
  topups:any[];
  refundCredits:any[];
  creditWithdrawals:CreditWithdrawal[];
  procurement:any[];
  products: ShopProduct[];
  orders: ShopOrder[];
  members: Member[];
  supportThreads: SupportThread[];
  offers: Offer[];
  settings: SettingsData;
  aiConfigured: boolean;
  emailConfigured: boolean;
  emailQueue?: Record<string,number>;
};
type SupportThread={member_id:string;name:string;email:string;status:'ai'|'waiting'|'human';needs_human:number;ai_summary:string;unread_admin:number;unread_member:number;updated_at:string;last_body:string};
type Tab = "procurement" | "ai" | "orders" | "products" | "members" | "member_orders" | "price_reports" | "messages" | "offers" | "notify" | "settings";
const FRONT = process.env.NEXT_PUBLIC_KK_STOREFRONT_URL || "/";
const blankProduct = {
  nameZh: "",
  nameEn: "",
  nameKo: "",
  descriptionKo: "",
  categoryZh: productCategories[0].zh,
  categoryEn: productCategories[0].en,
  descriptionZh: "",
  descriptionEn: "",
  originalJpy: 0,
  taiwanRetailTwd: 0,
  taiwanRetailSource: "",
  imageKey: "",
  imageUrl: "",
  status: "draft",
  addon: false,
  allowedTiers: [...tiers],
  sizeFeeTwd: 0,
  stock: -1,
  arrivalHours: 0,
  purchaseAt: "",purchaseAtTo:"",
  availableFrom: "",
  availableUntil: "",
  variants: [],
  purchaseUrl: "",
  taxRefundEligible: false,
  taxRatePercent: 10,
  taxRefundFeePercent: 1.55,
};
const blankOffer = {
  title: "",
  titleEn: "",
  rate: 8,
  tiers: [...tiers],
  startsAt: "",
  endsAt: "",
  code: "",
  productId: "",
  active: true,
};
const nt = (n: number) => `NT$${n.toLocaleString()}`,
  jy = (n: number) => `¥${n.toLocaleString()}`;
function dateInput(v: string) {
  if (!v) return "";
  const d = new Date(v);
  return Number.isFinite(+d)
    ? new Date(+d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    : "";
}
export default function OperationsApp() {
 const a=useAdminText(),language=useStoreLocale();
  const [lastSync,setLastSync]=useState<string|null>(null),[syncFailed,setSyncFailed]=useState(false);
  const [password, setPassword] = useState(""),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [data, setData] = useState<AdminData | null>(null),
    [tab, setTab] = useState<Tab>(()=>typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('view')==='notify'?'notify':'orders'),
    [moreOpen, setMoreOpen] = useState(false),
    [aiOpen,setAiOpen] = useState(false),
    [catalogSearch,setCatalogSearch] = useState(''),
    [query, setQuery] = useState(""),[orderGroup,setOrderGroup]=useState("open"),[statusFilter,setStatusFilter]=useState("all");
  const [order, setOrder] = useState<ShopOrder | null>(null),
    [product, setProduct] = useState<any | null>(null),
    [member, setMember] = useState<Member | null>(null),
    [offer, setOffer] = useState<any | null>(null),
    [audience, setAudience] = useState<any>(null);
  useEffect(()=>{window.scrollTo(0,0);},[tab]);
  const loading=useRef<{pass:string;promise:Promise<void>}|null>(null);
  async function api(body?: any, pass = password) {
    if(!body)return fetchReadJson<AdminData>("/api/operations",{headers:{"X-KK-Admin-Password":pass},cache:"no-store",credentials:"same-origin"});
    const r = await fetch("/api/operations", {
      method: body ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        "X-KK-Admin-Password": pass,
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    const v = (await readJsonResponse(r)) as AdminData & {
      error?: string;
    };
    if (!r.ok) throw new Error(v.error || "同步失敗");
    return v;
  }
  function load(pass = password) {
    if(loading.current?.pass===pass)return loading.current.promise;
    const promise=loadOnce(pass);loading.current={pass,promise};
    void promise.then(()=>{if(loading.current?.promise===promise)loading.current=null;},()=>{if(loading.current?.promise===promise)loading.current=null;});
    return promise;
  }
  async function loadOnce(pass:string) {
    let v:AdminData;
    try{v=await api(undefined,pass);}catch(error){setSyncFailed(true);throw error;}
    setLastSync(new Date().toISOString());setSyncFailed(false);
    setData(v);
    setReady(true);
    setOrder((o) =>
      o ? v.orders.find((x: ShopOrder) => x.id === o.id) || null : null,
    );
  }
  async function run(fn: () => Promise<void>, success?: string) {
    setBusy(true);
    try {
      await fn();
      if (success) toast.success(a(success));
    } catch (e) {
      toast.error(a(e instanceof Error ? e.message : "操作失敗"));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    const p = sessionStorage.getItem("kk-admin-session") || "";
    if (p) {
      setPassword(p);
      void load(p).catch(error => {if(error instanceof HttpResponseError&&[401,403].includes(error.status))sessionStorage.removeItem("kk-admin-session");});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!ready) return;
    const refresh=()=>{if(!document.hidden)void load().catch(()=>undefined);};
    const timer=setInterval(refresh,15000);window.addEventListener('focus',refresh);
    return()=>{clearInterval(timer);window.removeEventListener('focus',refresh);};
  }, [ready, password]); // eslint-disable-line react-hooks/exhaustive-deps
  const filtered = useMemo(
    () =>
      data?.orders.filter((o) =>
        (orderGroup==='all'||(orderGroup==='resolved'?!!o.receivedAt&&o.status==='completed':orderGroup==='closed'?['cancelled','refunded','rejected'].includes(o.status):!o.receivedAt&&!['cancelled','refunded','rejected','completed'].includes(o.status)))&&(statusFilter==='all'||o.status===statusFilter)&&`${o.requestNo} ${o.customerName} ${o.email} ${o.identifiedNameZh} ${o.identifiedNameEn}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ) || [],
    [data, query,orderGroup,statusFilter],
  );
  async function login(e: FormEvent) {
    e.preventDefault();
    await run(async () => {
      await load(password);
      sessionStorage.setItem("kk-admin-session", password);
    }, "登入成功");
  }
  async function operation(body: any, message: string) {
    await run(async () => {
      await api(body);
      await load();
    }, message);
  }
  if (!ready)
    return (
      <>
        <Toaster richColors position="top-right" />
        <main className="op-login">
          <section>
            <div className="op-logo">
              <BrandLockup />
            </div>
            <p>ADELA / OPERATIONS</p>
            <h1>{a("每一筆訂單，")}<br />{a("都清楚到下一步。")}</h1>
            <div>
              <ShieldCheck />{a("商品、會員、款項與進度共用同一套資料")}</div>
          </section>
          <form onSubmit={login}>
            <AdminLanguageSelect/>
            <small>ADMIN ACCESS</small>
            <h2>{a("管理後台登入")}</h2>
            <p>{a("輸入管理員密碼後進入工作台。")}</p>
            <label>{a("管理員密碼")}<div>
                <KeyRound />
                <input
                  autoFocus
                  required
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
            </label>
            <Button disabled={busy}>
              {busy ? <Loader2 className="spin" /> : <ChevronRight />}{a("進入管理後台")}</Button>
            <a href={FRONT}>{a("返回顧客前台")}<ExternalLink />
            </a>
          </form>
        </main>
      </>
    );
  const stats = {
    review: data!.orders.filter((o) =>
      ["admin_review", "submitted"].includes(o.status),
    ).length,
    payment: data!.orders.filter((o) =>
      ["quoted", "awaiting_payment"].includes(o.status),
    ).length,
    active: data!.orders.filter((o) =>
      ["paid", "purchasing", "purchased", "shipped_japan"].includes(o.status),
    ).length,
  };
  const menus: [Tab, string, any][] = [
    ["orders", "訂單", ShoppingBag],
    ["procurement", "尚未採買", ShoppingBag],
    ["price_reports", "查價回報", Search],
    ["messages", "訊息", MessageCircle],
    ["notify", "通知", Bell],
    ["products", "商品", Store],
    ["ai", "AI", Bot],
    ["members", "會員", Users],
    ["member_orders", "會員代下單", Users],
    ["offers", "優惠", Ticket],
    ["settings", "設定", Settings],
  ];
  return (
    <>
      <Toaster richColors position="top-right" />
      <Dialog open={moreOpen} onOpenChange={setMoreOpen}><DialogContent className="op-more-dialog"><DialogHeader><DialogTitle>{a('管理工具')}</DialogTitle><DialogDescription>{a('選擇要管理的項目')}</DialogDescription></DialogHeader><div className="op-more-grid">{menus.filter(([id])=>!['orders','products','messages','ai'].includes(id)).map(([id,label,Icon])=><button key={id} onClick={()=>{setTab(id);setMoreOpen(false);}}><Icon/><span>{a(label)}{id==='members'&&(data!.creditWithdrawals||[]).some(r=>['requested','processing'].includes(r.status))?' · 有轉帳退款申請':''}</span><ChevronRight/></button>)}</div></DialogContent></Dialog>
      <button type="button" className="adela-ai-fab" aria-label={a('開啟 AI 工作助理')} onClick={()=>setAiOpen(true)}><ChatGPTMark/><span>AI</span></button>
      {aiOpen&&<section role="dialog" aria-modal="false" onKeyDown={e=>{if(e.key==='Escape')setAiOpen(false);}} aria-label={a('AI 工作助理')} className="adela-ai-floating"><button className="adela-ai-close" type="button" aria-label={a('關閉 AI 工作助理')} onClick={()=>setAiOpen(false)}>×</button><AdminAIHub password={password} configured={data!.aiConfigured} refresh={load} rate={data!.exchange?.rate} standardRate={data!.settings.fees?.standard?.catalog}/></section>}
      <main className="op-shell">
        <aside>
          <a className="op-brand" href="/">
            <BrandLockup compact />
          </a>
          <nav>
            {menus.map(([id, label, Icon]) => {
              const count=id==='members'?(data!.creditWithdrawals||[]).filter(r=>['requested','processing'].includes(r.status)).length:id==='procurement'?data!.procurement.reduce((n,g)=>n+g.quantity,0):id==='messages'?data!.supportThreads.reduce((n,t)=>n+t.unread_admin,0):(id==='orders'||id==='notify')?data!.orders.filter(o=>!!orderTask(o)).length:0;
              return <Fragment key={id}>{['orders','products','members','settings'].includes(id)&&<span className="op-nav-heading">{a(id==='orders'?'每日工作':id==='products'?'商品與選品':id==='members'?'會員經營':'商店設定')}</span>}<button className={(tab===id?'active ':'')+(['orders','products','messages','ai'].includes(id)?'op-nav-primary':'op-nav-secondary')+(id==='ai'?' adela-ai-nav':'')} onClick={()=>setTab(id)}>
                <span className="adela-nav-icon">{id==='ai'?<ChatGPTMark/>:<Icon/>}{count>0&&<strong className="op-unread-count" aria-label={a('未讀通知')+': '+count}>{count>99?'99+':count}</strong>}</span><span>{a(label)}</span>
              </button></Fragment>;
            })}
            <button className={'op-nav-more '+(!['orders','products','messages','ai'].includes(tab)?'active':'')} onClick={()=>setMoreOpen(true)} aria-expanded={moreOpen}><span className="adela-nav-icon"><MoreHorizontal/></span><span>{a('更多')}</span></button>
          </nav>
          <div className={"op-sync"+(syncFailed?" is-stale":"")} role="status">
            <i />
            <span>
              <b>{a(syncFailed?"連線中斷，正在顯示先前資料":"資料更新")}</b>
              <small>{a("每 15 秒重新讀取")}</small>{lastSync&&<small>{a("最近成功更新：")}<time dateTime={lastSync}>{new Date(lastSync).toLocaleTimeString(language==='ko'?'ko-KR':language==='en'?'en-GB':'zh-TW',{timeZone:'Asia/Taipei'})}</time></small>}
            </span>
          </div>
          <button
            className="op-logout"
            onClick={() => {
              sessionStorage.removeItem("kk-admin-session");
              setReady(false);
              setPassword("");
            }}
          >
            <LogOut />{a("登出")}</button>
        </aside>
        <section className="op-main">
          <header>
            <AdminLanguageSelect/>
            <div>
              <small>ADELA / {tab.toUpperCase()}</small>
              <h1>{a(menus.find((m) => m[0] === tab)?.[1]||'')}{language==='zh'?a("管理"):''}</h1>
            </div>
            <div>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void run(() => load())}
              >
                <RefreshCw />{a("同步")}</Button>
              <a href={FRONT} target="_blank">{a("前台")}<ExternalLink />
              </a>
            </div>
          </header>
          <div className="op-content">
            {tab === "procurement" && <><ProcurementList groups={data?.procurement||[]} send={async body=>{await api(body);await load();}}/>{data!.orders.some(o=>o.kind==='custom'&&o.sellerReviewedAt&&!o.paidAt&&['awaiting_payment','payment_review','awaiting_cod'].includes(o.status))&&<section className="op-panel adela-member-desk"><h3>{a('已核價購買清單・待付款')}</h3><p>{a('已完成賣家核價；匯款核對前不會標記已付款或已買到。')}</p>{data!.orders.filter(o=>o.kind==='custom'&&o.sellerReviewedAt&&!o.paidAt&&['awaiting_payment','payment_review','awaiting_cod'].includes(o.status)).map(o=><button className="adela-pending-purchase" key={o.id} onClick={()=>setOrder(o)}><span>{o.identifiedNameZh}<small>{o.customerName} · {o.requestNo}</small></span><strong>NT${o.pricing?.totalTwd.toLocaleString()}</strong><ChevronRight/></button>)}</section>}</>}
            {tab === "orders" && (
              <><details className="op-legacy-topups"><summary>舊儲值紀錄（已停止販售）</summary><AdminTopups items={data?.topups||[]} send={async body=>{await api(body);await load();}}/></details>
                <div className="op-hero">
                  <div>
                    <p>ORDER DESK</p>
                    <h2>{a("今天先處理什麼？")}</h2>
                    <span>{a("報價、付款、採買與領貨日期都在同一頁完成。")}</span>
                  </div>
                  <div className={data!.aiConfigured ? "ok" : ""}>
                    <Bot />
                    <b>
                      {data!.aiConfigured ? a("AI 連線資料已設定") : a("AI 尚未啟用")}
                    </b>
                    <small>
                      {data!.aiConfigured
                        ? a("仍需實際查詢驗證連線")
                        : a("尚未設定服務金鑰")}
                    </small>
                  </div>
                </div>
                <EmailDeliveryPanel configured={data!.emailConfigured} queue={data!.emailQueue||{}} password={password} refresh={load}/>
                <div className="op-stats">
                  <article>
                    <CircleDollarSign />
                    <span>{a("等待報價")}</span>
                    <b>{stats.review}</b>
                  </article>
                  <article>
                    <Package />
                    <span>{a("待確認／付款")}</span>
                    <b>{stats.payment}</b>
                  </article>
                  <article>
                    <Truck />
                    <span>{a("採買與配送中")}</span>
                    <b>{stats.active}</b>
                  </article>
                  <article>
                    <LayoutDashboard />
                    <span>{a("全部訂單")}</span>
                    <b>{data!.orders.length}</b>
                  </article>
                </div>
                <div className="op-panel">
                  <div className="op-panel-head">
                    <div>
                      <h3>{a("全部訂單")}</h3>
                      <ReceiptTools
                        orders={data!.orders}
                        adminPassword={password}
                      />
                      <p>{a("點入訂單即可報價或更新狀態")}</p>
                    </div>
                    <label>
                      <Search />
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={a("搜尋單號、會員或商品")}
                      />
                    </label>
                  </div>
                  <div className="op-order-filters"><div className="op-filter-buttons">{[['open','未解決'],['resolved','已解決・已取貨'],['closed','已取消／退款／拒絕'],['all','全部']].map(([v,label])=><button key={v} type="button" aria-pressed={orderGroup===v} className={orderGroup===v?'selected':''} onClick={()=>setOrderGroup(v)}>{a(label)}</button>)}</div><select aria-label={a("篩選訂單狀態")} value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">{a("全部狀態")}</option>{Object.entries(stateNames).map(([v,label])=><option key={v} value={v}>{a(label[0])}</option>)}</select></div><div className="op-order-head">
                    <span>{a("訂單與會員")}</span>
                    <span>{a("商品")}</span>
                    <span>{a("金額")}</span>
                    <span>{a("付款")}</span>
                    <span>{a("進度")}</span>
                    <span />
                  </div>
                  {filtered.map((o) => (
                    <button
                      className="op-order op-order-v8"
                      key={o.id}
                      onClick={() => setOrder(o)}
                    >
                      <span className="op-order-identity">
                        <b>{o.requestNo}</b><time dateTime={o.createdAt}>{new Date(o.createdAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false})}</time>
                        <small>
                          {o.customerName} · {o.email}
                        </small>
                      </span>
                      <span className="op-order-product">
                        {o.pricing?.items?.[0]?.imageUrl?<img src={o.pricing.items[0].imageUrl} alt="" loading="lazy" onError={e=>{e.currentTarget.style.display='none';}}/>:<Package aria-hidden="true"/>}<span>
                        <b>{(language==='zh'?o.identifiedNameZh:o.identifiedNameEn||o.identifiedNameZh) || a("等待辨識商品")}</b>
                        <small>
                          {o.kind === "catalog" ? a("販售商品") : a("照片客製")}{o.urgent&&' · 加急'}{o.pricing&&' · '+o.pricing.items.reduce((n,i)=>n+i.quantity,0)+' '+a('件商品')}
                        </small></span>
                      </span>
                      <strong>
                        {o.pricing ? nt(o.pricing.totalTwd) : a("待報價")}
                      </strong>
                      <span className={o.paidAt ? "op-payment paid" : o.status==='payment_review' ? "op-payment review" : "op-payment"}>
                        {o.status==='cancelled'?(o.refundAmountTwd?a("已退購物金"):a("已取消")):o.paidAt ? a("已付款") : o.status==='payment_review' ? a("待核對") : a("未付款")}
                      </span>
                      <OrderStatusBadge status={o.status}/>
                      <ChevronRight />
                    </button>
                  ))}
                  {!filtered.length && (
                    <div className="op-empty">{a("沒有符合的訂單")}</div>
                  )}
                </div>
              </>
            )}
            {tab === "ai" && <AdminAIHub password={password} configured={data!.aiConfigured} refresh={load} rate={data!.exchange?.rate} standardRate={data!.settings.fees?.standard?.catalog}/>}
            {tab === "products" && (
              <>
                <div className="op-title">
                  <div>
                    <p>CATALOG</p>
                    <h2>{a("販售商品")}</h2>
                    <span>{a("新增與編輯一律輸入韓元原價 KRW。")}</span>
                  </div>
                  <Button onClick={() => setProduct({ ...blankProduct })}>
                    <Plus />{a("新增商品")}</Button>
                </div>

                <label className="adela-catalog-search">{a('搜尋販售商品')}<input type="search" value={catalogSearch} onChange={e=>setCatalogSearch(e.target.value)} placeholder={a('名稱、品牌、商品 ID 或規格 ID')}/></label>
                <CatalogReview products={data!.products} rate={data!.exchange?.rate} onEdit={p=>setProduct({...p,originalJpy:p.taxIncludedJpy||p.priceJpy})}/><div className="op-card-grid">
                  {data!.products.filter(p=>{const term=catalogSearch.trim().toLowerCase().replace(/^#/,'');if(/^\d+(?:-\d+)?$/.test(term))return [String(p.id),...p.variants.map(v=>productCode(p,v.id))].includes(term);return !term||[p.nameZh,p.nameEn,p.brand||'',String(p.id),...p.variants.flatMap(v=>[v.labelZh,v.labelEn,productCode(p,v.id)])].some(value=>value.toLowerCase().includes(term));}).map((p) => (
                    <article className="op-product" key={p.id}>
                      {p.imageKey||p.imageUrl?<img
                        src={productPhoto(p)}
                        alt={language==='ko'?(p.nameKo||p.nameEn||p.nameZh):language==='en'?(p.nameEn||p.nameZh):p.nameZh}
                      />:<span className="op-image-pending">{a("圖片待核對")}</span>}
                      <div>
                        <em>
                          {p.status === "active"
                            ? a("販售中")
                            : p.status === "paused"
                              ? a("暫停販售")
                              : p.status === "discontinued"
                                ? a("已停售")
                                : p.status === "research" ? a("資料待核實") : a("草稿")}
                        </em>
                        <h3>{language==='ko'?(p.nameKo||p.nameEn||p.nameZh):language==='en'?(p.nameEn||p.nameZh):p.nameZh}</h3>
                        <small>{a('商品 ID')} #{productCode(p)}</small><strong>{p.priceJpy>1?`₩${p.priceJpy.toLocaleString()}`:a("價格待核對")}</strong>
                        <PerfumePricingSummary product={p} rate={data!.exchange?.rate} fees={data!.settings.fees}/><small>
                          {p.addon ? a("加購商品 · ") : ""}
                          {p.stock < 0 ? a(p.stockQuantityVerified===false?"商店剩餘數量未公開":"未設定接單上限") : a('庫存 {count}',{count:p.stock})}
                        </small>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => {
                          const category=productCategories.find(category=>category.zh===p.categoryZh)||productCategories[8];
                          setProduct({ ...p, originalJpy: p.taxIncludedJpy||p.priceJpy, categoryZh:category.zh, categoryEn:category.en });
                        }}
                      >{a("編輯")}</Button>
                    </article>
                  ))}
                </div>
              </>
            )}
            {tab === "member_orders" && <><div className="op-title"><div><p>MEMBER ORDERS</p><h2>{a('會員代下單')}</h2><span>{a('可選多個商品，會員會收到待付款訂單通知。')}</span></div></div><MemberOrderDesk password={password} members={data!.members} products={data!.products} refresh={load}/></>}
            {tab === "price_reports" && <PriceReports password={password} orders={data!.orders} members={data!.members} refresh={load} onOrder={setOrder}/>}
            {tab === "members" && (
              <>
                <div className="op-title">
                  <div>
                    <p>MEMBERS</p>
                    <h2>{a("會員與哩程")}</h2>
                    <span>{a("金鑽會員僅由後台授予，無消費門檻、代購費 0%，可貨到付款。消費與哩程只在收款確認後累計。")}</span>
                  </div>
                </div>

                <div className="op-panel">
                  {data!.members.map((m) => (
                    <div className="op-member-row" key={m.id}>
                      <button
                        className="op-member"
                        key={m.id}
                        onClick={() => setMember(m)}
                      >
                        <span className={`tier-${m.tier}`}>
                          {a(tierNames[m.tier][0])}
                        </span>
                        <div>
                          <b>{m.name}</b>
                          <small>{m.email}</small>
                        </div>
                        <strong><small>{a("累計消費")}</small>{jy(m.spendKrw||0)}</strong>
                        <strong><small>{a("會員哩程")}</small>{m.miles}{a("哩程")}</strong>
                        <ChevronRight />
                      </button>
                      <MemberCreditControls member={m} credits={(data!.refundCredits||[]).filter(c=>c.member_id===m.id)} requests={(data!.creditWithdrawals||[]).filter(r=>r.member_id===m.id)} send={async body=>{await api(body);await load();}}/>
                      <BuyerChat
                        memberId={m.id}
                        name={m.name}
                        adminPassword={password}
                      />
                    </div>
                  ))}
                </div>
              </>
            )}
            {tab === "messages" && (
              <><DirectMessage data={data!} adminPassword={password}/><SupportInbox threads={data!.supportThreads || []} adminPassword={password} configured={data!.aiConfigured} /></>
            )}
            {tab === "offers" && (
              <>
                <div className="op-title">
                  <div>
                    <p>PROMOTIONS</p>
                    <h2>{a("促銷與優惠券")}</h2>
                    <span>{a("可設定代購費優惠、商品折數或指定幣別折抵。")}</span>
                  </div>
                  <Button onClick={() => setOffer({ ...blankOffer })}>
                    <Plus />{a("新增優惠")}</Button>
                </div>
                <div className="op-card-grid">
                  {data!.offers.map((o) => (
                    <article className="op-offer" key={o.id}>
                      <Gift />
                      <div>
                        <em>{o.code ? a("優惠碼 {code}",{code:o.code}) : a("首頁限時活動")}</em>
                        <h3>{language==='zh'?o.title:o.titleEn||o.title}</h3>
                        <p>
                          {o.tiers.map((t) => a(tierNames[t][0])).join("、")} ·
                          {offerLabel(o,language)}
                        </p>
                        <small>
                          {new Date(o.startsAt).toLocaleString(language==='ko'?'ko-KR':language==='en'?'en-GB':'zh-TW',{timeZone:'Asia/Taipei'})} —{" "}
                          {new Date(o.endsAt).toLocaleString(language==='ko'?'ko-KR':language==='en'?'en-GB':'zh-TW',{timeZone:'Asia/Taipei'})}
                        </small>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() =>
                          setOffer({
                            ...o,
                            productId: o.productId || "",
                            startsAt: dateInput(o.startsAt),
                            endsAt: dateInput(o.endsAt),
                          })
                        }
                      >{a("編輯")}</Button>
                    </article>
                  ))}
                </div>
              </>
            )}
            {tab === "notify" && (
              <><AdminNotifications password={password}/><NotifyPanel
                data={data!}
                onSelectOrder={setOrder}
                adminPassword={password}
                busy={busy}
                api={api}
                load={load}
                setAudience={setAudience}
                audience={audience}
                run={run}
              /></>
            )}
            {tab === "settings" && (
              <><ServiceStatus password={password}/><StoreSettings data={data!} busy={busy} save={operation} /></>
            )}
          </div>
        </section>
      </main>
      <OrderDialog
        value={order}
        adminPassword={password}
        aiConfigured={data!.aiConfigured}
        busy={busy}
        close={() => setOrder(null)}
        save={operation}
        publish={async id=>{const source=data!.orders.find(o=>o.id===id);if(!source?.pricing)return;const line=source.pricing.items[0];setOrder(null);setProduct({...blankProduct,requestId:id,nameZh:line.nameZh,nameEn:line.nameEn,originalJpy:line.originalJpy,imageKey:source.imageKey,purchaseUrl:line.sourceUrl,stock:0,status:'draft',initialEditMode:'ai'});}}
      />
      <ProductDialog
        rate={data!.exchange?.rate}
        standardRate={data!.settings.fees?.standard?.catalog}
        value={product}
        aiConfigured={data!.aiConfigured}
        busy={busy}
        close={() => setProduct(null)}
        save={async (b) => {
          await run(async () => {
            await api({ action: "product", ...b });
            await load();
            setProduct(null);
          }, "商品已儲存並同步");
        }}
        apiPassword={password}
        orders={data!.orders}
      />
      <MemberDialog
        value={member}
        busy={busy}
        close={() => setMember(null)}
        save={async (b) => {
          await run(async () => {
            await api({ action: "member", ...b });
            await load();
            setMember(null);
          }, "會員資料已更新");
        }}
      />
      <OfferEditor
        members={data?.members||[]}
        value={offer}
        products={data!.products}
        busy={busy}
        close={() => setOffer(null)}
        save={async (b) => {
          await run(async () => {
            await api({ action: "offer", ...b });
            await load();
            setOffer(null);
          }, "優惠已儲存");
        }}
      />
    </>
  );
}
export function OrderDialog({
  value,
  busy,
  close,
  save,
  publish,
  aiConfigured,
  adminPassword,
}: {
  value: ShopOrder | null;
  busy: boolean;
  close: () => void;
  save: (b: any, m: string) => Promise<void>;
  publish: (id: number) => Promise<void>;
  aiConfigured: boolean;
  adminPassword: string;
}) {
 const a=useAdminText(),language=useStoreLocale();
  const [draft, setDraft] = useState<any>({}),
    [section, setSection] = useState("quote"),
    [publishAfterReview,setPublishAfterReview] = useState(false),
    [sourceConfirmed,setSourceConfirmed] = useState(false),
    [reference, setReference] = useState(""),
    [autoStarted, setAutoStarted] = useState<number | null>(null);
  useEffect(() => {
    if (value) {
      setSourceConfirmed(false);
      setDraft({
        nameZh: value.identifiedNameZh,
        nameEn: value.identifiedNameEn,
        originalJpy: value.pricing?.items[0]?.originalJpy || 0,
        purchaseUrl: value.pricing?.items[0]?.sourceUrl || "",
        sizeFeeTwd:
          (value.pricing?.items[0]?.sizeFeeTwd || 0) /
          (value.pricing?.items[0]?.quantity || 1),
        items: value.pricing?.items.map((l) => ({
          ...l,
          sizeFeeTwd: l.sizeFeeTwd / l.quantity,
        })),
        status: value.status,
        paymentState: value.paidAt ? "paid" : "unpaid",
        paymentReference: value.paymentReference,
        eta: value.eta,etaTo:value.etaTo||value.eta,
        reason: "",
      });
      setSection(value.status === "payment_review" || value.paymentReportedAt ? "progress" : value.kind === "custom" ? "quote" : "progress");
      setPublishAfterReview(true);
      setReference("");
      setAutoStarted(null);
    }
  }, [value?.id]);
  useEffect(() => {
    if (
      !value ||
      value.kind !== "custom" ||
      !aiConfigured ||
      value.aiAnalysis ||
      value.analysisState === "analyzing" ||
      autoStarted === value.id ||
      value.purchasedAt ||
      ["completed", "cancelled", "refunded", "rejected"].includes(value.status)
    )
      return;
    setAutoStarted(value.id);
    void save({ action: "analyze", id: value.id }, "AI 已自動完成辨識與查價");
  }, [
    value?.id,
    value?.analysisState,
    value?.aiAnalysis,
    aiConfigured,
    autoStarted,
  ]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!value) return null;
  const patch = (k: string, v: any) => setDraft((d: any) => ({ ...d, [k]: v })),
    locked =
      !!value.purchasedAt ||
      [
        "purchased",
        "completed",
        "cancelled",
        "refunded",
        "rejected",
        "shipped_japan",
        "arrived_taiwan",
      ].includes(value.status);
  const pending = value.revisions?.find((r) =>
    ["pending", "accepted"].includes(r.status),
  );
  const dirtyPrice = async (e: FormEvent) => {
    e.preventDefault();
    await save(
      {
        action: "quote",
        id: value.id,
        ...draft,
        publishAfterReview: value.kind === 'custom' && !value.pricing && publishAfterReview && !!value.imageKey && /^https:\/\//.test(draft.purchaseUrl||''),
        items:
          value.pricing && value.pricing.items.length > 1
            ? draft.items
            : undefined,
      },
      value.paidAt ? "調價已送出，等待旅客確認" : "報價已同步給旅客",
    );
  };
  return (
    <Dialog open onOpenChange={(o) => !o && close()}>
      <DialogContent className="op-dialog op-order-dialog">
        <DialogHeader>
          <DialogTitle>{value.requestNo}</DialogTitle>
          <DialogDescription>
            {value.customerName} · {value.email}
          </DialogDescription>
        </DialogHeader>
        <OrderResolution order={value} />
        <div className="op-order-summary">
          <img
            src={
              value.pricing?.items[0]?.imageUrl || (value.imageKey && !value.imageKey.startsWith("catalog-") ? `/api/media/${value.imageKey}` : "/kk-hero.png")
            }
            alt={a("商品照片")}
          />
          <div>
            <div className="op-summary-badges">
              <OrderStatusBadge status={value.status}/><em>{value.kind === "catalog" ? a("販售商品") : a("照片客製")}</em>
              <span className={value.paidAt&&!["cancelled","refunded"].includes(value.status)?"op-payment paid":value.status==='payment_review'?"op-payment review":"op-payment"}>
                {value.status==="cancelled"?(value.refundKind==="store_credit"&&value.refundAmountTwd?a("已退購物金"):a("已取消")):value.status==="refunded"?a("已退款"):value.paidAt?a("已付款"):value.status==='payment_review'?a("待核對"):a("未付款")}
              </span>
            </div>
            <h3>{(language==='zh'?value.identifiedNameZh:value.identifiedNameEn||value.identifiedNameZh) || a("等待辨識商品")}</h3>
            <p>{value.note}</p>
            <b>{value.pricing ? nt(value.pricing.totalTwd) : a("尚未報價")}</b>
          </div>
        </div>
        {value.memberId && (
          <BuyerChat
            memberId={value.memberId}
            name={value.customerName}
            orderId={value.id}
            adminPassword={adminPassword}
          />
        )}
        <div className="op-detail-tabs" role="tablist" aria-label={a("訂單操作")}>
          {[
            ["quote", "AI 與報價"],
            ["progress", "付款與採買"],
            ["history", "明細與紀錄"],
          ].map(([id, label]) => (
            <button
              role="tab"
              aria-selected={section === id}
              key={id}
              onClick={() => setSection(id)}
            >
              {a(label)}
            </button>
          ))}
        </div>
        {section === "quote" && (
          <div className="op-detail-stack">
            {value.kind === "custom" && (
              <AIPricePanel
                analysis={value.aiAnalysis}
                state={value.analysisState}
                configured={aiConfigured}
                busy={busy}
                locked={locked}
              />
            )}
            {pending && (
              <section className="kk-revision">
                <h3>
                  {pending.status === "pending"
                    ? a("等待旅客同意調價")
                    : a("旅客已同意，待結清價差")}
                </h3>
                <p>{pending.reason}</p>
                <div>
                  <span>{nt(pending.previous.totalTwd)}</span>→
                  <strong>{nt(pending.proposed.totalTwd)}</strong>
                </div>
                <p>
                  {pending.proposed.totalTwd >= pending.previous.totalTwd
                    ? a("應補款")
                    : a("應退款")}{" "}
                  {nt(
                    Math.abs(
                      pending.proposed.totalTwd - pending.previous.totalTwd,
                    ),
                  )}
                </p>
                <RevisionCredit revision={pending}/>{pending.status === "accepted" && (
            <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void save(
                        {
                          action: "settle_revision",
                          id: pending.id,
                          reference,
                        },
                        "價差已核對，新報價已生效",
                      );
                    }}
                  >
                    <label>{a("補款／退款核對資訊")}<input
                        required
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                        placeholder={a("核對實際款項後填寫參考資訊")}
                      />
                    </label>
                    <Button disabled={busy}>{a("確認價差已結清")}</Button>
                  </form>
                )}
              </section>
            )}
            {value.kind==='custom'&&value.status==='admin_review'&&value.pricing&&<section className="op-form adela-seller-review"><h3>{a('買家已接受預估總價，待賣家核對')}</h3><strong>NT${value.pricing.totalTwd.toLocaleString()} · {a('已含代購費')}</strong><p>{a('請於 24 小時內核對照片、規格、現價及必要運費。原價確認後加入購買清單並通知買家付款；若改價，請使用下方調價流程，買家必須再次接受。')}</p>{value.sellerReviewDueAt&&<p>{a('核價期限')}：{new Date(value.sellerReviewDueAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})}</p>}<label className="op-check"><input type="checkbox" checked={sourceConfirmed} onChange={e=>setSourceConfirmed(e.target.checked)}/>{a('已核對商品照片、正確規格、韓國現價與必要運費')}</label><Button disabled={busy||!sourceConfirmed} onClick={()=>void save({action:'approve_photo',id:value.id,approvedTotal:value.pricing!.totalTwd,approvedAt:value.pricing!.pricedAt,sourceConfirmed:true},'已核價並加入購買清單；尚未確認收款')}>{a('確認此總價，加入購買清單')}</Button></section>}
            {!locked && !pending && (
              <form className="op-form" onSubmit={dirtyPrice}>
                <div className="op-form-title">
                  <h3>{value.pricing ? a("調整商品報價") : a("商品報價")}</h3>
                  <span>
                    {value.paidAt ? a("已付款 · 調價須旅客確認") : a("採買前可調整")}
                  </span>
                </div>
                {value.pricing && value.pricing.items.length > 1 ? (
                  draft.items?.map((l: any, i: number) => (
                    <fieldset key={i}>
                      <legend>
                        {l.nameZh} × {l.quantity}{a("· 代購費")}{l.feeRate}%
                      </legend>
                      <div className="op-two">
                        <label>{a("原價 KRW")}<input
                            type="number"
                            min="1"
                            step="1"
                            required
                            value={l.originalJpy}
                            onChange={(e) =>
                              patch(
                                "items",
                                draft.items.map((x: any, j: number) =>
                                  j === i
                                    ? { ...x, originalJpy: +e.target.value }
                                    : x,
                                ),
                              )
                            }
                          />
                        </label>
                        <label>{a("每件尺寸處理費 TWD")}<input
                            type="number"
                            min="0"
                            value={l.sizeFeeTwd}
                            onChange={(e) =>
                              patch(
                                "items",
                                draft.items.map((x: any, j: number) =>
                                  j === i
                                    ? { ...x, sizeFeeTwd: +e.target.value }
                                    : x,
                                ),
                              )
                            }
                          />
                        </label>
                      </div>
                    </fieldset>
                  ))
                ) : (
                  <>
                    <div className="op-two">
                      <label>{a("商品名稱")}<input
                          value={draft.nameZh || ""}
                          onChange={(e) => patch("nameZh", e.target.value)}
                          required
                        />
                      </label>
                      <label>{a("英文名稱")}<input
                          value={draft.nameEn || ""}
                          onChange={(e) => patch("nameEn", e.target.value)}
                        />
                      </label>
                    </div>
                    <div className="op-two">
                      <label>{a("原價 KRW")}<input
                          type="number"
                          min="1"
                          step="1"
                          value={draft.originalJpy || ""}
                          onChange={(e) =>
                            patch("originalJpy", +e.target.value)
                          }
                          required
                        />
                      </label>
                      <label>{a("每件尺寸處理費 TWD")}<input
                          type="number"
                          min="0"
                          value={draft.sizeFeeTwd || 0}
                          onChange={(e) => patch("sizeFeeTwd", +e.target.value)}
                        />
                      </label>
                    </div>
                    <label>{a("購買來源網址")}<input
                        type="url"
                        value={draft.purchaseUrl || ""}
                        onChange={(e) => patch("purchaseUrl", e.target.value)}
                      />
                    </label>
                  </>
                )}
                {value.pricing && (
                  <>
                    <p className="op-help">{a("原訂單會員費率與匯率會保留。已付款訂單在旅客同意、價差結清後才會變更新總額。")}</p>
                    <label>{a("調價原因")}<textarea
                        required
                        rows={2}
                        value={draft.reason || ""}
                        onChange={(e) => patch("reason", e.target.value)}
                        placeholder={a("例如：商家調整售價或規格變更")}
                      />
                    </label>
                  </>
                )}
                {value.kind === 'custom' && !value.pricing && <label className="op-check"><input type="checkbox" checked={publishAfterReview} onChange={e=>setPublishAfterReview(e.target.checked)} disabled={!value.imageKey||!/^https:\/\//.test(draft.purchaseUrl||'')}/>{a("賣家確認報價後，同步上架到商品庫（預設勾選，可取消；需有商品照片及韓國購買網址）")}</label>}
                <Button disabled={busy}>
                  {busy ? <Loader2 className="spin" /> : null}
                  {value.pricing ? a("送出調價通知") : a("儲存並送出報價")}
                </Button>
              </form>
            )}
            {locked && (
              <p className="op-help">{a("商品已買到或訂單已結案，價格已鎖定。")}</p>
            )}
            {value.kind === "custom" && value.pricing && (
              <Button
                type="button"
                variant="outline"
                disabled={busy || !!pending || value.status==='admin_review'}
                onClick={() => void publish(value.id)}
              >
                <Store />{a("建立公開商品草稿・核對規格與來源後上架")}</Button>
            )}
          </div>
        )}
        {section === "progress" && (
          <div className="op-detail-stack"><AdminOrderTools order={value} adminPassword={adminPassword} busy={busy} save={save}/>
            {value.shippingAddress&&<section className="op-form"><h3>{a("台灣配送地址")}</h3><p>{value.shippingAddress.recipient} · {value.shippingAddress.phone}</p><p>{value.shippingAddress.postalCode} {value.shippingAddress.street}</p></section>}
            <div className="op-form op-payment-form">
              <div className="op-form-title">
                <h3>{a("付款核對")}</h3>
                <span className={value.paidAt&&!["cancelled","refunded"].includes(value.status)?"op-payment paid":value.status==='payment_review'?"op-payment review":"op-payment"}>
                  {value.paidAt ? a("已確認收到") : value.paymentReportedAt ? a("待核對") : a("等待買家回報")}
                </span>
              </div>
              <div className="op-payment-overview"><div><small>{a("本單應收金額")}</small><strong>NT${value.pricing?.totalTwd.toLocaleString() ?? "—"}</strong><span>{value.requestNo}</span></div><dl><div><dt>{a("買家")}</dt><dd>{value.customerName}<small>{value.email}</small></dd></div><div><dt>{a("付款方式")}</dt><dd>{a(value.paymentMethod === "cod" ? "貨到付款" : "銀行轉帳")}</dd></div><div><dt>{a("已折抵購物金")}</dt><dd>NT${(value.pricing?.creditAppliedTwd || 0).toLocaleString()}</dd></div><div><dt>{a("匯款末五碼")}</dt><dd className="op-bank-reference">{value.paymentReference || "—"}</dd></div></dl></div>
              <PaymentEvidence id={value.paymentPhotoId||null} password={adminPassword}/>
              {value.paymentMethod === "transfer" && <p className="op-help">{a("買家匯款帳號末五碼：")}<strong>{value.paymentReference || a("尚未提供")}</strong>{value.paymentReportedAt && <>{a("· 回報時間：")}{new Date(value.paymentReportedAt).toLocaleString(language==='ko'?'ko-KR':language==='en'?'en-GB':'zh-TW',{timeZone:'Asia/Taipei'})}</>}</p>}
              {!value.paidAt && value.paymentReportedAt && <><label>{a("未收到款項時的通知說明")}<textarea value={draft.reason || ""} onChange={(e) => patch("reason", e.target.value)} rows={2} placeholder={a("例如：目前尚未查到此筆入帳，請確認帳號及匯款是否成功。")}/></label><div className="op-actions"><Button type="button" variant="outline" disabled={busy || !draft.reason?.trim()} onClick={()=>void save({action:"payment_state",id:value.id,paid:false,reason:draft.reason},"已通知買家尚未收到款項")}>{a("未收到・通知買家重報")}</Button><Button type="button" disabled={busy} onClick={()=>void save({action:"payment_state",id:value.id,paid:true},"已確認收到款項並通知買家")}>{a("已核對・確認收款")}</Button></div></>}
              {!value.paidAt && !value.paymentReportedAt && <p className="op-help">{a("買家尚未按「我已付款」，後台不能先行變更付款狀態。")}</p>}
              {value.paidAt && <p className="op-help">{a("付款已核對完成。若後續需退回款項，請使用訂單取消／退款流程。")}</p>}
            </div>
            <form
              className="op-form"
              onSubmit={async (e) => {
                e.preventDefault();
                await save(
                  {
                    action: "status",
                    id: value.id,
                    status: draft.status,
                    paymentReference: draft.paymentReference,
                    reason: draft.reason,
                  },
                  "訂單進度與通知已同步",
                );
              }}
            >
              {(value as any).adminNotes?.length>0&&<section className="adela-order-private-notes"><h3>{a('內部備註（買家不可見）')}</h3>{(value as any).adminNotes.map((n:any)=><p key={n.id}>{n.body}</p>)}</section>}<h3>{a("採買與配送進度")}</h3><p className="op-auto-status">{a("採買中由系統依訂單的採買開始日自動更新；賣家只需在實際買到商品後回報。")}<br/>{a("本單採買開始：")}{value.purchaseAt?new Date(value.purchaseAt).toLocaleString("zh-TW",{timeZone:"Asia/Taipei"}):a("尚未設定")}</p>{value.purchasedAt&&value.paidAt&&!value.receivedAt&&!locked&&<Button type="button" disabled={busy} onClick={()=>void save({action:"status",id:value.id,status:"completed",reason:"賣家確認已取貨"},"已標記取貨完成")}>{a("標記已取貨・結案")}</Button>}
              <p className="op-help">
                {value.paymentMethod === "cod"
                  ? a("金鑽會員貨到付款：可先採買，收款後才累計消費與哩程。")
                  : a("銀行匯款：買家回報末五碼後，請用上方「未收到／已收到」完成付款核對。")}
                {value.paymentDueAt &&
                  a(" 匯款期限：") + new Date(value.paymentDueAt).toLocaleString(language==='ko'?'ko-KR':language==='en'?'en-GB':'zh-TW',{timeZone:'Asia/Taipei'})}
                {value.paymentReportedAt &&
                  a(" · 旅客已回報匯款：") +
                    new Date(value.paymentReportedAt).toLocaleString(language==='ko'?'ko-KR':language==='en'?'en-GB':'zh-TW',{timeZone:'Asia/Taipei'})}
              </p>
              <label className="op-check op-purchased-check">
                <input
                  type="checkbox"
                  checked={!!value.purchasedAt || draft.status === "purchased"}
                  disabled={
                    busy ||
                    locked ||
                    !!pending ||
                    (!value.paidAt && value.paymentMethod !== "cod")
                  }
                  onChange={(e) =>
                    patch(
                      "status",
                      e.target.checked ? "purchased" : value.status,
                    )
                  }
                />{a("商品已買到")}<span>
                  {value.purchasedAt
                    ? new Date(value.purchasedAt).toLocaleDateString()
                    : value.paidAt || value.paymentMethod === "cod"
                      ? a("勾選後儲存狀態")
                      : a("請先確認付款")}
                </span>
              </label>
              <label>{a("訂單狀態")}<select
                  value={draft.status || value.status}
                  onChange={(e) => patch("status", e.target.value)}
                >
                  {!availableOrderStates(value).includes(value.status) && (
                    <option value={value.status}>
                      {a(stateNames[value.status]?.[0] || value.status)}
                    </option>
                  )}
                  {availableOrderStates(value).map((s) => (
                    <option key={s} value={s}>
                      {a(stateNames[s]?.[0] || s)}
                    </option>
                  ))}
                </select>
              </label>
              <label>{a("更新原因／給旅客的說明")}<textarea
                  value={draft.reason || ""}
                  onChange={(e) => patch("reason", e.target.value)}
                  rows={2}
                />
              </label>
              <Button disabled={busy}>{a("儲存狀態")}</Button>
            </form>
            <form
              className="op-form"
              onSubmit={async (e) => {
                e.preventDefault();
                await save(
                  {
                    action: "eta",
                    id: value.id,
                    eta: draft.eta,etaTo:draft.etaTo,
                    reason: draft.reason,
                  },
                  "預計領貨日期已通知旅客",
                );
              }}
            >
              <h3>{a("預計可取貨區間")}</h3><label>{a("區間結束")}<input type="date" required value={(draft.etaTo||draft.eta||'').slice(0,10)} onChange={e=>patch('etaTo',e.target.value)}/></label>
              <label>{a("日期")}<input
                  type="date"
                  value={(draft.eta || "").slice(0, 10)}
                  onChange={(e) => patch("eta", e.target.value)}
                  required
                />
              </label>
              <label>{a("調整原因")}<textarea
                  value={draft.reason || ""}
                  onChange={(e) => patch("reason", e.target.value)}
                  required
                  rows={2}
                />
              </label>
              <Button variant="outline" disabled={busy}>{a("更新領貨日期")}</Button>
            </form>
          </div>
        )}
        {section === "history" && (
          <div className="op-detail-stack">
            {value.pricing && (
              <>
                <PriceBreakdown p={value.pricing} />
                <ReceiptTools orders={[value]} adminPassword={adminPassword} single />
              </>
            )}
            <details className="kk-revision-history">
              <summary>{a("調價紀錄（")}{value.revisions?.length || 0}）</summary>
              {value.revisions?.map((r) => (
                <article key={r.id}>
                  <b>
                    {nt(r.previous.totalTwd)} → {nt(r.proposed.totalTwd)}
                  </b>
                  <p>{r.reason}</p><RevisionCredit revision={r}/>
                  <small>
                    {new Date(r.createdAt).toLocaleString(language==='ko'?'ko-KR':language==='en'?'en-GB':'zh-TW',{timeZone:'Asia/Taipei'})} ·{" "}
                    {a({
                      pending: "待同意",
                      accepted: "待結清",
                      settled: "已生效",
                      declined: "已拒絕",
                    }[r.status] || r.status)}
                  </small>
                </article>
              ))}
            </details>
            <OrderProgress order={value} /><ItemFulfilment order={value} admin send={async body=>{const r=await fetch("/api/operations",{method:"POST",headers:{"Content-Type":"application/json","X-KK-Admin-Password":adminPassword},body:JSON.stringify(body)});const v=await r.json() as {error?:string};if(!r.ok)throw new Error(v.error||"操作失敗");await save({action:"refresh"},"商品進度已更新");}}/>
            <div className="op-timeline op-audit-history">
              {value.events.map((e, i) => (
                <div key={i}>
                  <i />
                  <span>
                    <NotificationContent notice={e} date={e.createdAt}/>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
export function ProductDialog({
  rate,standardRate,
  aiConfigured = false,
  value,
  busy,
  close,
  save,
  apiPassword,
  orders,
}: {
  value: any;
  busy: boolean;
  close: () => void;
  save: (v: any) => Promise<void>;
  apiPassword: string;
  orders: ShopOrder[];
  aiConfigured?: boolean;
  rate?:number;standardRate?:number;
}) {
 const a=useAdminText(),language=useStoreLocale();
  const [d, setD] = useState<any>(value),
    [uploading, setUploading] = useState(false),
    [editMode,setEditMode]=useState<'manual'|'ai'>('manual'),
    [aiPrompt,setAiPrompt]=useState(''),[aiResearch,setAiResearch]=useState(false),
    [aiImageMode,setAiImageMode]=useState<'research'|'upload'|'link'>('research'),
    [aiImageLink,setAiImageLink]=useState(''),[aiBusy,setAiBusy]=useState(false),
    [aiEvidence,setAiEvidence]=useState(''),[aiConfirmed,setAiConfirmed]=useState(false),
    [imageFailed,setImageFailed]=useState(false);
  useEffect(() => {setD(value);setEditMode('manual');setAiConfirmed(false);setAiEvidence('');setImageFailed(false);}, [value]);
  if (!d) return null;
  const p = (k: string, v: any) => setD((x: any) => ({ ...x, [k]: v }));
  async function suggestProduct(){
    if (!aiConfigured) return;
    setAiBusy(true);setAiConfirmed(false);setImageFailed(false);
    try{
      const response=await fetch('/api/operations/ai-product',{method:'POST',headers:{'Content-Type':'application/json','X-KK-Admin-Password':apiPassword},body:JSON.stringify({prompt:aiPrompt,research:aiResearch,imageMode:aiImageMode,imageUrl:aiImageLink})});
      const result=await readJsonResponse(response) as {error?:string;draft?:any};
      if(!response.ok||!result.draft)throw new Error(result.error||'AI 查詢失敗');
      const found=result.draft;
      setD((old:any)=>({...old,...found,originalJpy:found.priceKrw||old.originalJpy||0,priceJpy:found.priceKrw||old.priceJpy||0,status:'draft',imageKey:old.imageKey||'',imageUrl:found.imageUrl||old.imageUrl,categoryZh:productCategories.some(c=>c.zh===found.categoryZh)?found.categoryZh:'韓國零食'}));
      setAiEvidence(found.evidence||'來源待確認');
      toast.success(a('AI 草稿已填入，請先核對圖片、規格與價格'));
    }catch(e){toast.error(a(e instanceof Error?e.message:'AI 查詢失敗'));}
    finally{setAiBusy(false);}
  }
  const recentCustomers=d.id?orders.filter(o=>o.pricing?.items.some(i=>i.productId===d.id)).slice(0,20):[];
  async function upload(file: File) {
    setUploading(true);
    try {
      const f = new FormData();
      f.set("image", file);
      const r = await fetch("/api/operations/image", {
          method: "POST",
          headers: { "X-KK-Admin-Password": apiPassword },
          body: f,
        }),
        v = (await readJsonResponse(r)) as {
          error?: string;
          imageKey: string;
        };
      if (!r.ok) throw new Error(v.error);
      setD((old:any)=>({...old,imageKey:v.imageKey,imageUrl:''}));setImageFailed(false);setAiConfirmed(false);
      toast.success(a("圖片已上傳"));
    } catch (e) {
      toast.error(a(e instanceof Error ? e.message : "圖片上傳失敗"));
    } finally {
      setUploading(false);
    }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && close()}>
      <DialogContent className="op-dialog">
        <DialogHeader>
          <DialogTitle>{d.id ? a("編輯商品") : a("新增販售商品")}</DialogTitle>
          <DialogDescription>{a("請填韓國商店標示的韓元售價；台幣售價由系統計算。")}</DialogDescription>
        </DialogHeader>
        {true&&<form
          className="op-form"
          onSubmit={(e) => {
            e.preventDefault();
            void save(d);
          }}
        >
          <label className="op-image-upload">
            {d.imageKey || d.imageUrl ? (
              <img src={d.imageKey?(d.imageKey.startsWith('static/')?`/${d.imageKey.slice(7)}`:`/api/media/${d.imageKey}`):d.imageUrl} alt="" />
            ) : (
              <Upload />
            )}
            <span>{uploading ? a("上傳中…") : a("上傳商品圖片")}</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) =>
                e.target.files?.[0] && void upload(e.target.files[0])
              }
            />
          </label>
          <ProductImageField imageUrl={d.imageUrl||''} onChange={imageUrl=>{setD((old:any)=>({...old,imageUrl,imageKey:''}));setImageFailed(false);setAiConfirmed(false);}} />
          <div className="op-two">
            <label>{a("中文名稱")}<input
                value={d.nameZh}
                onChange={(e) => p("nameZh", e.target.value)}
                required
              />
            </label>
            <label>{a("英文名稱")}<input
                value={d.nameEn}
                onChange={(e) => p("nameEn", e.target.value)}
              />
            </label>
          </div>
          <ProductKoreanFields name={d.nameKo||''} description={d.descriptionKo||''} onChange={(key,value)=>p(key,value)}/>
          <label>{a("商品分類")}<select value={d.categoryZh} onChange={(e)=>{const category=productCategories.find(x=>x.zh===e.target.value)||productCategories[8];setD((x:any)=>({...x,categoryZh:category.zh,categoryEn:category.en}));}}>
              {productCategories.map(category=><option key={category.zh} value={category.zh}>{a(category.zh)}</option>)}
            </select>
          </label>
          <label>{a("中文介紹")}<textarea
              rows={2}
              value={d.descriptionZh}
              onChange={(e) => p("descriptionZh", e.target.value)}
            />
          </label>
          <label>{a("英文介紹")}<textarea
              rows={2}
              value={d.descriptionEn}
              onChange={(e) => p("descriptionEn", e.target.value)}
            />
          </label>
          <div className="op-two">
            <label>{a("韓國含必要運費成本 KRW")}<input
                type="number"
                min="1"
                value={d.originalJpy || ""}
                onChange={(e) => p("originalJpy", +e.target.value)}
                required
              />
            </label>
            <label>{a("庫存（-1 不限）")}<input
                type="number"
                min="-1"
                value={d.stock}
                onChange={(e) => p("stock", +e.target.value)}
              />
            </label>
          </div>
          <fieldset className="op-flex-price"><legend>{a("彈性售價")}</legend><p>{a("香水費率上限為 1% ÷（1＋單件台幣成本／2000）；其他商品為一般費率 ÷（1＋單件台幣成本／4000），再乘會員費率比例與回購係數。回購係數為 1／（1＋已核款訂單數 × 0.03），最多計 50 筆。含費售價不得高於台灣同規格價格的 95%；成本超出時列入核對清單。")}</p><div className="op-two"><label>{a("個別費率上限 %（留空自動計算）")}<input type="number" min="0" max="100" step="0.1" value={d.serviceFeePercent??''} onChange={e=>p('serviceFeePercent',e.target.value===''?null:+e.target.value)}/></label><label>{a("含服務費售價上限 NT$（不含運費）")}<input type="number" min="1" step="1" value={d.salePriceTwd||''} placeholder="例如 6300" onChange={e=>p('salePriceTwd',e.target.value===''?null:+e.target.value)}/></label></div><small>{a("例如實際成本 NT$6,000，可設定上限 NT$6,300；留空則依費率計算。既有訂單金額不受影響。")}</small></fieldset><fieldset className="op-flex-price"><legend>{a('台灣販售情況')}</legend><select value={d.taiwanAvailability||'listed'} onChange={e=>{p('taiwanAvailability',e.target.value);p('taiwanAbsenceConfirmed',false);}}><option value="listed">{a('台灣有販售：核對同規格價格')}</option><option value="not_sold">{a('台灣無販售：需查核證據')}</option></select>{d.taiwanAvailability==='not_sold'&&<><textarea aria-label={a('台灣無販售查核記錄')} placeholder={a('記錄已查核的品牌、台灣通路、規格及日期；找不到價格不等於沒有販售。')} value={d.taiwanAbsenceEvidence||''} onChange={e=>p('taiwanAbsenceEvidence',e.target.value)}/><label className="op-check"><input type="checkbox" checked={!!d.taiwanAbsenceConfirmed} onChange={e=>p('taiwanAbsenceConfirmed',e.target.checked)}/>{a('我已查核這個規格在台灣無販售')}</label></>}</fieldset>          <div className="op-two">
            <label>{a("商品狀態")}<select
                value={d.status}
                onChange={(e) => p("status", e.target.value)}
              >
                <option value="active">{a("販售中")}</option>
                <option value="draft">{a("草稿")}</option><option value="research">{a("資料待核實")}</option>
                <option value="paused">{a("暫停販售")}</option>
                <option value="discontinued">{a("停售")}</option>
              </select>
            </label>
            <label>{a("尺寸處理費 TWD")}<input
                type="number"
                min="0"
                value={d.sizeFeeTwd || 0}
                onChange={(e) => p("sizeFeeTwd", +e.target.value)}
              />
            </label>
          </div>
          <label>{a("下單後預估到貨小時（0 為未設定）")}<input
              type="number"
              min="0"
              max="8760"
              value={d.arrivalHours || 0}
              onChange={(e) => p("arrivalHours", +e.target.value)}
            />
          </label>
          <label>{a("預定採買時間 / Purchase time")}<input type="datetime-local" value={dateInput(d.purchaseAt||'')} onChange={e=>p('purchaseAt',e.target.value?new Date(e.target.value).toISOString():'')}/><small>{a("留空採用商店統一時間，24 小時前截止免費取消。 / Blank uses the store schedule.")}</small></label>
          <div className="op-two"><label>{a("採買區間結束 / Purchase end")}<input type="datetime-local" min={dateInput(d.purchaseAt||'')} value={dateInput(d.purchaseAtTo||'')} onChange={e=>p('purchaseAtTo',e.target.value?new Date(e.target.value).toISOString():'')}/></label><label>{a("限定販售開始 / Available from")}<input type="datetime-local" value={dateInput(d.availableFrom||'')} onChange={e=>p('availableFrom',e.target.value?new Date(e.target.value).toISOString():'')}/></label><label>{a("限定販售結束 / Available until")}<input type="datetime-local" value={dateInput(d.availableUntil||'')} onChange={e=>p('availableUntil',e.target.value?new Date(e.target.value).toISOString():'')}/></label></div>
          <label>{a("商品規格（每行：中文｜英文｜韓元 KRW） / Variants")}<textarea rows={4} placeholder={'8 個裝｜8 pieces｜1296\n12 個裝｜12 pieces｜1944'} value={(d.variants||[]).map((v:any)=>`${v.labelZh}｜${v.labelEn}｜${v.taxIncludedJpy||v.priceJpy}`).join('\n')} onChange={e=>p('variants',e.target.value.split('\n').filter(Boolean).map((line,i)=>{const [labelZh='',labelEn='',price='']=line.split(/[｜|]/).map(x=>x.trim());return{...(d.variants?.[i]||{}),id:d.variants?.[i]?.id||`option-${i+1}`,labelZh,labelEn:labelEn||labelZh,priceJpy:Number(price)};}))}/><small>{a("有規格時，買家必須先選盒數或 mL 才能加入購物車。")}</small></label>{!!d.variants?.length&&<fieldset className="op-flex-price"><legend>{a("口味／規格供貨")}</legend>{d.variants.map((v:any,i:number)=><label className="op-check" key={v.id}><input type="checkbox" checked={v.stock===0} onChange={e=>p('variants',d.variants.map((item:any,j:number)=>i===j?{...item,stock:e.target.checked?0:-1,availabilityNote:e.target.checked?item.availabilityNote||'韓國貨源缺貨 / Supplier sold out':''}:item))}/>{v.labelZh} · {a("缺貨，暫停此規格下單")}</label>)}<small>{a("補貨與購買來源確認後，再取消勾選；其他規格可繼續販售。")}</small></fieldset>}
          <VariantEvidenceFields variants={d.variants||[]} onChange={variants=>p('variants',variants)}/>
          <p className="op-note">{a("公開前請核對韓國售價、來源、圖片與庫存；商品頁顯示的台幣售價已包含代購服務。")}</p>
          <label>{a("購買來源網址")}<input
              type="url"
              value={d.purchaseUrl || ""}
              onChange={(e) => p("purchaseUrl", e.target.value)}
            />
          </label>
          <label className="op-check">
            <input
              type="checkbox"
              checked={!!d.addon}
              onChange={(e) => p("addon", e.target.checked)}
            />{a("此商品只能加購")}</label>
          <fieldset>
            <legend>{a("可購買會員")}</legend>
            {tiers.map((t) => (
              <label className="op-check" key={t}>
                <input
                  type="checkbox"
                  checked={d.allowedTiers.includes(t)}
                  onChange={(e) =>
                    p(
                      "allowedTiers",
                      e.target.checked
                        ? [...d.allowedTiers, t]
                        : d.allowedTiers.filter((x: Tier) => x !== t),
                    )
                  }
                />
                {a(tierNames[t][0])}
              </label>
            ))}
          </fieldset>
          {!!recentCustomers.length&&<details><summary>{a("近期訂購此商品的顧客（")}{recentCustomers.length}{a("筆訂單）")}</summary>{recentCustomers.map(o=><p key={o.id}>{o.customerName} · {o.email} · {o.requestNo} · {a(stateNames[o.status]?.[0]||o.status)}</p>)}</details>}
          <Button disabled={busy || uploading}>{a("儲存商品")}</Button>
        </form>}
      </DialogContent>
    </Dialog>
  );
}
function MemberDialog({
  value,
  busy,
  close,
  save,
}: {
  value: Member | null;
  busy: boolean;
  close: () => void;
  save: (b: any) => Promise<void>;
}) {
 const a=useAdminText(),language=useStoreLocale();
  const [delta, setDelta] = useState(0),
    [reason, setReason] = useState(""),
    [tier, setTier] = useState<string>("");
  useEffect(() => {
    setDelta(0);
    setReason("");
    setTier(value?.overrideTier || "");
  }, [value]);
  if (!value) return null;
  return (
    <Dialog open onOpenChange={(o) => !o && close()}>
      <DialogContent className="op-dialog">
        <DialogHeader>
          <DialogTitle>{value.name}</DialogTitle>
          <DialogDescription>{value.email}</DialogDescription>
        </DialogHeader>
        <div className="op-member-summary">
          <span className={`tier-${value.tier}`}>
            {a(tierNames[value.tier][0])}
          </span>
          <strong>{jy(value.spendJpy)}</strong>
          <strong>{value.miles}{a("哩程")}</strong>
        </div>
        <form
          className="op-form"
          onSubmit={(e) => {
            e.preventDefault();
            void save({
              id: value.id,
              overrideTier: tier || null,
              delta,
              reason,
              key: submissionKey(),
            });
          }}
        >
          <label>{a("手動會員等級")}<select value={tier} onChange={(e) => setTier(e.target.value)}>
              <option value="">{a("依累積金額自動")}</option>
              {tiers.map((t) => (
                <option key={t} value={t}>
                  {a(tierNames[t][0])}
                </option>
              ))}
            </select>
          </label>
          <label>{a("增加／移除哩程")}<input
              type="number"
              step="1"
              value={delta}
              onChange={(e) => setDelta(+e.target.value)}
            />
          </label>
          <label>{a("調整原因")}<textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required={delta !== 0}
            />
          </label>
          <Button disabled={busy}>{a("儲存會員資料")}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
export function DirectMessage({data,adminPassword}:{data:AdminData;adminPassword:string}){
 const a=useAdminText(),language=useStoreLocale();
 const [direct,setDirect]=useState({memberId:'',orderId:''}),[chatOpen,setChatOpen]=useState(false);
 const directMember=data.members.find(m=>m.id===direct.memberId),directOrders=data.orders.filter(o=>o.memberId===direct.memberId);
 return (
      <section className="op-direct-message">
        <div>
          <MessageCircle />
          <div>
            <h3>{a("直接私訊旅客")}</h3>
            <p>{a("選擇旅客與訂單後開啟私人對話，只有該旅客與管理員看得到。")}</p>
          </div>
        </div>
        <div className="op-direct-fields">
          <label>{a("旅客")}<select
              value={direct.memberId}
              onChange={(e) =>
                setDirect({ memberId: e.target.value, orderId: "" })
              }
            >
              <option value="">{a("請選擇旅客")}</option>
              {data.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} · {m.email}
                </option>
              ))}
            </select>
          </label>
          <label>{a("關聯訂單（選填）")}<select
              value={direct.orderId}
              disabled={!direct.memberId}
              onChange={(e) =>
                setDirect((x) => ({ ...x, orderId: e.target.value }))
              }
            >
              <option value="">{a("一般私訊，不指定訂單")}</option>
              {directOrders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.requestNo} · {(language==='zh'?o.identifiedNameZh:o.identifiedNameEn||o.identifiedNameZh) || a("商品查價中")}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            disabled={!directMember}
            onClick={() => setChatOpen(true)}
          >
            <MessageCircle />{a("開啟私訊")}</Button>
        </div>
        {directMember && (
          <BuyerChat
            memberId={directMember.id}
            name={directMember.name}
            orderId={direct.orderId ? Number(direct.orderId) : undefined}
            adminPassword={adminPassword}
            open={chatOpen}
            onOpenChange={setChatOpen}
            hideTrigger
          />
        )}
      </section>
);
}

function SupportInbox({threads,adminPassword,configured}:{threads:SupportThread[];adminPassword:string;configured:boolean}){
 const a=useAdminText(),language=useStoreLocale();
 const [selected,setSelected]=useState<SupportThread|null>(null),[open,setOpen]=useState(false);
 const waiting=threads.filter(x=>x.needs_human).length;
 return <>
  <div className="op-title"><div><p>SUPPORT INBOX</p><h2>{a("訊息與真人客服")}</h2><span>{a(configured?"AI 先回答常見問題；旅客轉真人後，完整對話與 AI 訴求摘要會排到最前面。":"AI 未連線；目前提供系統訂單說明與真人客服。")}</span></div><em className={waiting?'op-waiting-count active':'op-waiting-count'}>{waiting}{a("個等待中")}</em></div>
  <div className="op-support-inbox">{threads.map(thread=><button key={thread.member_id} className={thread.needs_human?'waiting':''} onClick={()=>{setSelected(thread);setOpen(true);}}><span className={'op-support-icon '+thread.status}>{thread.status==='ai'?<Bot/>:<Headphones/>}</span><div><div><b>{thread.name}</b><small>{thread.email}</small></div><p>{thread.last_body||a('尚無訊息內容')}</p>{thread.ai_summary&&<aside><Sparkles/> <span>{thread.ai_summary}</span></aside>}</div><em>{thread.needs_human?a("等待真人"):thread.status==='human'?a("真人服務中"):a(configured?"AI 客服":"系統訂單說明（AI 未連線）")}</em>{thread.unread_admin>0&&<strong>{thread.unread_admin}</strong>}<ChevronRight/></button>)}{!threads.length&&<div className="op-empty">{a("目前沒有客服對話")}</div>}</div>
  {selected&&<BuyerChat memberId={selected.member_id} name={selected.name} adminPassword={adminPassword} open={open} onOpenChange={setOpen} hideTrigger/>}
 </>;
}

function NotifyPanel({
  data,
  onSelectOrder,
  adminPassword,
  busy,
  api,
  load,
  setAudience,
  audience,
  run,
}: {
  data: AdminData;
  onSelectOrder:(order:ShopOrder)=>void;
  adminPassword: string;
  busy: boolean;
  api: (b: any) => Promise<any>;
  load: () => Promise<void>;
  setAudience: (x: any) => void;
  audience: any;
  run: (f: () => Promise<void>, m?: string) => Promise<void>;
}) {
 const a=useAdminText(),language=useStoreLocale();
  const [d, setD] = useState<any>({
      audienceMode: "all",
      memberIds: [] as string[],
      memberId: "",
      tier: "",
      productId: "",
      from: "",
      to: "",
      title: "",
      titleEn: "",
      body: "",
      bodyEn: "",
      channel: "in_app",
    });
  const p = (k: string, v: any) => {
    setD((x: any) => ({ ...x, [k]: v }));
    setAudience(null);
  };
  const spec = {
      audienceMode:d.audienceMode,
      memberIds:d.audienceMode==='members'?d.memberIds:[],
      tier:d.audienceMode==='tier'?d.tier:undefined,
      productId: d.productId || undefined,
      from: d.from || undefined,
      to: d.to || undefined,
    };
  return (
    <>
      <OrderTaskList orders={data.orders} onSelect={onSelectOrder}/>
      <div className="op-title">
        <div>
          <p>MESSAGING</p>
          <h2>{a("通知與待辦")}</h2>
          <span>{a("批次通知可依會員、等級、商品與付款期間篩選；一對一對話請到「訊息」。")}</span>
        </div>
      </div>
      <div className="op-notify">
        <form
          className="op-form"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              if (!audience) throw new Error("請先預覽收件人");
              await api({
                action: "notify",
                ...d,
                ...spec,
                expectedCount: audience.count,
                audienceSignature: audience.audienceSignature,
              });
              await load();
              setAudience(null);
            }, "通知已發送");
          }}
        >
          <h3>{a("批次站內通知")}</h3>
          <label>{a("收件對象 / Recipients")}<select value={d.audienceMode} onChange={e=>{p('audienceMode',e.target.value);p('memberIds',[]);p('tier','');}}><option value="all">{a("所有會員 / All members")}</option><option value="members">{a("指定會員（多選） / Selected members")}</option><option value="tier">{a("會員等級 / Membership tier")}</option></select></label>
          {d.audienceMode==='members'&&<fieldset className="op-select-list"><legend>{a("選擇會員 / Select members")}</legend>{data.members.map(m=><label className="op-check" key={m.id}><input type="checkbox" checked={d.memberIds.includes(m.id)} onChange={e=>p('memberIds',e.target.checked?[...d.memberIds,m.id]:d.memberIds.filter((id:string)=>id!==m.id))}/>{m.name} · {m.email}</label>)}</fieldset>}
          {d.audienceMode==='tier'&&<label>{a("會員等級 / Tier")}<select value={d.tier} required onChange={e=>p('tier',e.target.value)}><option value="">{a("請選擇 / Select")}</option>{tiers.map(t=><option key={t} value={t}>{a(tierNames[t][0])}</option>)}</select></label>}
          <label>{a("曾購買商品")}<select
              value={d.productId}
              onChange={(e) => p("productId", e.target.value)}
            >
              <option value="">{a("不限商品")}</option>
              {data.products.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nameZh}
                </option>
              ))}
            </select>
          </label>
          <div className="op-two">
            <label>{a("付款日期從")}<input
                type="date"
                value={d.from}
                onChange={(e) => p("from", e.target.value)}
              />
            </label>
            <label>{a("付款日期至")}<input
                type="date"
                value={d.to}
                onChange={(e) => p("to", e.target.value)}
              />
            </label>
          </div>
          <label>{a("通知標題")}<input
              value={d.title}
              onChange={(e) => p("title", e.target.value)}
              required
            />
          </label>
          <label>{a("通知內容")}<textarea
              rows={4}
              value={d.body}
              onChange={(e) => p("body", e.target.value)}
              required
            />
          </label>
          <label>{a("英文通知標題 / English title")}<input value={d.titleEn} onChange={e=>p('titleEn',e.target.value)}/></label><label>{a("英文通知內容 / English message")}<textarea value={d.bodyEn} onChange={e=>p('bodyEn',e.target.value)} rows={3}/></label>
          <div className="op-notify-actions">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() =>
                void run(async () =>
                  setAudience(await api({ action: "audience", ...spec })),
                )
              }
            >{a("預覽收件人")}</Button>
            <Button disabled={busy || !audience}>{a("發送站內通知")}</Button>
          </div>
        </form>
        <aside>
          <Bell />
          <h3>{audience ? a('{count} 位收件人',{count:audience.count}) : a("先預覽收件人")}</h3>
          <p>
            {audience
              ? audience.members
                  .slice(0, 12)
                  .map((m: any) => m.name)
                  .join("、") || "沒有符合條件的會員"
              : a("系統會重新核對人數，避免寄錯對象。")}
          </p>
          <small>{a("Email 尚未連線時不會假裝已寄出。")}</small>
        </aside>
      </div>
    </>
  );
}
