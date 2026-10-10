# R20 Netlify 前台部署準備 — 2026-10-11

來源為使用者提供、已發布的同一 Sites 第 31 版交接包。原 Sites commit 是
`0418b8ed36a43ae973ca227f3ae0767fcdeec25b`，project_id 為
`appgprj_6ab47d9a2d1881919a796ec9b609c7b4`。七包 SHA256 與 CRC、六包內容
manifest 共 1,079 檔已核對；其中 1,052 個 source/ 檔案位元組完全符合匯出。
此 GitHub 分支接續 R20，另加入前台部署設定與檢查。它不是新的 Sites 發布。

## 目標與本次修改

- 前台：`https://kk-purchasing-agent-shop.netlify.app`。
- 現有後台：`https://kk-purchasing-agent-admin.netlify.app`；本階段先發布前台。
- 品牌為 **Adela's Purchasing Agent**。保留原圖案與風格；同步瀏覽器標題、
  description、品牌 accessibility label 及 PWA 完整名稱，沿用上述網址。
- `netlify.toml` 選用 `KK_NETLIFY_TARGET=storefront`。建置不輸出 admin HTML；
  `/admin` 與其子路徑回 404。既有 `both` 模式仍供將來明確授權的用途。
- API 和訂單文件由 `netlify/functions/kk-proxy.ts` 轉送同一個正確共用後端。
  資料與金流規則仍採 R20。前台部署不會自動將 R20 後端部署到 Cloudflare。

## 已驗證

- 最新 R20 TypeScript、Next Netlify build 通過；新的 storefront 模式另已建置。
- 使用 Netlify 官方打包器 esbuild 成功打包 `kk-proxy` Function。
- 真實 Chromium 的 375、390、430 px，各檢查首頁、購物金、退款表單及表單底部：
  12 項視窗檢查、12 張截圖。退款送出按鈕可捲動到可見範圍，確認前停用。
  圖片與結果在 `verification/netlify-r20/`。
- 瀏覽器使用合成 API 資料。沒有操作真實會員餘額、匯款或資料庫。
  這不是完整商品／結帳流程、實體手機、真實後端、AI 或 Push 的端到端驗收。
- 原交接記錄的 78 項測試保留為 R20 歷史證據，本階段未重跑它們。

## 帳號、權限與待完成條件

使用者已明確授權 Netlify 發布，並完成官方 CLI OAuth 登入。既有前台 site ID
為 `5bddbf98-7e39-4173-a0d9-9759be24fbc9`，後台為
`ceb0a789-be1d-4465-a2c8-97451ae06717`，所選帳號可存取兩者。
不需要重複詢問發布許可。登入狀態只存在原始碼之外的工具設定，交付不含登入憑證。

2026-10-11 重新查核：Netlify API、官方文件與前台已可連線。前台正式首頁仍是舊 KK
標題；`/api/shop` 可讀取 14 個舊格式商品。`/api/system/status` 回 404，後台站回401。
兩個專案的 `KK_BACKEND_URL` 都是
`https://kk-purchasing-agent.kaichuang0808.workers.dev`；與 Sites 同一 DB 尚未核實。
舊 payload 缺少 R20 `creditWithdrawals`、`creditTwd`、`photoQuotesPaused` 等欄位。
本次 Netlify proxy 對舊格式商品回503，且在任何資料寫入前先驗證 R20 payload，
防止新版 checkout 或退款指令送入舊 API。15項隔離 proxy/Gateway 測試通過。

環境草稿保留原網路設定並加入已查明的 Worker 網域；草稿不是執行中設定。
直接連 Worker 仍遭環境代理拒絕403，但經現有 Netlify `/api/shop` 已得到上述證據。
不會因這個阻礙新建資料庫、切換後端或修改現有會員資料。

先部署同一前台專案的 draft 測試版，正式域名暫不替換，直到確認後端相容。
Cloudflare 帳號登入尚未取得，該平台的 R20 更新與 DB 保留步驟須另外處理。

已讀到既有 `KK_BACKEND_URL`；接續必須，確認 API 可用、R20 資料結構及同一個 backendId。
前台或後台的網頁網址不能直接當成真實資料後端。原私人 Sites API 一般請求回 401；
不能假冒平台登入或偽造身份 header 繞過。若既有 backend 未具備 R20 行為，先提出
具體差異及必要更新，不發布會導致前台／結帳金額不一致的配置。

## 接續部署

先安全驗證 Netlify 帳號、前台 project ID、所有權及既有 backend 設定。
不要把 token 放到命令列 `--auth`、Git、ZIP 或聊天。工具會使用官方登入狀態或安全注入的環境變數。

```bash
cd /workspace/adela-purchasing-agent
KK_NETLIFY_TARGET=storefront node scripts/build-netlify.mjs
ADELA_PLAYWRIGHT_MODULE=/workspace/adela-tools/node_modules/playwright/index.mjs node scripts/verify-netlify-storefront.mjs
```

通過實際帳號／後端 preflight 後，對已核實 ID 執行已獲授權的 production deploy：

```bash
netlify deploy --no-build --dir netlify-dist --functions netlify/functions --site "$NETLIFY_SITE_ID" --prod
```

發布後實際驗證商品、登入、購物車、價格、付款、退款及 API 的資料來源；金流測試
限隔離資料。交付真實 Netlify deploy ID／網址／commit，以及完全相符的完整分包 ZIP，
每包小於 32 MiB，附 hash、CRC、逐檔 manifest、還原方式與未完成項目。
ZIP 仍不等於線上資料庫備份。當前沒有完成 Netlify production deploy。

## AI 與免費方式

官方文件與帳號 API 已核實 Free (`credit-free`) 方案：每月300 credits，
檢查時已用0；`auto_topup_enabled=false`、無付款方式、不可累積超額費用。
AI Gateway 功能開啟，provider 清單含 `gpt-6.1-sol`。網站部署、流量、compute與AI
共用配額；不是無限免費，不能升級、買額度或啟用自動加值。
官方文件：<https://docs.netlify.com/build/ai-gateway/overview/>、
<https://www.netlify.com/pricing/>。

已用平台正式授權對 `gpt-6.1-sol` 發送一個最多64輸出tokens的真實小範圍请求：
直接 Gateway 路徑回403 `free_direct_disabled`，沒有模型回傳或成功輸出，額度仍為0。
免費方案須再測試經 Netlify Function 的呼叫路徑；這次失敗不能算 AI 已啟用。
詳見 `verification/netlify-r20/provider-direct-test.json`。

前台客服／照片查價、後台 AI 新增／編輯／批次都需要共用後端真的成功呼叫 provider。
單獨發布後台 HTML 不會啟用 AI；部署 Netlify 前台也不會自動配置 Sites 的 AI bindings。
若帳號有足夠免費 Gateway 額度，可按已核實的端點、授權與模型接入，設定限額，
不啟用自動付費加值。免費配額與支援模型必須以該帳號當下方案為準。

R20 的 `OPENAI_MODEL=gpt-6.1-sol` 仍只是要求值；沒有成功 provider 回傳證據，
不能保證該模型在免費方案可用，也不會默默改成另一個模型。成功啟用必須用真實
provider 小範圍測試，記錄要求與實際模型及成本／額度；mock 不算接通。

Cloudflare backend／資料庫切換與 Stripe 仍需另外授權。先保留原資料、歷史快照
與退款／購物金紀錄。AI、Email、Push、無人開頁排程仍未完成實際連線驗證。
