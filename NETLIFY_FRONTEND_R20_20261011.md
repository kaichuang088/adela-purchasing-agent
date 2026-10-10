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

使用者已要求發布最新版前台，部署授權仍須來自其選定的 **另一個 Netlify 帳號**。
該帳號必須有既有前台專案的部署權限；此 Chat 的 Google 帳號不會成為 Netlify
部署身分。若專案屬於其他帳號，先確認團隊權限或另外安排正式轉移，不能偷偷新建替代站。

`NETLIFY_AUTH_TOKEN` 尚未注入。本環境對 `api.netlify.com` 和兩個既有 Netlify
站的 HTTPS CONNECT 被網路代理拒絕 403；這不是目標網站本身的 HTTP 狀態。
因此目前沒有讀到 Netlify owner、site ID、既有設定或線上後端內容。

環境草稿已保留原設定並加入 Netlify API／官方文件／兩個站的必要網域，
`NETLIFY_AUTH_TOKEN` 為 user-provided 安全需求，目的地限 `api.netlify.com`。
使用者須在環境設定安全填入所選帳號權杖並儲存／發布；草稿儲存不等於已套用。
`NETLIFY_SITE_ID` 可暫留空，現有前台域名已知，接通 API 後查出實際 ID。

接通後必須先讀既有 `KK_BACKEND_URL`，確認 API 可用、R20 資料結構及同一個 backendId。
前台或後台的網頁網址不能直接當成真實資料後端。原私人 Sites API 一般請求回 401；
不能假冒平台登入或偽造身份 header 繞過。若既有 backend 未具備 R20 行為，先提出
具體差異及必要更新，不發布會導致前台／結帳金額不一致的配置。

## 接續部署

先安全驗證 Netlify 帳號、前台 project ID、所有權及既有 backend 設定。
不要把 token 放到命令列 `--auth`、Git、ZIP 或聊天。工具會讀安全注入的環境變數。

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

Netlify 官方 `@netlify/ai@1.0.1` SDK 已經由 npm 下載並通過官方 SHA512 integrity。
它實作取得 site/account AI Gateway token 與 provider 端點的流程，證明 Netlify 有
由平台提供 gateway 授權的方案；使用者不一定要自行取得 OpenAI API key。
這不證明其特定帳號的免費額度、計價、模型可用性或本網站已連通。
官方來源：<https://github.com/netlify/primitives/tree/main/packages/ai>。

前台客服／照片查價、後台 AI 新增／編輯／批次都需要共用後端真的成功呼叫 provider。
單獨發布後台 HTML 不會啟用 AI；部署 Netlify 前台也不會自動配置 Sites 的 AI bindings。
若帳號有足夠免費 Gateway 額度，可按已核實的端點、授權與模型接入，設定限額，
不啟用自動付費加值。免費配額與支援模型必須以該帳號當下方案為準。

R20 的 `OPENAI_MODEL=gpt-6.1-sol` 仍只是要求值；沒有成功 provider 回傳證據，
不能保證該模型在免費方案可用，也不會默默改成另一個模型。成功啟用必須用真實
provider 小範圍測試，記錄要求與實際模型及成本／額度；mock 不算接通。

Cloudflare backend／資料庫切換與 Stripe 仍需另外授權。先保留原資料、歷史快照
與退款／購物金紀錄。AI、Email、Push、無人開頁排程仍未完成實際連線驗證。
