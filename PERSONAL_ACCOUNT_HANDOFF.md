# 交接回 personal account — R20

2026-10-11 的 Netlify 前台部署準備另見 NETLIFY_FRONTEND_R20_20261011.md。
使用者要使用另一個 Netlify 帳號，須在該帳號／團隊下確認既有前台部署權限。
品牌為 Adela's Purchasing Agent；前台沿用 kk-purchasing-agent-shop.netlify.app，
後台沿用 kk-purchasing-agent-admin.netlify.app。當前尚未完成本次 Netlify 發布。
後續必須記錄兩站實際 Netlify project ID、擁有帳號／團隊、backendId、公開 API
存取及安全綁定。Chat 或 Google 登入、原始碼 ZIP 不會移轉 Netlify／Cloudflare 所有權。

本次接續同一 Sites 專案 `appgprj_6ab47d9a2d1881919a796ec9b609c7b4` 第30版／R19，發布前原始碼為 `07b7d7d23a87bd32ea245020c4c1a940b872d4e9`。實際新 Site 版本、部署結果與相符 commit 載於分包根目錄 `PROJECT_STATE.json`，不要將文件中的預期版本當作發布證據。

最新操作／測試／限制以 `RECOVERY_R20_20261010.md` 為準。R19以前的未發布狀態文件僅作歷史紀錄。R20取消新儲值販售，保留既有餘額與歷史贈額；增加退款轉帳申請與每會員正數增減餘額。商品浮動代購費受台灣比較價95%上限約束，必要差額由店家吸收且真實成本保留。AI連線、Push、Email及排程仍須實際驗證。

交接必須帶上：

1. 該次實際 Site 版本、原始碼 commit、完整分包 ZIP、逐檔 manifest、各包 SHA-256、還原方式、測試與尚未完成清單。以本次根目錄 PROJECT_STATE.json 的真實部署結果為準。
2. 在正確工作區確認接收帳號對**同一個** Site 的讀取原始碼、修改、發布及私人分享權限。先確認平台支援的擁有權／跨帳號交接方式；尚未驗證本專案可直接轉移，不能預先承諾或新建 Site 代替。
3. 確認現有 D1、R2 與上傳媒體的實際歸屬、綁定、備份及可復原性。原始碼 ZIP **不等於線上資料庫備份**，也不包含會員、訂單、帳本與上傳媒體的完整資料備份。取得適當平台權限後另行安全備份；不將個資備份混入公開原始碼包。
4. 管理員密碼、AI／Gateway 授權、VAPID 私鑰、寄信金鑰及網域設定透過平台安全設定重新綁定。不得在聊天、Git 或 ZIP 傳遞值。保留使用中的 VAPID 與訂閱關係；若換鑰需要規劃手機重新訂閱及實測。
5. 記錄前台／後台與 Netlify 的 `KK_BACKEND_URL`、後端 `backendId`、AI endpoint、Gateway 授權和模型覆寫。網址相同或模型名稱已設定都不是端到端成功的證據。接收帳號需用實際 provider 做小範圍測試。
6. 分別驗證站內訊息、手機 Web Push、Email 與無人開頁時的背景排程，保存實際送達、發送失敗與排程成功紀錄。手機安裝方式、使用者授權及 iOS／Android 行為需要實體裝置驗收。
7. 發布前重新讀取最新 Site 原始碼並與交接版本比對；若有更新，合併後再測試。保留原資料、私人權限、舊訂單快照、已付款贈額及帳本。只在原資料庫套用尚未執行的遷移，不重播舊遷移。
8. Sites更新已獲授權，缺存取能力時不得以再次批准作為阻擋理由。正式Netlify須先由使用者確認版本可Finalize，再取得publish核准；Cloudflare後端／資料庫切換及Stripe啟用仍需另行核准。移轉個人帳號的所有權或外部服務歸屬也不由本次原始碼包自動執行。

交接完成的驗收是接收帳號實際能繼續維護同一個專案，且資料、秘密綁定、權限與必要服務都已核實；不是只成功解壓 ZIP。
