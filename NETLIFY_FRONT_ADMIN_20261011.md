# Adela Netlify 前後台準備 — 2026-10-11

本次完成前後台分別建置與手機視窗檢查。2026-10-11 15:25（台灣時間）
已完成原兩站Adela改名及免費Function的真實模型測試；部署結果以根PROJECT_STATE.json為準。
使用者已授權同一 Netlify 專案發布，要求網址改為 Adela，且禁止任何付款。
以下為接續者需核實的實際狀態，優先於更早的部署前文件。

## 版本與現有服務

使用者要求採用同一私人 Sites 當前最新版。已取得並校驗的交接包是程式 R20／
Sites 第31版，commit `0418b8ed36a43ae973ca227f3ae0767fcdeec25b`；第30版是其前一版。
這些是匯出文件的版本，不能用來證明當前 Site 沒有較新更新。
環境沒有 Sites 原始碼／版本讀取工具，私人網址一般請求未能取得內容（401／403）；
這些HTTP狀態不提供版本資料，不得繞過登入。
後續發布前須在有權限的平台讀取當前版本及原始碼並比對，保留任何新修改。

- Sites ID：`appgprj_6ab47d9a2d1881919a796ec9b609c7b4`，保留私人分享與既有資料。
- Netlify 前台 ID：`5bddbf98-7e39-4173-a0d9-9759be24fbc9`。
- Netlify 後台 ID：`ceb0a789-be1d-4465-a2c8-97451ae06717`。
- 已改名：`adela-purchasing-agent-shop`、`adela-purchasing-agent-admin`，原兩站ID未變。
- 原前台 draft：`6aca904822b00e5a18be294c`，對應原始碼 `00ba5b94c3b5a5c8b4ad22e36ba255ee95216c5e`。
- 原前台正式版 `6aaebcb75b7bbc4e32221b9b` 未被替換；後台也尚未更新。
- 既有兩站 backend：`https://kk-purchasing-agent.kaichuang0808.workers.dev`。

原 draft 現在可連線：首頁200，`/api/shop` 回503「後端尚未完成R20更新」，
`/api/ai-provider` GET回405，前台profile `/admin`回404。
503防護表示既有Worker仍不符合R20格式，不能把它當成可購物完成版。
更早文件中的該draft CONNECT403是當時的限制，已不適用這次HTTP檢查。

## 已完成

1. `scripts/build-netlify.mjs` 新增 `admin` 模式，後台輸出獨立至 `netlify-admin-dist`。
   根目錄和 `/admin` 都是管理介面；前台 `storefront` 模式仍不輸出後台HTML。
2. `netlify-admin.toml` 為後台部署設定，保留同一共用proxy與後端。
3. 後台標題改為完整 Adela 品牌；Netlify後台的前台連結指向目標Adela網址。
   Sites未設定該public變數時保留既有 `/` 行為。
4. 保留R20取消新儲值、既有餘額／历史、轉帳退款、浮動服務費及95%價格上限。
   沒有改動會員、訂單、帳本、資料庫或Cloudflare設定。
5. 提供 `scripts/verify-netlify-admin.mjs`、實際375／390／430px Chromium截圖及結果。
   登入、九個管理頁、更多導覽、商品編輯／價格缺證警告、AI未設定狀態及儲存按鈕皆檢查。
   價格缺證未顯示合格；未設定AI的草稿按鈕停用；儲存按鈕可捲動至可见範圍。
6. 分包工具支援未發布準備的明確標籤，`published=false`；不再要求把準備檔假標為發布。

## 安裝、執行、測試、建置

Node.js >=22.13；本環境Node24.19.0、pnpm11.25.0、Playwright1.58.2、Chromium。

```bash
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit
node scripts/verify-netlify-r20-proxy.mjs
KK_NETLIFY_TARGET=storefront node scripts/build-netlify.mjs
KK_NETLIFY_TARGET=admin node scripts/build-netlify.mjs
ADELA_PLAYWRIGHT_MODULE=/workspace/adela-tools/node_modules/playwright/index.mjs node scripts/verify-netlify-storefront.mjs
ADELA_PLAYWRIGHT_MODULE=/workspace/adela-tools/node_modules/playwright/index.mjs node scripts/verify-netlify-admin.mjs
```

別的環境須安裝Playwright並將模組路徑指向自己的安裝；腳本使用 `/usr/bin/chromium`。
截圖在 `verification/netlify-r20/`（前台12項）及 `verification/netlify-admin/`（後台45項）。
這是實際瀏覽器視窗檢查，以合成API隔離資料執行，不是實體手機或線上金流／AI驗收。
proxy/Gateway的15項測試使用mock，不作真實provider連線證據。
原交接78項R20測試保留歷史紀錄，未在本階段全部重跑。

正式發布前必須通過最新來源／相同DB／後端相容檢查，再以官方CLI登入和已核實ID部署。
後台的config與publish目錄須明確選擇 `netlify-admin.toml`、`netlify-admin-dist`，避免錯傳前台。
發布後核對實際deploy ID、檔案hash、production指向、品牌、登入與共用API。

## AI免費方式與未完成條件

前次官方API查得 Netlify kc4study 為Free(`credit-free`)：300共享credits，當時使用0，
無付款方式、`auto_topup_enabled=false`、不可累積超額費用。下次操作前要重新核實。
禁止升級、買額度或啟用自動加值；免費配額與部署、流量、compute及AI共用，不是無限。
真實直接Gateway試呼叫曾回403 `free_direct_disabled`，免費方案須經Netlify Function。
2026-10-11 15:24（台灣時間）已用原draft Function成功呼叫真實provider：HTTP200、
要求與實際模型皆 `gpt-6.1-sol`、狀態completed、回覆OK、共15tokens。
測試後API仍顯示Free、autoTopup=false、overages=false、當時已用credits=0（計量可能延遲）。
成功紀錄 `verification/netlify-r20/function-provider-test.json`；不是mock。
這證明免費模型通道可用，前後台各個業務AI路徑仍需原backend接入，不得稱網站AI全部已啟用。

前台客服／照片查價、後台AI新增／編輯／批次會經共用後端，再透過
`KK_AI_GATEWAY_URL`／`KK_AI_GATEWAY_SECRET` 或自有OpenAI設定呼叫provider。
單獨發布HTML不會完成後端Gateway綁定。必須記錄要求模型與服務商實際回報模型。
自己的OpenAI API不是本次要求的免費方案，不會替使用者建立付費API。

官方CLI重新登入已成功，平台授權保留，不再缺Netlify帳號存取。
Cloudflare尚缺安全的 `CLOUDFLARE_API_TOKEN`；不得要求在聊天貼憑證。
原Worker的D1／R2綁定與Sites是否同一資料庫尚未核實，不能新建或切換DB。
不要直接執行舊 `scripts/deploy-cloudflare.mjs`：它會套用所有remote migrations，
未核對原DB及已執行遷移前可能重播0025。先安全讀取綁定、備份，再規劃必要更新。
Cloudflare後端／DB切換及Stripe仍需另行核准。
Email、手機Web Push、無人開頁排程和完整商品證據仍未完成驗證，沿用R20缺口報告。

## 交付與personal account接手

本次完整ZIP的部署範圍與原始碼SHA載於根 `PROJECT_STATE.json`。
不能把它標為已核實線上Site最新版或先前00ba5b94 draft的部署原始碼。
各包小於32MiB，全部下载並依還原工具驗證SHA256／CRC／逐檔manifest；
含全部前後台程式、必要資產、鎖檔、遷移、部署設定、測試結果與未完成清單。
不含node_modules、秘密、登入憑證；ZIP不等於線上資料庫備份。
GitHub的下載分支提供檔案本體，不須工作區Preview才能下載。
接手個人帳號仍須移交同一Sites權限、Netlify原兩站／團隊權限、GitHub、Cloudflare
Worker／D1／R2／cron與平台安全綁定，原始碼不會自動移轉帳號所有權。
