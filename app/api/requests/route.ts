import {requireShopOpen,currentMember} from '@/lib/commerce';
import {isAdmin} from '@/lib/admin-auth';
import {failure} from '@/app/api/shop/route';
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { shoppingRequests } from "@/db/schema";
import { appendProgress, getRequestBundle } from "@/lib/request-data";


async function findCustomerRequest(requestNo: string, email: string) {
  const [row] = await getDb().select().from(shoppingRequests).where(and(
    eq(shoppingRequests.requestNo, requestNo.trim().toUpperCase()),
    eq(shoppingRequests.email, email.trim().toLowerCase()),
  )).limit(1);
  return row;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestNo = url.searchParams.get("requestNo") ?? "";
  const email = url.searchParams.get("email") ?? "";
  if (!requestNo || !email.includes("@")) {
    return Response.json({ error: "請輸入案件編號與 Email。" }, { status: 400 });
  }
  try {
    const row = await findCustomerRequest(requestNo, email);
    if (!row) return Response.json({ error: "找不到符合的案件，請確認編號與 Email。" }, { status: 404 });
    if(row.memberId&&!isAdmin(request)&&(await currentMember(request))?.id!==row.memberId)return Response.json({error:'請登入訂單所屬會員。 / Sign in to the account that owns this order.'},{status:401});
    return Response.json({ request: await getRequestBundle(row) });
  } catch (error) {
    console.error("request_lookup_failed", error);
    return Response.json({ error: "查詢暫時無法使用，請稍後再試。" }, { status: 503 });
  }
}

export {POST} from '@/app/api/photo-quotes/route';

export async function PATCH(request: Request) {
  try {
    await requireShopOpen();
    const body = await request.json() as { requestNo?: string; email?: string; action?: string };
    const row = await findCustomerRequest(body.requestNo ?? "", body.email ?? "");
    if (!row) return Response.json({ error: "找不到符合的案件。" }, { status: 404 });
    if(row.pricingJson||row.memberId)return Response.json({error:'請登入會員中心確認報價。'},{status:409});
    if (body.action !== "confirm" || row.status !== "quoted" || !row.quoteJson) {
      return Response.json({ error: "目前無法確認此報價。" }, { status: 400 });
    }
    await getDb().update(shoppingRequests).set({ status: "customer_confirmed", updatedAt: new Date().toISOString() }).where(eq(shoppingRequests.id, row.id));
    await appendProgress(row.id, row.email, "customer_confirmed", "您已確認報價", "Quote confirmed", "管理員將安排商品採購。", "The administrator will arrange the purchase.");
    const [updated] = await getDb().select().from(shoppingRequests).where(eq(shoppingRequests.id, row.id)).limit(1);
    return Response.json({ request: await getRequestBundle(updated) });
  } catch (error) {
    console.error("shopping_request_confirm_failed", error);
    return failure(error);
  }
}
