# 雲端環境設定

已依 cloud-environment-onboarding:setup 完成本次環境安裝與啟動查核。安裝腳本、啟動說明及來源查核網域已由設定工具回報 saved、requires_publish=true，屬草稿。請在環境設定檢閱、儲存後發布環境；不是發布 Sites。保留既有 package_managers preset，只增加來源網站清單，沒有切成 unrestricted。

本次使用 Node24.19.0、pnpm11.25.0、Playwright1.58.2、/usr/bin/chromium。應用程式 package.json、鎖定檔、.npmrc、.openai/hosting.json 與交接基準一致。套件工具在 /workspace/adela-tools；不混入原始碼 ZIP。

```bash
cd /workspace/adela-purchasing-agent
npm install --prefix /workspace/adela-tools --cache /workspace/adela-tools/npm-cache pnpm@11.25.0 playwright@1.58.2 --no-audit --no-fund
/workspace/adela-tools/node_modules/.bin/pnpm install --frozen-lockfile --store-dir /workspace/adela-tools/pnpm-store --cache-dir /workspace/adela-tools/pnpm-cache --package-import-method copy
node node_modules/typescript/bin/tsc --noEmit
node scripts/run-framework.mjs build
node scripts/local-preview.mjs --check
```

啟動本機預覽：node scripts/local-preview.mjs。只有隔離本機資料，不連正式會員 DB。安全地設定 ADELA_LOCAL_TEST_PASSWORD 才可自行互動登入；不在聊天或檔案提供值。

原本 GitHub checkout 只有 README，已從使用者提供並通過 SHA256／CRC 的 R17 分包還原。新 commit 為本機提交，尚未 push。環境草稿記錄實際 checkout 路徑與完整本機 commit，不替換遠端分支。/workspace/.git 為空的保護目錄，不是 repository；完整遍歷只找到一個有效 checkout，沒有略過不可讀目錄。新的工作恢復本機 commit／匯出還原內容是否完整，尚未獨立驗證；保留全部交付分包，不能只依賴遠端 main。

目前工具沒有 Sites 讀取、修改、發布，亦沒有 Netlify／Cloudflare 平台管理能力。允許網域後仍可能被網站或網路代理403／429拒絕，不能藉來源受阻假造價格。正式服務秘密只由平台安全設定綁定，本機環境變數不代表當前 Sites runtime。


2026-10-10 R19接續：另外保存來源CDN／匯率域assets.lltw.lelabo.uncacloud.com、lelabokorea-java.s3.amazonaws.com、static.oliveyoung.co.kr、rate.bot.com.tw、open.er-api.com；保留既有allowlist／package_managers，仍屬未套用草稿。公開台韓官方、PChome與SSG網頁現已能GET，初期新增CDN回403，後續重查已200並完成25張Le Labo照片下載；不据此声称環境草稿已正式發布。啟動先讀RECOVERY_R19_20261010.md；R19瀏覽器測試scripts/verify-r19-mobile.mjs，來源／AI檢查見最新交接。本機新commit仍未push，完整分包及manifest須保存；環境設定草稿不等於Sites讀写工具或平台認證。
