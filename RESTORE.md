# 還原與續作
下載全部七包：Source兩包、Assets四包、Verification一包。先解壓Verification，其他ZIP放旁邊。
執行 `python3 restore.py --destination ./Adela_Restored`（目的地須不存在或為空）。
工具核對逐包SHA256、CRC、檔案大小/SHA256，完整还原source/與附件；不要二進位串接ZIP。
source/逐位元對應PROJECT_STATE.json的sourceCommit；publicationType是Netlify draft，非production替換或新Sites發布。
安装/執行/測試/前後台建置見source/NETLIFY_FRONT_ADMIN_20261011.md。
接續先核對同一Sites當前來源、Worker/D1/R2身分及備份；保留private sharing和所有會員/訂單/帳本。
未核實原DB前不切換或重建，不要盲跑全部remote migrations或重播0025。
實際網站AI業務流程仍待後端綁定，免費provider成功紀錄不能代替業務驗收。
秘密只經官方登入或平台安全設定；ZIP不是線上DB備份，也不移轉帳號所有權。
