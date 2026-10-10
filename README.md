# Netlify 前台接續 — R20 / Sites 第 31 版

最新部署準備見 [NETLIFY_FRONTEND_R20_20261011.md](NETLIFY_FRONTEND_R20_20261011.md)。
以使用者提供的 R20 原始碼接續，品牌是 Adela's Purchasing Agent，Netlify 建置
選用 storefront 模式；目前尚未完成 Netlify production 發布。原 Sites 部署結果
仍以其交接包根目錄 PROJECT_STATE.json 為準；下方 R19 及更早內容是歷史紀錄。

# 2026-10-10 R19 接續修正版（尚未發布）

先讀 [最新交接](RECOVERY_R19_20261010.md)、[Le Labo逐規格比較](LE_LABO_R19_REVIEW.md)、[全商品缺口](CATALOG_R19_GAPS.md)、[AI／通知](AI_AND_NOTIFICATIONS_R19.md)、[手機尺寸截圖](MOBILE_R19.html)與[personal account交接](PERSONAL_ACCOUNT_HANDOFF.md)。本次有真實公開商品来源查核、25筆受保護商品資料更新、AI授權與Gateway模型一致修正。Sites發布已授權，但當前對話仍缺Sites存取工具，沒有新發布版本。

Netlify必須先確認可Finalize再取得publish核准。ZIP不是線上資料庫備份；真實AI、手機通知／Email／cron與全部商品定價不能以本機測試冒充成功。以下是歷史文件，最新狀態以R19交接及交付根目錄PROJECT_STATE.json為準。

---

# 2026-10-09 R18 本機修正版（尚未發布）

先讀 [最新交接](RECOVERY_R18_20261009.md)、[逐規格缺口](CATALOG_R18_GAPS.md)、[Le Labo](LE_LABO_R18_REVIEW.md)、[AI／通知](AI_AND_NOTIFICATIONS_R18.md) 與 [personal account 交接](PERSONAL_ACCOUNT_HANDOFF.md)。安裝、執行、建置、測試與安全遷移方式在最新交接。原私人 Sites 仍為使用者確認的第29版，本次沒有發布。

本機 TypeScript／建置通過；定價18、API21、遷移4、R17防回歸22、UI9、歷史644價格組合及3照片檢查通過。實際 Chromium 375／390／430px，84檢查與78張截圖通過；不是實體手機或線上 Sites 驗收。真實商品來源、全站／Le Labo最終定價、AI provider、Push／Email／cron與發布仍未完成或未驗證。

**以下為舊版歷史文件，涉及版本、測試數及狀態時以 R18 交接與交付根目錄 PROJECT_STATE.json 為準。ZIP 不等於線上資料庫備份。**

---

# 2026-09-30 保存修正版（尚未發布）

目前重播18組／394個具名本機檢查通過。先讀 [本次交接](HANDOFF_NOTES_20260930.md)、[逐項驗收](VERIFICATION_20260930.md) 與 verification/RELEASE_GATE.json。以下既有章節可能含歷史數字，不能當本次結果。

# Adela's Purchasing Agent

2026-09-29 修正版：**尚未完成全部需求，尚未發布，沒有可用的線上預覽網址。**

這份原始碼保留購物前台、管理後台、會員／訂單／優惠券／退款購物金及商品型錄。最新本機測試12組、310個具名檢查通過；TypeScript、Sites及Netlify建置通過。AI與Email測試使用模擬服務商，不能當成真實接通或完整驗收證明。

## 先看這些檔案

- `VERIFICATION_20260927.md`：逐项需求、已修正內容與尚未完成項目，已更新至2026-09-29。
- `verification/current-release-results.json`：測試組與結果；`verification/current-*.log` 為實際執行紀錄。
- `verification/RELEASE_GATE.json`：目前發布條件尚未成立。
- `DEPLOYMENT.md`：前台／後台共用資料的部署方式與未接通項目。
- `EMAIL_SETUP.md`：寄信設定、重試規則及真實驗收限制。

ZIP 是備份／交接原始碼，不需要為了看網站而下載或安裝。它不是「全部修好」的完成版，也不是雙擊即可連上正式資料的離線網站。線上預覽必須在發布成功後另外提供網址。

## 開發者操作

需Node.js 22.13以上及專案鎖定的依賴；依執行環境設定Sites profile，保留lockfile。原始碼在 `app/`、`lib/`，D1遷移在 `drizzle/`，Netlify代理在 `netlify/`。`.env.example` 只有設定名稱，不包含憑證。

- `npm run dev`：啟動開發伺服器。
- `npm run build`：建置Sites Worker與前端。
- `node scripts/build-netlify.mjs`：建置Netlify前台。
- `node node_modules/typescript/bin/tsc --noEmit`：型別檢查。
- `node scripts/verify-current-release.mjs`：在隔離資料庫執行目前12組測試，需先建置Sites。

**遷移注意：** `drizzle/0013`之後有手寫SQL，現有Drizzle snapshot未完整反映它們。不要把重新產生的schema差異直接套用；必須先檢查是否會刪表或覆寫既有資料。按SQL檔名順序，只套用尚未執行的遷移，切勿重播已執行檔案。`0018_email_outbox.sql`只新增寄信表、索引與觸發器，不回填歷史訊息。

不包含正式會員資料、付款資料、`.env`、API金鑰、`node_modules`或本機測試資料庫。
