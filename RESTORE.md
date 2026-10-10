# 還原、安裝、建置與接續

1. 下載全部ZIP；先解壓Verification包，將其他ZIP放在同一目錄。
2. 執行 `python3 restore.py --destination ./Adela_R20_Restored`，目的地必須空白。
   會檢查各包SHA256、CRC、路徑安全、逐檔大小與SHA256，保留檔案模式。
3. `cd Adela_R20_Restored/source`；使用Node >=22.13，pnpm11.25；
   `pnpm install --frozen-lockfile`，`node node_modules/typescript/bin/tsc --noEmit`。
4. Netlify前台：`KK_NETLIFY_TARGET=storefront node scripts/build-netlify.mjs`；
   `node scripts/verify-netlify-r20-proxy.mjs`。安裝Playwright1.58.2並提供Chromium，
   `ADELA_PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node scripts/verify-netlify-storefront.mjs`。
5. Sites/Cloudflare完整後端執行與原R20隔離測試請讀source/RECOVERY_R20_20261010.md及README.md；
   不重播歷史遷移，尤其0025；0026在原Sites已執行，其他部署須核對各自DB狀態。
   不能把別的D1當原Sites DB，更不能將種子商品覆蓋會員/訂單資料。
6. Netlify CLI27.12.0可用官方 `netlify login --request 'Adela deployment'`、
   使用選定帳號批准，`netlify login --check TICKET_ID`；秘密不進聊天/命令列/原始碼。
   部署使用原前台site ID；普通 `netlify deploy --no-build --dir netlify-dist --functions netlify/functions --site 5bddbf98-7e39-4173-a0d9-9759be24fbc9` 是draft。
7. 使用者已核准Netlify發布；正式替換必須先核對R20後端兼容與同一原DB，
   然後才用同一已核實site ID加 --prod。本次尚未替換正式域名。
   Cloudflare後端/DB切換與Stripe另須授权；零付費要求持續有效，不能升級或自動加值。
8. 本次原始碼source/逐檔對應根目錄sourceCommit。根目錄交付說明及deployment-evidence
   記錄該commit之後的實際Netlify部署結果；不含Gitmetadata或任何平台秘密。
   ZIP不是線上DB備份，帳號所有權不會隨ZIP轉移。
