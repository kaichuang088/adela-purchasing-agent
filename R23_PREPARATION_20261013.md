# R23 準備版：尚未發布到正式網站

本文件及 `PROJECT_STATE.json` 優先於 R22 的歷史交接文件。正式前後台仍為 R22；本次修改、0030 遷移及商品來源補丁尚未套用至正式環境。

## 已準備的修改

- 前台手機整頁購物車；通知設定移至通知中心；移除品牌快捷列及首頁通知面板。
- 前後台 AI 的手機與桌面聊天、Enter 傳送、Shift+Enter 換行、Markdown、歷史、新對話與備份。後台可附 4 張照片；商品及訂單操作先預覽再確認。
- 後台會員代下單獨立分頁、多品項與照片／規格 ID；商品搜尋、訂單私人備註，以及已支援的訂單通知、取消及延期操作。
- 香水按店主授權以未稅商品價加預設 2% 代購費計價；含稅採購成本仍保留，價差列為店家吸收。必要韓國配送不扣稅，不宣稱已取得退稅。金鑽既有零代購費例外保留。歷史訂單與帳本沒有重算。
- Le Labo 8 款常規淡香精共 24 個容量規格的韓國官方價格、台灣同規格價格及照片；其中 THÉ NOIR 29 100mL 確認缺貨。11 個原資料列以完整舊值比對保護，避免覆蓋管理員後來修改的內容。重複草稿停止新增上架。
- Aesop 六款 50mL 的韓國／台灣同 SKU、現價、供貨及官方免運政策；以商品本身的 50mL 價格計算，未套用同頁 100mL 價格。
- CITRON 28 首爾限定的 15／50／100mL 研究記錄；門市現價及供貨尚未取得，沒有偽造報價或庫存。
- 照片查價先辨識，再核對目前官方 SKU／價格／供貨；來源不足才進一步研究。照片任務設有共用期限，失敗不自動反覆消耗額度。型號、容量及多件包裝須符合來源。
- Brevo 交易通知寄信接口與送信佇列。供應商接受不等於收件匣送達；不確定的送信結果進人工檢查，避免重寄。

## 驗證與實際限制

TypeScript、後端及前後台靜態建置通過。265 項本地檢查：80 工作流程、29 財務、29 價格、6 寄信接口、7 背景照片任務、114 Chromium 介面檢查。測試會員／訂單為隔離資料；模擬 AI 或寄信接口不代表所有正式服務均已驗證。

本輪只有 2 次真實圖片辨識模型呼叫，模型回報 `gpt-6.1-sol`。其中一份已保存的辨識結果與當前官方來源在隔離環境成功報價；没有建立真實訂單。這不能證明所有照片或搜尋結果皆準確。

使用者確認 iPhone 實際收到系統通知。Android 功能已有實作，實體裝置送達仍待驗證。

商品核對仍有 **195 個問題**，包括台灣同規格比價、韓國來源、規格與庫存、必要配送，以及成本與售價上限衝突；沒有假造歸零。詳見 `verification/r23/catalog-remaining.json`。不能以找到網頁或相似照片直接認定可以販售。

來源網域恢復可讀後，219 個公開來源重新檢查，有 210 個 HTTP 200、129 個含結構化資料。這是網頁可讀性檢查，沒有直接更改價格／供貨核實狀態。Aesop 賦活芳香護手霜 75mL 與壓頭手部清潔露 500mL 的原官方照片已取回並快取，沒有以相似規格或缺壓頭圖片替代；來源及檔案 SHA 記錄在 `verification/r23/evidence/image-repairs.json`。

使用者提到連接 Brevo，但提供的截圖為 MailerLite。本對話目前沒有 Brevo app 工具；唯讀检查原 Worker，`BREVO_API_KEY`、`RESEND_API_KEY`、`EMAIL_FROM` 均不存在。因此尚未寄出或驗證真實 Email。必須確認實際服務、已驗證寄件人，再於平台秘密設定提供交易寄信憑證；不要貼在聊天。

## 發布與額度

最新額度基準為使用者提供的 827.4 credits，至少保留 750。本準備版尚未新增 Netlify 部署、Cloudflare 部署或正式資料遷移；沒有購買、升級或開啟自動加值。帳號用量 API 延遲值不能代替當前額度。

使用者要求等待 Email 設定完成並核對其要求後再發布。GitHub 推送被自動核准審查拒絕，理由是完整程式、PDF 與驗證資料傳至新分支缺少明確授權。目前只建立本地準備分支；等待使用者對具體 payload／儲存庫／分支的同意，不繞過拒絕。準備分支只包含原始碼與文件；兩個 Netlify 站未連接 GitHub 自動部署，沒有連動 workflow。本分支不是正式版本。

正式發布時保留原 Worker、D1、ASSETS、所有變數及秘密。先驗證並套用 `drizzle/0030_admin_order_notes.sql`，再建置当前 commit。外部舊 `deploy-backend-preserve-assets.py` 會讀取舊 R22 dry-run 檔案，且僅保留 secret bindings；不得直接執行，需先修正及核對完整綁定。不要以新 commit 標註舊 bundle。

## 手機操作 PDF 與開發

- `public/manuals/Adela_R23_Front_Mobile_Guide.pdf`：不包含後台網址／管理員代下單章節，含加入主畫面、通知及整頁購物車。
- `public/manuals/Adela_R23_Admin_Mobile_Guide.pdf`：每日工作、會員代下單、商品、AI、核款、排程與通知。
- PDF 為本地準備畫面，不是已更新正式站的截圖；示例金額不能用來匯款。

使用既有 `/workspace/adela-purchasing-agent` checkout，保留修改，不建立 worktree。Node >=22.13、pnpm 11.25；以 frozen lockfile 安裝。執行 `node node_modules/typescript/bin/tsc --noEmit`、`node scripts/run-framework.mjs build`；前後台為 `KK_NETLIFY_TARGET=storefront/admin node scripts/build-netlify.mjs`。本地 scripts/verify-r23-* 使用隔離 D1，不需要新部署或真實模型費用。Chromium 在部分沙盒需獲准執行；不關閉 TLS 驗證。

原始碼 ZIP 不包含正式 D1／照片／線上對話資料庫備份，也不是平台帳號移交。秘密不進 Git、ZIP、PDF 或日誌。GitHub、Netlify、Cloudflare 及私人 Sites 權限需分別移交。
