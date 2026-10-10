# R19 接手狀態（2026-10-10）

本輪未發布，沒有新 Site 版本，沒有 Finalize。Sites 預覽發布已获使用者授權，不需再批准。

## 原 Site 與來源

- project_id：appgprj_6ab47d9a2d1881919a796ec9b609c7b4
- 前台：https://adelas-korea-shop-preview.workspace-558703.chatgpt.site
- 後台：https://adelas-korea-shop-preview.workspace-558703.chatgpt.site/admin
- 實讀最新 Site 版本：29／R17；來源 HEAD 與基準同為 836405042c07c141b48491b3dc81e09695e9f272。
- 附件宣告的 R19 本機 commit：a8f5047a918195c864c69f646f271b741d8b9e18。ZIP 不含 Git 物件，因此該 SHA 是附件來源宣告；已按其 manifest 完整核對內容，沒有把該 SHA 冒充線上 commit。
- 六包 CRC、五個來源／資產包 SHA256、1,053 個檔案的大小與 SHA256 全通過；還原至空目錄。
- 相較 R17：37 個既有檔案不同、268 個新增檔案；417 個缺席檔案全部是 .next-corrupt-20260919／.next-pre-feature-check 舊產物。移除上述產物並保留 Git 歷史。package.json、pnpm-lock.yaml、Site ID 與 DB／BUCKET 綁定不變。修復 ZIP 還原時遺失的既有 Git executable modes。
- 本輪額外變更僅交接／包裝與驗證結果，候選 commit 記於分包根目錄 PROJECT_STATE.json。

## 資料庫發布前必要條件：未滿足

實際 Sites DB overview 回傳 DB 綁定與使用者表清單。kk_topups 讀到 11 欄、一筆現有資料，回應無截斷。僅核實欄名與列讀取；未匯出或把真實資料放入 Git／ZIP／聊天。

現有 Sites 能力只提供表清單與有界分頁資料讀取，不提供完整 CREATE SQL、索引、trigger、FK、已套遷移紀錄或備份／還原工具。原 R17 system/status 僅有部分表存在檢查，沒有安全備份入口。故不能宣稱現有 schema 已完整確認、0025 尚未套用或已有安全備份，也不能宣稱平台會將0025所有步驟原子執行。本輪未呼叫部署、未執行線上遷移或金流測試。

下一步必須透過同一 Site 的平台安全操作環境取得：

1. 原 DB 綁定身分、完整 schema（含索引／trigger／FK）及已套遷移紀錄。
2. 本次遷移前可還原的安全備份／還原點，以及備份時間與還原程序；原始碼 ZIP 不能替代。真實個資備份另行安全保管，不混入交接原始碼包。
3. 受支援的一次性原子遷移途徑；只在0025未套用且實際 schema 相容時套用，將 migration ledger 與變更作適當一致性保護。不得重播0000–0024、不重算歷史贈額。若有額外欄位、索引、trigger 或 FK，先修正相容方案。
4. 執行後逐欄比對歷史 kk_topups 與相關帳本、確認索引及遷移紀錄。財務測試繼續使用隔離資料。
5. 重新讀取最新 Site／source，保留任何後續更新；沿原 project 私人發布，记录真實版本及 commit 後另交付發布匹配分包。

這是存取能力與使用者指定前置條件的缺口，不是新增加的發布批准要求。請在具有上述 DB 安全操作能力的同專案環境續作；不要在聊天貼密碼或金鑰。

## 本輪重新執行的驗證

TypeScript 與 Sites 原配置 build 通過。各脚本輸出及 exitCode 見 verification/r19-takeover/。

|檢查|通過數|範圍|
|---|---:|---|
|R19 guarded catalog|14|隔離 D1，保留後台較新修改及歷史資料|
|Le Labo checkout|7|隔離 D1，公開參考匯率，不代表核准採買匯率|
|AI routes|8|mock|
|Netlify gateway|7|mock，未部署 Netlify|
|Photo quotes|20|mock|
|R18 APIs|21|隔離 D1，儲值／伺服器定價／批次保護|
|R18 pricing|18|純計算|
|R18 migration|4|記憶體 SQLite，非線上遷移|
|R17 regression|22|隔離資料|

合計121項檢查通過。沒有真實金流寫入。本輪瀏覽器工具不可用，未新啟動瀏覽器；附件的84項手機尺寸檢查與78張截圖是前輪證據，已保留在 MOBILE_R19.html 與 verification/，不能稱作本輪線上或實體手機驗收。

## 未完成／未驗證

- 來源重建234規格中216仍有至少一項商品證據缺口；不代表線上數量。详 CATALOG_R19_GAPS.md。
- Le Labo 多款香水成本高於95%比較上限，不能捏造低成本或抬高比較價；詳 LE_LABO_R19_REVIEW.md。
- 實讀 runtime revision5 只有模型名稱 gpt-6.1-sol，未見 provider 金鑰／Gateway；真實 AI 未接通驗證。
- 手機 Push、Email、背景排程仍未端到端驗證。
- 完整 DB schema、備份、0025 執行狀態與原子遷移尚未核實；Sites 預覽未發布。
- Netlify 須使用者確認可 Finalize 後再取得 publish 核准；Cloudflare 後端／資料庫切換與 Stripe 啟用需另核准。本輪均未執行。

本包為完整候選原始碼與資產，非線上 DB 備份，非已發布版本。私人分享與既有服務綁定未修改。
