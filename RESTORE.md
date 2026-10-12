# 安裝、還原與 personal account 交接

下載所有七包，執行 `python restore.py --destination ./Adela_R21_Restored`；工具核對各包SHA256、CRC和逐檔manifest。外層GitHub ZIP包含全部分包。

Node >=22.13、pnpm 11.25；`pnpm install --frozen-lockfile`、`pnpm dev`、`pnpm build`。TypeScript `node node_modules/typescript/bin/tsc --noEmit`；新流程 `node scripts/verify-r21-workflows.mjs`；其餘測試見 source/R21_NETLIFY_UPDATE_20261012.md。Netlify：`KK_NETLIFY_TARGET=storefront node scripts/build-netlify.mjs` 與 `KK_NETLIFY_TARGET=admin node scripts/build-netlify.mjs`。瀏覽器測試需另安裝 Playwright 並設定 ADELA_PLAYWRIGHT_MODULE / ADELA_CHROMIUM。

只套用原D1尚未執行遷移；本次0027只新增核價時間，不能重播0025或重建DB。原Worker/D1及兩個Netlify Site ID見PROJECT_STATE。ADMIN_PASSWORD、KK_AI_GATEWAY_SECRET、模型設定等秘密只用平台安全設定。Netlify sso_login=false、built_with_badge_enabled=false，應用管理密碼保護所有後台 API。

Personal account需原帳號加入原GitHubrepo/分支、Netlifyteam/site、Cloudflareaccount/Worker/D1、私人Sitesproject權限；如需移轉所有權由平台管理流程另做，ZIP不轉移權限、秘密、資料庫或帳單。已購Personal額度有限，保持自動加值關閉，額外加購／升級仍需核准。
