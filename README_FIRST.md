# Adela R19 本機修正版，尚未發布

本機原始碼 commit：a8f5047a918195c864c69f646f271b741d8b9e18
原私人 Site：第29版／R17；沒有新 Site 版本。前後台網址仍是原版本。
先讀 source/RECOVERY_R19_20261010.md、source/CATALOG_R19_GAPS.md、
source/LE_LABO_R19_REVIEW.md、source/AI_AND_NOTIFICATIONS_R19.md、
source/PERSONAL_ACCOUNT_HANDOFF.md。安裝、建置、測試、遷移及未完成事項都在內。

下載本次所有 Adela_R19_* ZIP 與 SHA256SUMS.txt、FILE_MANIFEST.json、RESTORE.md、restore.py。
每包是完整可獨立解壓的 ZIP，請全部解到同一個空目錄，不是二進位切片，不要串接檔案。
不要覆蓋仍有未提交修改的 checkout 或直接把舊交接蓋到較新的 Site。
以 python restore.py --destination ./Adela_R19 還原並核對每包 SHA256／CRC、每檔 SHA256。
也可依 RESTORE.md 手動還原。看手機截圖請開 source/MOBILE_R19.html。

ZIP 不等於線上資料庫備份，不含 node_modules、真實登入憑證、密碼、API keys、私鑰、
真實會員資料庫或執行中的 D1/R2 備份。本機隔離測試的合成資料不是正式會員資料。
舊 .next cache 備份不是必要原始碼，未打包；歷史文件在 source/，以 R19文件為準。
未發布包不能替代日後實際發布時必須提供的同版本完整原始碼包。
