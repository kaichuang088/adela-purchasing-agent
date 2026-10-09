import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { shoppingRequests } from "@/db/schema";
import { parseShoppingRequest } from "@/lib/request-data";
import CommerceDocument from './commerce-document';
import DocumentClient from "./document-client";
import {headers} from 'next/headers';
import {currentMember} from '@/lib/commerce';
import {isAdmin} from '@/lib/admin-auth';

export const dynamic = "force-dynamic";

export default async function RequestDocumentPage({ params, searchParams }: { params: Promise<{ requestNo: string }>; searchParams: Promise<{ email?: string }> }) {
  const { requestNo } = await params;
  const { email = "" } = await searchParams;
  const requestHeaders=await headers();
  const incoming=new Request('https://document.internal',{headers:requestHeaders});
  const admin=isAdmin(incoming),member=admin?null:await currentMember(incoming);
  const unavailable=<main className="document-empty"><span>Adela's</span><h1>請登入訂單所屬會員</h1><p>請從會員訂單開啟收據；管理員請使用後台收據功能。</p><a href="/">返回商店</a></main>;
  if(!admin&&!member)return unavailable;
  const [row] = await getDb().select().from(shoppingRequests).where(and(
    eq(shoppingRequests.requestNo, requestNo.toUpperCase()),
    eq(shoppingRequests.email, email.trim().toLowerCase()),
  )).limit(1);
  if (!row||!admin&&row.memberId!==member?.id)return unavailable;
  if(row.pricingJson)return <CommerceDocument pricing={JSON.parse(row.pricingJson)} orderNo={row.requestNo} name={row.customerName} email={row.email} status={row.status} paidAt={row.paidAt}/>;
  const request = parseShoppingRequest(row);
  if (!request.quote) return <main className="document-empty"><span>Adela's</span><h1>正式報價尚未完成</h1><p>管理員確認商品與價格後，即可產生報價、明細與發票資料。</p></main>;
  return <DocumentClient request={request} />;
}
