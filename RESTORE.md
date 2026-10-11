# 還原此歷史發布版本

下载所有七個 ZIP，先解壓 Verification 包，將其他包放在 restore.py 旁，執行 `python restore.py --destination ./Adela_Connected_Baseline`。工具驗證 SHA256、CRC 及逐檔 manifest。
完整 source/ 對應 PROJECT_STATE.json 的 commit，無 node_modules 或秘密，ZIP 不是資料庫備份。這是本次首個發布版本，不是之後照片修正版。
安裝：Node >=22.13.0、pnpm11.25.0，`pnpm install --frozen-lockfile`；建置與既有測試見 source/NETLIFY_FRONT_ADMIN_20261011.md。後端 `pnpm build`。
遷移只能套用尚未執行的項目，原帳號／D1／secret bindings 沿用；不要盲目重播歷史遷移。personal account 權限與憑證另外安全設定。
