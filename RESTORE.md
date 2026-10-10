# 還原與驗證

將本次所有ZIP及外置SHA256SUMS.txt、FILE_MANIFEST.json、restore.py放同一目錄。
執行 `python restore.py --destination ./Adela_R19`，目的目錄須不存在或為空。
還原工具只讀取本包清單，不執行來源程式；核對SHA256、ZIP CRC、路徑與逐檔內容。
無Python時可先用工具核對SHA256，再把每個ZIP解到同一個空目錄，最後對照FILE_MANIFEST。
所有 source/ 檔案與PROJECT_STATE.json所載本機commit完全相同；本包不含Gitmetadata，
需保留PROJECT_STATE與manifest作來源版本辨識。不能用這個SHA冒充已發布Site版本。

進入 source/，依 RECOVERY_R19_20261010.md 安裝、測試及建置。
先確認同一Site最新來源／綁定，對照基準和本包，合併任何較新修改再測試。
0025遷移必須一次原子transaction，且只套用未執行遷移；先安全備份與核實線上schema。
禁止重播舊遷移、重算歷史贈額，或未收款先加購物金。

來源ZIP不是DB備份，也不自動轉移帳號權限。personal account交接請依
source/PERSONAL_ACCOUNT_HANDOFF.md。Netlify須先確認可Finalize再核准publish；Cloudflare切換及Stripe仍需另外核准。
