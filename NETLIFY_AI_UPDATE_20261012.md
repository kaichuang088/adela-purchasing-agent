# Adela Netlify／Cloudflare AI 更新

沿用 R20／Sites v31 匯出基準與原 Netlify、Worker、D1 IDs；本次更新不發布 Sites。
前台： https://adela-purchasing-agent-shop.netlify.app
後台： https://adela-purchasing-agent-admin.netlify.app

前後台共用 Cloudflare R20 後端，再由前台 Netlify Function 呼叫 Netlify AI Gateway。
要求及實際成功回報模型為 `gpt-6.1-sol`；不需要自有 OpenAI API key。
免費 credits 與部署、流量共用，不能視為無限用量；不得購買額度、升級或開啟自動加值。
後台仍需 Netlify 帳號存取與原管理員密碼，保留兩層登入保護。

本次修正照片查價：原本小於 800KB 的圖片會原樣送出，實際約 600KB 的照片
被免費通道以 `input_tokens_exceeded` 拒絕。上傳現會自動調整圖片尺寸與 JPEG 品質，
控制在 24KiB；若仍不能壓縮，要求裁切為單一商品。伺服器對 Gateway 路徑也檢查上限，
阻止其他入口直接傳送大圖。圖片辨識最多三次搜尋，輸出上限 4000 tokens。
壓縮不取代品牌、容量、包裝與商家來源核實；缺購買證據時仍拒絕建立報價／訂單。

驗證：TypeScript、前後台與 Worker 建置通過；15 項 proxy 檢查、29 項隔離 R20
金流／退款／售價檢查、20 項照片流程回歸通過。實際 Chromium 把 605423 bytes
商品照片轉為 22330 bytes、896×896 JPEG，符合預算，原小圖保留、損壞大圖拒絕。
修正後的編譯照片 API 透過實際 production provider 收到 completed、gpt-6.1-sol；
該測試未取得韓國可購來源，因此回 422，沒有建立訂單或假造報價。
前台客服有 production 成功回覆；後台新增草稿、批次查詢、指令解析已以編譯 handler、
隔離 D1 和真實 provider 驗證；不等於使用原管理員密碼完成 production 登入驗收。

Cloudflare 原 D1 的十二個缺少遷移已逐一套用，未重播已套用項目；每分鐘 cron 已有
`adela_last_scheduled_success` 實際成功紀錄。沒有 VAPID／Email 服務設定，因此不能
宣稱手機 Push 或 Email 已可送達。無人開頁排程成功不等於通知送達實體手機。

本次實際部署 IDs、原始碼 SHA、手機截圖、完整 ZIP 與剩餘事項以交付根目錄
`PROJECT_STATE.json`、`README_FIRST.md`、`deployment-evidence/` 為準。
歷史文件的「缺 Token／後端未升級／尚未批准發布」已被本次授權和實測取代。

personal account 交接：程式 ZIP 不移轉 Sites 私人權限、GitHub 權限、Netlify 或
Cloudflare 帳號／秘密。新聊天需連接原 GitHub，另行登入原 Netlify／Cloudflare，
並透過安全設定提供所需憑證；不要在聊天或原始碼貼值。ZIP 不等於線上資料庫備份。

安裝、前後台建置與既有瀏覽器檢查依 `NETLIFY_FRONT_ADMIN_20261011.md`；後端先
`pnpm build`。只執行尚未套用的 D1 遷移，保留 `ADMIN_PASSWORD` 等既有 secret bindings。
本環境的靜態資產臨時 JWT 上傳被代理拒絕，因此 Worker 更新保留原 ASSETS；
前後台圖片、字型及其他 R20 資產由 Netlify 完整提供。可重現部署配置與實際 bundle
SHA256 另附於交付的 deployment-evidence，沒有憑證。
