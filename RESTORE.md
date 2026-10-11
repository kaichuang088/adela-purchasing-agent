# 還原、開發與部署

1. 下載全部七包，解壓 07_Verification，將全部 ZIP 放在 restore.py 旁。
2. 執行 `python3 restore.py --destination ./Adela_Restored`；目的地必須不存在或為空。工具驗證各包 SHA256、ZIP CRC 與每檔 manifest，source/ 應與 PROJECT_STATE.json 的 sourceCommit 逐位元一致。
3. `cd Adela_Restored/source`，使用 Node >=22.13.0、pnpm 11.25.0。執行 `pnpm install --frozen-lockfile`；`pnpm dev` 啟動開發環境，按 package.json 及原 Cloudflare bindings 設定可用資料服務。不要將秘密寫入 repo。
4. `pnpm exec tsc --noEmit`、`node scripts/verify-netlify-r20-proxy.mjs`。`pnpm build` 建置 Cloudflare Worker；`KK_NETLIFY_TARGET=storefront node scripts/build-netlify.mjs` 及 `KK_NETLIFY_TARGET=admin node scripts/build-netlify.mjs` 分別建置完整 Netlify 前／後台。既有金流與照片 Miniflare 測試只用隔離資料；目前 runner 的 compatibility date 要採本機 workerd 支援日期，production date 不要跟著降版。完整已跑結果在 deployment-evidence。
5. 瀏覽器使用系統 Chromium 和 Playwright 1.58.2，`ADELA_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node scripts/verify-netlify-storefront.mjs`、同路徑的 verify-netlify-admin.mjs。兩者啟動短暫本機 fixture server，測試完關閉；fixture 測試不是正式後台登入或真實金流。
6. Netlify CLI 27.12.0，保持原 Site IDs 與 netlify.toml／netlify-admin.toml、netlify-dist／netlify-admin-dist。平台安全設定 KK_BACKEND_URL 指向原 Worker；AI Gateway shared secret、模型與平台注入授權僅用安全環境值。先發布 draft、比對所有 static SHA1 和 AI／API，再 promote；每次另交完整 matching ZIP。使用者已授權本次正式更新；未來範圍依當時需求，不再套用歷史文件待核准狀態。
7. Cloudflare 原帳號 00d4e36d4a49a7e2a2658bd1de0efc5a，Worker kk-purchasing-agent，D1 8f6bb2b3-7dd0-498e-8e4b-d0abc7ea0bee。deployment-evidence/cloudflare-deployment-config.json 保留原 bindings。只套用尚未套用遷移；全部26份目前已套用，不能盲目重播0025。保留 ADMIN_PASSWORD 與其他 secret bindings。原 ASSETS 此次保留，Netlify 提供全部最新資產。
8. 本環境的 Cloudflare 靜態資產臨時 JWT 被代理拒絕，因此使用 Workers Versions API keep_assets／keep_bindings 保留資產及秘密，實際版本和 bundle SHA256 有證據。外部工具僅 deployment-evidence 參考，不含憑證，正常個人環境仍應先確認原绑定／部署路徑。
9. 免費限制：不要 upgrade、買額度、開 auto-topup 或 overages，不要啟用 Stripe。AI 是有限免費平台通道，不是無限或永久免費保證。
10. personal account 需自行接原 GitHub／Netlify／Cloudflare／Sites 權限及安全值；ZIP 不移轉任何平台授權，也不是線上 DB 備份。
