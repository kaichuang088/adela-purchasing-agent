import { and,eq } from "drizzle-orm";
import { getDb } from "@/db";
import { shoppingRequests } from "@/db/schema";
import { runAnalysis } from "@/lib/run-analysis";
import { privateJson } from "@/lib/admin-auth";
import { currentMember } from "@/lib/commerce";
export async function POST(request:Request){
  try {
    const member=await currentMember(request,true);
    const body=await request.json() as {requestNo?:string;email?:string};
    const row=await getDb().select().from(shoppingRequests).where(and(eq(shoppingRequests.requestNo,String(body.requestNo||"")),eq(shoppingRequests.email,String(body.email||"").trim().toLowerCase()))).get();
    if(!row||row.memberId!==member?.id)return privateJson({error:"找不到訂單。"},404);
    return privateJson({request:await runAnalysis(row.id)});
  }catch(error){const status=typeof error==="object"&&error&&"status" in error?Number(error.status):409;return privateJson({error:error instanceof Error?error.message:"辨識失敗。"},status);}
}
