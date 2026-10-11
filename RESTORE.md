# 完整還原與續作

下載全部七包ZIP（Source兩包、Assets四包、Verification一包）；先解壓Verification，其他ZIP放在其旁。
執行 `python3 restore.py --destination ./Adela_Restored`；目的地須不存在或為空。
工具核對各包SHA256、CRC和所有檔案大小/SHA256，還原source/與附件至同一空目錄；不要串接ZIP。
source/逐位元對應PROJECT_STATE.json的commit。根published=false：本包是未發布準備，不能稱線上最新版。
安裝、執行、測試與前後台build見source/NETLIFY_FRONT_ADMIN_20261011.md。
接續須先讀取同一Site當前版本並保留較新修改，再核對原Worker/D1/R2與會員/訂單歷史。
不要直接套用舊腳本所有remote migrations或重播0025；只在備份後處理原DB尚未執行的必要遷移。
帳號/金鑰經官方登入或平台安全設定，不能置於聊天、Git、ZIP。ZIP不是DB備份，也不移轉帳號所有權。
