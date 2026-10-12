# R22 — 聊天、採買延期、查價工作與手機操作

本原始碼接續 R21.3。實際 source commit、Netlify deploy IDs、Cloudflare 版本與是否已發布，以完整交付包根目錄 `PROJECT_STATE.json` 為準；不要把 R22 當成新的 Sites 版本。原私人 Sites project `appgprj_6ab47d9a2d1881919a796ec9b609c7b4` 未在本輪發布，也沒有更換資料庫。

前台：https://adela-purchasing-agent-shop.netlify.app
後台：https://adela-purchasing-agent-admin.netlify.app

## 本次功能

- 修正設定頁邊框寬度，電腦 AI 改成右下角不遮住整頁的白底聊天視窗；手機 AI 分頁保留。
- 正式 Netlify 後端停用客戶端偽造的平台身份標頭，只認合法登入 Session；原私人 Sites 伺服器未改。前後台聊天以安全 Markdown 顯示粗體與連結；新對話、歷史選擇與 JSON 對話備份。原前台對話不刪除，舊對話整理為「先前客服對話」。後台 R21 沒有保存原始聊天全文，無法補回不存在的對話；既有操作預覽表保留，R22 起的新對話持續保存。人工轉接顯示等待時間未知；新 AI 話題不取消其他對話的人工等候。
- 後台最多四張照片，自動壓縮至合計 24KiB；照片只經授權管理員路徑提供，商品確認後才複製為商品照片。商品／規格、照片、介紹、接單剩餘數量、价格及停售操作，先辨識商品，再用按鈕確認動作。商品編輯視窗的重複 AI 編輯入口移除。
- AI 可預覽採買區間及下一波日期：採買開始前一日 23:59 截止，最後一天後 00:00 重開。未指定下一波採買日期時明確標示待設定，不虛構日期。人工暫停與照片暫停仍獨立。
- 延期新增 48 小時期限，背景 cron 到期自動同意並排入指定下一波；接受後發一次性私人 5% Off。拒絕／賣家取消未買到品項按折扣後實付額退購物金，最後取消品項另包含剩餘應退運費。580 元享九折退款 522 元，不按原標價退款。併發、重複操作保留原鎖與帳本保護。
- 新「查價回報」每日工作：會員等級、AI 總價與查到的來源。來源不足仍保留照片，可由買家要求賣家人工查價；人工報價仍含會員代購費，買家可接受或取消。
- 「會員代下單」移到會員經營的獨立分頁，支援多商品、照片與商品／規格 ID。前台標示管理員建立，仍待買家付款及賣家核款。
- 商品搜尋支援名稱、品牌、精確商品／規格 ID。新增購物金券類型，伺服器驗證台幣正整數並一次性入帳，不能在結帳再次當折扣使用。新儲值商品仍依 R20 停售。
- 每日付款提醒區分超過三天未付款；前台明確說明「回報付款」不等於核款，只有收款確認後進入待買清單。
- 一般站內通知不需商品／日期篩選；管理員新訂單、匯款、人工客服、查價提醒與裝置 Push 訂閱。VAPID 私密資料只用平台安全設定。

## 安裝、建置與測試

Node >=22.13，pnpm 11.25.0：

```sh
pnpm install --frozen-lockfile
node node_modules/typescript/bin/tsc --noEmit
pnpm build
node scripts/verify-r22-workflows.mjs
node scripts/verify-r20.mjs
node scripts/verify-photo-quotes.mjs
node scripts/verify-recovery-notifications.mjs
node scripts/verify-recovery-scheduler.mjs
KK_NETLIFY_TARGET=storefront node scripts/build-netlify.mjs
KK_NETLIFY_TARGET=admin node scripts/build-netlify.mjs
```

本機執行：`pnpm dev`；生產 Worker 本機可用 `pnpm start`。Netlify 使用 `netlify-dist` 與 `netlify-admin-dist`，對應 `netlify.toml`、`netlify-admin.toml`。原 Cloudflare Worker／D1 綁定保留，新增僅 0028、0029 遷移；先核对 `d1_migrations`，不要重播歷史遷移，尤其 0025。

瀏覽器測試需額外安裝 Playwright 1.58.2 與 Chromium，不放入原始碼包：設定 `ADELA_PLAYWRIGHT_MODULE` 指向其 `index.mjs`，`ADELA_CHROMIUM` 指向 Chromium。執行 `node scripts/verify-r22-mobile.mjs`。該脚本啟動隔離 Miniflare／HTTP fixture，測試後關閉；它不使用真實會員餘額、訂單或真實模型。重現 PDF 可用 `node scripts/generate-r22-mobile-guides.mjs`。

## 證據與具體限制

`verification/r22` 有隔離流程、375/390/430/1280px 瀏覽器結果、逐規格缺口 CSV 與來源查核紀錄。完整交付另有正式網站測試、實際 provider 呼叫、部署／雜湊／下載驗證。Mock、TypeScript、SSR 均不是正式 AI 連線或手機實機測試。

商品核對清單仍有 210 項，沒有改名、隱藏或假設 ₩1 可售；查核 219 個既有來源網址，108 個可讀取，其他有網路限制／失效頁面。可讀取也不等於同規格、一般售價、必要運費及供貨皆已核實。`catalog-unresolved.csv` 逐項說明。本輪未憑頁面片段擅自改成本／比較價或批准虧損定價。未稅／退稅只在資格及商家證據成立時採用。

照片 AI 不保證所有商品都找得到真實購買來源；來源不足可交賣家，不能以推測總價下單。手機 Push 已支援設定、訂閱與發送紀錄，但物理手機送達須實際驗證；Email 缺少寄件服務與驗證寄件身份，仍未可用。

## 額度與 personal account 交接

使用者已買 Netlify Personal 並授權原前後台正式發布；不要再詢問同一個發布授權。本輪以 907 credits 為基準，最多 57、至少保留 850；前後台只集中發布各一次（官方 production deploy 每次 15 credits），只做小範圍 provider 查核。用量 API 延遲的 `used=0` 不是實際剩餘額度。沒有購買額度、升級、啟用自動加值、付費 Cloudflare 方案或 Stripe。

完整原始碼 ZIP 不含 node_modules、部署憑證、會員密碼、私鑰或線上資料庫備份。對話保存在原 D1，可透過各自授權的對話備份下載；移交 personal account 仍需另外備份原 D1、媒體及對話。移交原 GitHub repository、Netlify 兩個 Site、Cloudflare 原帳號 Worker/D1，以及私人 Sites 權限；保留原 Site IDs、資料庫 ID、Gateway 網址、共享秘密及模型一致性。請使用平台安全欄位，勿將秘密寫入程式、ZIP 或聊天。
