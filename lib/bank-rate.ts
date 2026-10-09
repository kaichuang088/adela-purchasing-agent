const SOURCE_URL = "https://rate.bot.com.tw/xrt/flcsv/0/day";
const FALLBACK_URL = "https://open.er-api.com/v6/latest/KRW";

const responseHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, max-age=300, stale-while-revalidate=300",
};

function numberAt(row: string[], index: number) {
  const value = Number(row[index]?.trim());
  return Number.isFinite(value) && value > 0 ? value : null;
}

export async function fetchBankRate() {
  let primaryError: unknown = null;
  try {
    const response = await fetch(SOURCE_URL, { signal:AbortSignal.timeout(7000), headers: { "User-Agent": "Adela-Korea-Buy/1.0" }, cache: "no-store" });
    if (!response.ok) throw new Error(`Bank of Taiwan returned ${response.status}`);
    const csv = await response.text();
    const row = csv.split(/\r?\n/).map((line) => line.split(",")).find((columns) => columns[0]?.trim() === "KRW");
    if (!row) throw new Error("KRW row not found");
    const cashBuying = numberAt(row, 2); const spotBuying = numberAt(row, 3);
    const cashSelling = numberAt(row, 12); const spotSelling = numberAt(row, 13);
    if (!cashSelling || !spotSelling) throw new Error("KRW selling rates unavailable");
    return Response.json({
      currency: "KRW", quoteCurrency: "TWD", rate: cashSelling, cashBuying, cashSelling, spotBuying, spotSelling,
      sourceName: "臺灣銀行牌告匯率", sourceUrl: "https://rate.bot.com.tw/xrt?Lang=zh-TW", fetchedAt: new Date().toISOString(),
      noteZh: "採用臺灣銀行韓元現金賣出牌告價，僅供報價參考；實際交易與代購匯率以管理員確認為準。",
      noteEn: "Uses Bank of Taiwan's KRW cash selling rate as a reference. The administrator confirms the transaction rate.",
    }, { headers: responseHeaders });
  } catch (error) {
    primaryError = error;
  }

  try {
    const response = await fetch(FALLBACK_URL, {
      signal: AbortSignal.timeout(7000),
      headers: { "User-Agent": "Adela-Purchasing-Agent/1.0" },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`ExchangeRate-API returned ${response.status}`);
    const data = await response.json() as {
      result?: string;
      base_code?: string;
      rates?: Record<string, number>;
      time_last_update_utc?: string;
    };
    const rate = Number(data.rates?.TWD);
    if (data.result !== "success" || data.base_code !== "KRW" || !Number.isFinite(rate) || rate <= 0) {
      throw new Error("Invalid KRW/TWD fallback rate");
    }
    console.warn("bank_rate_primary_unavailable_using_fallback", primaryError);
    return Response.json({
      currency: "KRW", quoteCurrency: "TWD", rate,
      cashBuying: rate, cashSelling: rate, spotBuying: rate, spotSelling: rate,
      sourceName: "ExchangeRate-API 每日參考匯率", sourceUrl: "https://www.exchangerate-api.com",
      fetchedAt: data.time_last_update_utc ? new Date(data.time_last_update_utc).toISOString() : new Date().toISOString(),
      noteZh: "臺灣銀行來源暫時無法連線，改用 ExchangeRate-API 韓元兌台幣每日中間價；實際交易與代購匯率仍以管理員確認為準。",
      noteEn: "Bank of Taiwan is temporarily unreachable. Uses the ExchangeRate-API daily KRW/TWD midpoint as a reference; the administrator confirms the transaction rate.",
    }, { headers: responseHeaders });
  } catch (fallbackError) {
    console.error("exchange_rate_failed", { primaryError, fallbackError });
    return Response.json({ error: "目前無法取得韓元兌台幣參考匯率。" }, { status: 503, headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" } });
  }
}
