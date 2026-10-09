import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { shoppingRequests } from "@/db/schema";
import { appendProgress, getRequestBundle, listRequests } from "@/lib/request-data";
import { runAnalysis } from "@/lib/run-analysis";
import type { VerifiedQuote } from "@/lib/types";

const allowedStatuses = ["submitted", "admin_review", "quoted", "customer_confirmed", "purchasing", "shipped_japan", "arrived_taiwan", "completed", "cancelled"];

function allowedOrigin(request: Request) {
  const origin = request.headers.get("origin") ?? "";
  const configured = (env.ADMIN_ORIGINS || env.ADMIN_ORIGIN || "https://kk-japan-admin.kaichuang0808.chatgpt.site").split(",").map((value) => value.trim()).filter(Boolean);
  if (configured.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  return configured[0];
}

function cors(request: Request, response: Response) {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", allowedOrigin(request));
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set("Cache-Control", "no-store");
  headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, X-KK-Admin-Password");
  headers.set("Access-Control-Max-Age", "86400");
  headers.set("Vary", "Origin");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function json(request: Request, body: unknown, init?: ResponseInit) {
  return cors(request, Response.json(body, init));
}

function isAdmin(request: Request) {
  const expected = env.ADMIN_PASSWORD ?? "";
  const received = request.headers.get("x-kk-admin-password") ?? "";
  return expected.length >= 8 && received === expected;
}

export async function OPTIONS(request: Request) {
  return cors(request, new Response(null, { status: 204 }));
}

export async function GET(request: Request) {
  if (!isAdmin(request)) return json(request, { error: "密碼錯誤。" }, { status: 401 });
  try {
    return json(request, { requests: await listRequests(), aiConfigured: Boolean(env.OPENAI_API_KEY||env.KK_AI_GATEWAY_URL), syncedAt: new Date().toISOString() });
  } catch (error) {
    console.error("manage_list_failed", error);
    return json(request, { error: "無法讀取案件。" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!isAdmin(request)) return json(request, { error: "密碼錯誤。" }, { status: 401 });
  try {
    const body = await request.json() as { action?: string; id?: number };
    if (body.action === "login") return json(request, { ok: true, aiConfigured: Boolean(env.OPENAI_API_KEY||env.KK_AI_GATEWAY_URL) });
    if (body.action !== "reanalyze") return json(request, { error: "不支援的操作。" }, { status: 400 });
    return json(request, { request: await runAnalysis(Number(body.id)) });
  } catch (error) {
    console.error("manage_action_failed", error);
    return json(request, { error: error instanceof Error ? error.message : "操作失敗，請稍後再試。" }, { status: 503 });
  }
}

function quoteFrom(value: unknown): VerifiedQuote | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const quote: VerifiedQuote = {
    quantity: Math.max(1, Math.min(20, Math.round(Number(input.quantity) || 1))),
    productNameZh: String(input.productNameZh ?? "").trim().slice(0, 180),
    productNameEn: String(input.productNameEn ?? "").trim().slice(0, 180),
    storeName: String(input.storeName ?? "").trim().slice(0, 160),
    purchaseUrl: String(input.purchaseUrl ?? "").trim().slice(0, 800),
    priceTaxIncludedJpy: Math.max(0, Math.round(Number(input.priceTaxIncludedJpy) || 0)),
    priceTaxFreeJpy: Math.max(0, Math.round(Number(input.priceTaxFreeJpy) || 0)),
    taxRatePercent: Math.max(0, Math.min(20, Number(input.taxRatePercent) || 0)),
    taxFreeEligible: Boolean(input.taxFreeEligible),
    exchangeRate: Math.max(0, Number(input.exchangeRate) || 0),
    serviceFeeTwd: Math.max(0, Math.round(Number(input.serviceFeeTwd) || 0)),
    internationalShippingTwd: Math.max(0, Math.round(Number(input.internationalShippingTwd) || 0)),
    localShippingTwd: Math.max(0, Math.round(Number(input.localShippingTwd) || 0)),
    notesZh: String(input.notesZh ?? "").trim().slice(0, 1200),
    notesEn: String(input.notesEn ?? "").trim().slice(0, 1200),
    verifiedAt: new Date().toISOString(),
  };
  if (!quote.productNameZh || !quote.storeName || !/^https:\/\//.test(quote.purchaseUrl) || !quote.priceTaxIncludedJpy || !quote.exchangeRate) return null;
  if (!quote.productNameEn) quote.productNameEn = quote.productNameZh;
  if (!quote.priceTaxFreeJpy) quote.priceTaxFreeJpy = quote.priceTaxIncludedJpy;
  return quote;
}

export async function PATCH(request: Request) {
  if (!isAdmin(request)) return json(request, { error: "密碼錯誤。" }, { status: 401 });
  try {
    const body = await request.json() as { id?: number; status?: string; quote?: unknown; statusNote?: string };
    const [row] = await getDb().select().from(shoppingRequests).where(eq(shoppingRequests.id, Number(body.id))).limit(1);
    if (!row) return json(request, { error: "找不到案件。" }, { status: 404 });
    if(row.pricingJson||row.paidAt||row.purchasedAt)return json(request,{error:'請使用新版訂單管理，以保留調價與付款紀錄。'},{status:409});
    const quote = body.quote === undefined ? null : quoteFrom(body.quote);
    if (body.quote !== undefined && !quote) {
      return json(request, { error: "請完整填寫商品、商店、有效購買網址、含稅價格與匯率。" }, { status: 400 });
    }
    if (quote) quote.quantity = row.quantity;
    const nextStatus = quote ? "quoted" : allowedStatuses.includes(String(body.status)) ? String(body.status) : row.status;
    await getDb().update(shoppingRequests).set({
      status: nextStatus,
      quoteJson: quote ? JSON.stringify(quote) : row.quoteJson,
      identifiedNameZh: quote?.productNameZh ?? row.identifiedNameZh,
      identifiedNameEn: quote?.productNameEn ?? row.identifiedNameEn,
      updatedAt: new Date().toISOString(),
    }).where(eq(shoppingRequests.id, row.id));

    if (quote) {
      await appendProgress(row.id, row.email, "quoted", "正式報價已完成", "Verified quote is ready", "管理員已核對商品、來源與價格，請登入查看並確認。", "The administrator verified the item, source, and price. Please review and confirm.");
    } else if (nextStatus !== row.status) {
      const labels: Record<string, [string, string]> = {
        admin_review: ["管理員審核中", "Administrator review"], customer_confirmed: ["顧客已確認", "Customer confirmed"],
        purchasing: ["採購中", "Purchasing"], shipped_japan: ["商家已寄出", "Shipped by seller"],
        arrived_taiwan: ["商品已抵台", "Arrived in Taiwan"], completed: ["案件已完成", "Request completed"], cancelled: ["案件已取消", "Request cancelled"],
      };
      const [zh, en] = labels[nextStatus] ?? ["進度已更新", "Progress updated"];
      const note = String(body.statusNote ?? "").trim().slice(0, 300);
      await appendProgress(row.id, row.email, nextStatus, zh, en, note, note);
    }
    const [updated] = await getDb().select().from(shoppingRequests).where(eq(shoppingRequests.id, row.id)).limit(1);
    return json(request, { request: await getRequestBundle(updated) });
  } catch (error) {
    console.error("manage_update_failed", error);
    return json(request, { error: "更新失敗，請稍後再試。" }, { status: 503 });
  }
}
