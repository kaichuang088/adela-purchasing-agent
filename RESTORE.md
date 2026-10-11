# 還原與續作
下载全部七包Source/Assets/Verification。先解壓Verification，其他ZIP放旁。
執行 `python3 restore.py --destination ./Adela_Restored`，目的地須不存在/為空。
工具核對每包SHA256、CRC及逐檔大小/SHA256，还原source/與附件；不要串接ZIP。
source/逐位元對應PROJECT_STATE.json sourceCommit。本次published=true是Netlifyproduction，不是新Sites發布。
安裝/執行/測試/建置見source/NETLIFY_FRONT_ADMIN_20261011.md；根目錄最新實際發布狀態優先於source内历史文字。
先核實原CloudflareWorker/D1/R2及Sites的資料庫身分與備份；不能新建/切換DB或盲套舊全部migrations。
網站AI業務後端仍待接入，模型Function成功不等於整站AI已完成。保留會員/訂單/帳本/私人權限與历史快照。
秘密只经官方登入或平台安全設定；ZIP不是DB備份，也不自動轉移平台帳號。
