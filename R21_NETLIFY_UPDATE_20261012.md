# Adela R21：香水低費率、AI 工作助理與照片核價

以已發布 commit `ccc637413889fd1fd60d370065f1d8de333e26b6`（R20 / Sites v31 匯出基準）接續。本次更新原 Netlify 前後台及原 Cloudflare Worker，不發布或建立 Sites，不替換 D1。實際 commit、Netlify deploy ID、Worker version 和當次驗收見完整交付包根目錄 PROJECT_STATE.json。

## 變更

- 所有名稱辨識為香水／淡香精／淡香水的商品和客製照片報價，服務費上限為 `1% / (1 + 單件台幣成本 / 2000)`，再取個別商品上限、會員費率比例與已付款回購係數的較低值。不同會員仍有差異，金鑽 0%，未付款訂單不計回購。商品卡、規格詳情和 checkout 共用函式。實際成本、必要運費及歷史订单快照不修改；原先服務費已為零或受台灣上限限制的規格可能無法再降。
- 後台會員頁可建立一般 Email／密碼帳號（PBKDF2 雜湊）並代下單。已有 Email 不覆蓋。代下單共用正式購物車計價／庫存保留／冪等流程，不使用既有購物金或優惠券，預設待匯款，不能直接冒充已收款。會員可以普通登入查看訂單和回報付款。
- 電腦後台右下角為共用 AI 工作助理；手機下方加入 AI tab。使用 OpenAI 品牌圖示（Simple Icons v14 CC0 SVG），此商店並非 OpenAI 官方產品。
- AI 可在同一份操作預覽中提出多件商品新增／編輯／價格、商品停售、暫停新訂單、獨立照片查價開關；核對後一起套用。新商品列出各會員等級的規格估價與價格證據警告；不能把缺來源顯示為已符合。預覽十分鐘過期，重送及過期／資料變更會阻擋。各動作結果逐項回報，若失敗停止後續，不宣稱全批原子成功。保留批次商品研究、採買／到貨日期操作於同一入口。
- 小價差時 AI 可建議查核未稅／退稅採買路徑，需列含稅、淨額、退款手續費、必要運費和商業代購／轉售資格。沒有來源不能直接除以稅率，也不自動修改成本。
- 照片 AI 僅接受商家網頁搜尋引用、正確國家／幣別／規格／現貨、已確認必要運費條件。區分按單／按件運費，改數量不會將單次運費重複加算。買家看到含代購費總價並明確接受或取消；接受前無訂單。接受後待賣家 24 小時核價；確認原价後加入待付款購買清單，三日付款期限才開始。改價走原重新確認流程，不偷改買家已接受金額。
- 客製商品先核價，再從後台建立公開商品草稿，補上規格、台灣同規格來源和照片審核後才能上架。公開資料不帶買家姓名、Email、地址或私人備註。上架前仍需核對照片沒有個人資料／人像。
- 前台客服帶入相關商品、會員售價、開放時段、獨立開關和該會員訂單事實，可回答一般商品／香水與購買流程問題。不能捏造庫存、付款、取消或退款已完成。
- 後台密碼僅更新原 Worker 安全設定，從未寫入原始碼。Netlify 帳號前置登入解除，應用管理密碼與每個後台 API 的驗證保留。不要把密碼、Token、會員初始密碼放入交付包。

## 安裝、執行與檢查

Node >=22.13，pnpm 11.25。`pnpm install --frozen-lockfile`；開發 `pnpm dev`。TypeScript：`node node_modules/typescript/bin/tsc --noEmit`。Worker：`pnpm build`。

依序執行 `node scripts/verify-r21-workflows.mjs`、`verify-photo-jobs.mjs`、`verify-photo-background.mjs`、`verify-netlify-r20-proxy.mjs`、`verify-photo-quotes.mjs`、`verify-r20.mjs`。D1 與金融測試只用隔離合成資料。Mock 通過不等於真實 AI 連線。

前後台靜態建置：`KK_NETLIFY_TARGET=storefront node scripts/build-netlify.mjs` 和 `KK_NETLIFY_TARGET=admin node scripts/build-netlify.mjs`；輸出 netlify-dist 與 netlify-admin-dist。保留 `netlify/functions/kk-proxy.ts`、`ai-photo-background.ts` 和原平台安全環境變數。完整資產包括圖片、字型、OpenAI 圖示。

遷移 `0027_seller_photo_review.sql` 僅新增兩個核價時間欄位。只套用原 D1 尚未執行的 migration；不得重播 0025、重建或清空資料庫。

## 限制及交接

照片 AI 報價是有來源的預估，無法保證每次識別或商家資訊正確，最後仍需賣家核價。缺來源／運費會明確失敗。商品研究缺口不因修改 UI 或降低服務費而消失。AI 不能取得未知的實際匯款／庫存。

Netlify Personal 每月額度與網站共用，非 GPT 無限使用；保持自動加值關閉，追加預算需另行授權。秘密與平台權限不隨 ZIP／GitHub 移轉。Personal account 交接需另外授予原 GitHub、Netlify、Cloudflare、私人 Sites 的存取與安全秘密設定，不複製登入憑證。

完整 ZIP 不是線上資料庫備份。每次發布根目錄附部署資訊、來源 SHA、驗收、手機瀏覽器截圖及未完成項目；實體手機 Push／Email 不因本次更新而宣稱驗證。

## 正式實測後的 R21.1 後端修正

第一次實測客服已報 NT$5,851，但把設定表的8%基準費率當成該商品費率，且不知道價格已含費。因此伺服器新增 serviceFeeIncluded、實際服務費金額與有效費率，並明確區分基準上限與實際售價。後台 AI 收到完整會員費率、比例、匯率與已付款回購公式。這些是後端資料修正，不修改前後台 React／CSS／資產，Netlify 靜態部署沿用 R21 已核對的檔案。原 Worker 升級為修正版；完整 ZIP 同時記錄靜態部署基準與目前後端 source SHA。缺韓國來源時也明確說明「未取得證據不代表沒有販售」。
