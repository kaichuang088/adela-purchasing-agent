# R19 AI 與通知現況（2026-10-10）

> 2026-10-10 接手更新：已使用 Sites 讀取同一專案最新版本 29／R17 與原始碼，確認 HEAD 為 836405042c07c141b48491b3dc81e09695e9f272。R19 已整合、建置及隔離測試通過，但未發布；阻擋是完整線上 DB schema／遷移紀錄、安全可還原備份與原子遷移能力。下文原交接的「沒有 Sites 工具」屬上一輪歷史狀態。本輪實際結果以 TAKEOVER_R19_STATUS.md 為準，候選 commit 以分包根目錄 PROJECT_STATE.json 為準。

本輪已實際讀取 Sites runtime revision 5：存在 ADMIN_PASSWORD、OPENAI_MODEL（gpt-6.1-sol）、SHOP_PUBLIC_URL、VAPID_PRIVATE_JWK、VAPID_PUBLIC_KEY。未見 OPENAI_API_KEY、AI Gateway 設定、RESEND_API_KEY 或 EMAIL_FROM。只有模型名稱與 VAPID 設定不能證明真實 AI 或通知送達；沒有修改秘密或設定。以下保留原交接研究與實作說明。

本次能讀原始碼與公開採買來源，沒有 Sites／Netlify／Cloudflare 管理工具。原私人 Sites 的 `/api/system/status` 回應401平台登入頁，未取得當前原始碼、秘密綁定、後端 identity、訂閱、發送紀錄或排程紀錄。這是存取能力缺口，Sites 更新本身已獲使用者授權。

## 呼叫路徑及已修正問題

|功能|程式呼叫路徑|服務|
|---|---|---|
|前台客服|messages API → support-ai → aiConnection|Gateway URL；未設則 OpenAI `/v1/responses`|
|前台照片查價|photo-quotes → request-data|同一個已驗證endpoint／模型／授權模式|
|後台重新分析|run-analysis → request-data|同上|
|AI新增／編輯|operations/ai-product → aiConnection|同上；研究模式web_search|
|批次AI|operations/ai-scan → aiConnection|同上；供應商回覆仍為未確認草稿，核准須通過伺服器定價檢查|
|AI管理指令|operations/ai-command → aiConnection|同上|
|模型檢查|operations/ai-check → aiConnection|真實小範圍請求會分別回報要求模型及provider回傳模型|

原照片分析在direct模式仍可能因殘留Gateway secret而送错授權；本次修正為只有Gateway模式才帶Gateway secret，direct只送provider Bearer。後台各入口也改用同一helper，避免各自重組URL、模型及授權。部署腳本預設模型由舊gpt-5.5更正為gpt-6.1-sol，**未執行Cloudflare部署**。

Netlify一般API須以`KK_BACKEND_URL`連回正確資料後端，因此只部署Netlify前台不能提供會員、資料庫或AI服務。`/api/ai-provider`另外需要Gateway secret、provider HTTPS base URL及provider認證。R19原始碼要求`NETLIFY_AI_MODEL`與後端要求模型一致；不一致回409，尚未送provider，不再靜默覆寫模型。缺授權或錯誤endpoint明確失敗，不顯示為成功。**Netlify檔案只修改來源，未建置發布／上線；必須先由使用者確認可Finalize，再取得publish核准。**

當前Netlify URL、`KK_BACKEND_URL`、Gateway URL、模型覆寫及是否指向同一backendId仍未取得；未查明不能填入猜測值。`OPENAI_MODEL=gpt-6.1-sol`是要求值，不代表provider有該模型權限或成功。真實provider呼叫尚未完成，8個AI路由檢查、20個照片分析檢查與7個Netlify gateway檢查都是隔離mock，不是接通證據。

## 通知逐項結果

|種類|來源實作|證據與未驗證事項|
|---|---|---|
|站內|kk_messages／通知中心|隔離API確認儲值5000+600核款通知包含保存的600；線上未驗證|
|Web Push|sw.js／push-settings／push API／web-push|程式有訂閱、權限及VAPID；線上訂閱、發送紀錄、手機實收未驗證，有keys不等於送達|
|Email|email-outbox／Resend|需要安全設定的RESEND_API_KEY與有效EMAIL_FROM；當前值與真實收信未驗證；儲值站內通知不能冒充已寄Email|
|排程|worker.ts scheduled、vite.config.ts每分鐘cron|會執行付款提醒、購買時點、Email／Push並保存成功時間；實際平台是否啟用與無人開頁成功紀錄未取得|

本機process未有可用實際provider／平台認證，這不證明線上當前沒有設定。交接runtime revision5缺API key／Gateway是歷史狀態，沒有把它冒充今天的線上檢查。不能以開頁補跑、TypeScript、SSR、mock或HTTP公開商品查核代替真實AI／通知／背景排程驗收。

秘密只透過平台安全設定綁定，不寫入Git、ZIP或聊天。personal account交接仍需同Site存取、同資料綁定及真實服務驗收，見PERSONAL_ACCOUNT_HANDOFF.md。
