# AI 與通知查核（未完成線上驗證）

以下路徑已由原始碼查核；本機型別、建置或 mock 測試不算 provider／手機送達成功。本次沒有 Sites、Netlify 或外部 Cloudflare 管理工具，不能讀取當前線上秘密綁定、訂閱表、發送紀錄或排程配置。環境機器的變數也不能代表 Sites runtime。

|入口|實際程式路徑|對外服務|
|---|---|---|
|前台 AI 客服|`app/api/messages/route.ts` → `lib/support-ai.ts` → `aiConnection`|設定的 `KK_AI_GATEWAY_URL`；否則 OpenAI Responses API|
|照片查價與後台重查|`app/api/photo-quotes/route.ts`、`lib/run-analysis.ts` → `lib/request-data.ts`|相同 Gateway／Responses API；需實際商品與圖片權限|
|後台 AI 新增／編輯|`app/api/operations/ai-product/route.ts`|Gateway／Responses API，研究模式使用 web_search|
|批次 AI|`app/api/operations/ai-scan/route.ts`；管理命令 `ai-command/route.ts`|Gateway／Responses API；核准後仍由伺服器價格檢查把關|
|模型連線檢查|`app/api/operations/ai-check/route.ts`|小範圍 Responses 請求，核對回覆 token，分別回報要求與 provider 回傳模型|

`lib/ai-config.ts` 決定 direct／gateway，要求有效 HTTPS endpoint 與 Gateway secret，或 direct API key。原始碼預設 `gpt-6.1-sol`；這不等於帳號有模型權限或成功呼叫。本次未取得可用 provider 認證，未執行真實模型成功呼叫。

Netlify 前台的一般 `/api/*` 由 `netlify/functions/kk-proxy.ts` 轉送到 `KK_BACKEND_URL`。只部署前端不會提供資料庫、會員或 AI 後端。`/api/ai-provider` 要求 Gateway secret、provider base URL 與有效 provider 認證；沒有 direct `OPENAI_API_KEY` 時，`NETLIFY_AI_MODEL` 可以覆寫模型。當前線上 `KK_BACKEND_URL` 與模型覆寫值**未取得**，無法確認與原 Sites 後端相同。

模型檢查介面已避免在 provider 沒回報模型時用設定值冒充「已驗證實際模型」。回覆格式成功、要求模型、回報模型與是否名稱一致分開顯示。

|通知種類|已有實作|本次證據與缺口|
|---|---|---|
|站內訊息|`kk_messages`、前台通知中心；核款後新增訊息|隔離 API 測試確認新 5000 方案訊息包含保存的 600 贈額；線上資料未讀取|
|Web Push|`public/sw.js`、`app/push-settings.tsx`、`app/api/push/route.ts`、`lib/web-push.ts`|VAPID 設定、訂閱、permission、手機背景收訊及真實發送紀錄未驗證|
|Email|`lib/email-outbox.ts`、`worker.ts`，使用 Resend|需要 `RESEND_API_KEY`、有效 `EMAIL_FROM`；線上設定與收信未驗證。既有 Email outbox 主要針對有 order_id 的訂單訊息，不把儲值站內訊息宣稱為已寄出 Email|
|背景排程|`worker.ts` scheduled handler，編譯配置有每分鐘 cron，保存 `adela_last_scheduled_success`|此為程式與配置意圖，不證明 Sites／外部 Cloudflare 的實際排程已啟用或無人開頁時成功執行|

發送只在原已授權後端執行；不得建立新資料庫驗證真實使用者通知，也不把開頁時補跑當成背景排程。交接記錄的 Sites runtime revision 5 是歷史摘要：曾有模型名稱、管理員密碼與 VAPID，當時沒有 API key 或 Gateway；本次未重讀線上設定。
