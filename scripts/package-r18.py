"""Package a committed local source tree; never claim an unpublished Site version."""
import argparse
import hashlib
import json
import subprocess
import zipfile
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("--output", required=True)
parser.add_argument("--handoff-root", required=True)
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
out = Path(args.output).resolve()
handoff = Path(args.handoff_root).resolve()
out.mkdir(parents=True, exist_ok=True)
git = lambda *a: subprocess.check_output(["git", "-C", str(root), *a])
assert not git("status", "--porcelain").strip(), "Commit all deliverable changes before packaging"
commit = git("rev-parse", "HEAD").decode().strip()
tracked = [Path(p) for p in git("ls-files", "-z").decode().split("\0") if p]
files = {}
for rel in tracked:
    assert not any(p in {"node_modules", ".git", "dist", ".next", ".sites-runtime", ".wrangler"} for p in rel.parts)
    assert not (rel.name.startswith(".env") and rel.name != ".env.example")
    assert rel.suffix.lower() not in {".pem", ".key", ".sqlite", ".sqlite3", ".db"}
    files["source/" + rel.as_posix()] = (root / rel).read_bytes()
for p in sorted((handoff / "attachments").rglob("*")):
    if p.is_file():
        files["attachments/" + p.relative_to(handoff / "attachments").as_posix()] = p.read_bytes()
state = {
    "release": "R18-local-unpublished", "published": False,
    "siteProjectId": "appgprj_6ab47d9a2d1881919a796ec9b609c7b4",
    "lastKnownSiteVersion": 29, "lastKnownSiteRelease": "R17",
    "baseSourceCommit": "836405042c07c141b48491b3dc81e09695e9f272",
    "sourceCommit": commit,
    "sourceIdentity": "All source/ files exactly match this local Git commit; no remote push",
    "onlineSourceCheck": "User reconfirmed v29 matching export; no Sites read/publish tool",
    "databaseBackupIncluded": False, "secretsIncluded": False,
    "nodeModulesIncluded": False, "generatedBuildCachesIncluded": False,
    "frontend": "https://adelas-korea-shop-preview.workspace-558703.chatgpt.site",
    "admin": "https://adelas-korea-shop-preview.workspace-558703.chatgpt.site/admin",
    "tests": {"pricing": 18, "api": 21, "migration": 4, "r17": 22,
              "r17SSR": 9, "r16PriceCombinations": 644, "r16Photos": 3,
              "photoQuoteMock": 20, "aiConfiguration": 8,
              "browserChecks": 84, "screenshots": 78},
    "outstanding": ["Catalog source/evidence for 211 of 228 source-seeded specs",
                    "Le Labo final qualified prices; 26 internal comparison rows",
                    "Real AI provider/model and Netlify backend routing",
                    "Physical Web Push, Email delivery, unattended scheduling",
                    "Online migration and original private Sites publication"],
}
files["PROJECT_STATE.json"] = (json.dumps(state, ensure_ascii=False, indent=2) + "\n").encode()
files["README_FIRST.md"] = f"""# Adela R18 本機修正版，尚未發布

本機原始碼 commit：{commit}
原私人 Site：第29版／R17；沒有新 Site 版本。前後台網址仍是原版本。
先讀 source/RECOVERY_R18_20261009.md、source/CATALOG_R18_GAPS.md、
source/LE_LABO_R18_REVIEW.md、source/AI_AND_NOTIFICATIONS_R18.md、
source/PERSONAL_ACCOUNT_HANDOFF.md。安裝、建置、測試、遷移及未完成事項都在內。

下載本次所有 Adela_R18_* ZIP 與 SHA256SUMS.txt、FILE_MANIFEST.json、RESTORE.md、restore.py。
每包是完整可獨立解壓的 ZIP，請全部解到同一個空目錄，不是二進位切片，不要串接檔案。
不要覆蓋仍有未提交修改的 checkout 或直接把舊交接蓋到較新的 Site。
以 python restore.py --destination ./Adela_R18 還原並核對每包 SHA256／CRC、每檔 SHA256。
也可依 RESTORE.md 手動還原。看手機截圖請開 source/MOBILE_R18.html。

ZIP 不等於線上資料庫備份，不含 node_modules、真實登入憑證、密碼、API keys、私鑰、
真實會員資料庫或執行中的 D1/R2 備份。本機隔離測試的合成資料不是正式會員資料。
舊 .next cache 備份不是必要原始碼，未打包；歷史文件在 source/，以 R18文件為準。
未發布包不能替代日後實際發布時必須提供的同版本完整原始碼包。
""".encode()
files["RESTORE.md"] = """# 還原與驗證

將本次所有ZIP及外置SHA256SUMS.txt、FILE_MANIFEST.json、restore.py放同一目錄。
執行 `python restore.py --destination ./Adela_R18`，目的目錄須不存在或為空。
還原工具只讀取本包清單，不執行來源程式；核對SHA256、ZIP CRC、路徑與逐檔內容。
無Python時可先用工具核對SHA256，再把每個ZIP解到同一個空目錄，最後對照FILE_MANIFEST。
所有 source/ 檔案與PROJECT_STATE.json所載本機commit完全相同；本包不含Gitmetadata，
需保留PROJECT_STATE與manifest作來源版本辨識。不能用這個SHA冒充已發布Site版本。

進入 source/，依 RECOVERY_R18_20261009.md 安裝、測試及建置。
先確認同一Site最新來源／綁定，對照基準和本包，合併任何較新修改再測試。
0025遷移必須一次原子transaction，且只套用未執行遷移；先安全備份與核實線上schema。
禁止重播舊遷移、重算歷史贈額，或未收款先加購物金。

來源ZIP不是DB備份，也不自動轉移帳號權限。personal account交接請依
source/PERSONAL_ACCOUNT_HANDOFF.md。正式Netlify、Cloudflare切換、Stripe仍需另外核准。
""".encode()
restore = '''import argparse,hashlib,json,zipfile
from pathlib import Path,PurePosixPath
p=argparse.ArgumentParser();p.add_argument('--destination',required=True);a=p.parse_args()
base=Path(__file__).resolve().parent;dest=Path(a.destination).resolve()
assert not dest.exists() or not any(dest.iterdir()),'Destination must be empty'
manifest=json.loads((base/'FILE_MANIFEST.json').read_text())
packages=json.loads((base/'PACKAGE_INDEX.json').read_text())['packages']
checks={line.split('  ',1)[1]:line.split('  ',1)[0] for line in (base/'SHA256SUMS.txt').read_text().splitlines()}
seen=set()
for pack in packages:
 name=pack['name'];path=base/name
 assert hashlib.sha256(path.read_bytes()).hexdigest()==checks[name],'Package SHA256 mismatch: '+name
 with zipfile.ZipFile(path) as z:
  assert z.testzip() is None,'ZIP CRC failure'
  for entry in z.infolist():
   r=PurePosixPath(entry.filename)
   assert not r.is_absolute() and '..' not in r.parts and '\\\\' not in entry.filename,'Unsafe path'
   assert entry.filename not in seen,'Duplicate entry';seen.add(entry.filename)
   data=z.read(entry);expected=manifest['files'][entry.filename]
   assert len(data)==expected['bytes'] and hashlib.sha256(data).hexdigest()==expected['sha256'],'File mismatch'
   target=dest.joinpath(*r.parts);target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data);target.chmod((entry.external_attr>>16)&0o777 or 0o644)
assert seen==set(manifest['files']),'Missing files'
print('Verified and restored',len(seen),'files in',len(packages),'ZIPs. This is not a database backup.')
'''
files["restore.py"] = restore.encode()
metadata = {name: {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()} for name, data in files.items()}
# Assets are incompressible in the worst case, so cap uncompressed groups at 29 MiB.
source_names = sorted(name for name in files if not name.startswith("source/public/"))
assert sum(len(files[n]) for n in source_names) < 31 * 1024 * 1024, "Source/docs group needs splitting"
groups = [source_names]
assets = []
size = 0
for name in sorted(n for n in files if n.startswith("source/public/")):
    if size + len(files[name]) > 29 * 1024 * 1024 and assets:
        groups.append(assets)
        assets, size = [], 0
    assets.append(name)
    size += len(files[name])
if assets:
    groups.append(assets)
packages = []
for i, names in enumerate(groups, 1):
    name = f"Adela_R18_{i:02d}_{'Source' if i == 1 else 'Assets'}.zip"
    path = out / name
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for member in names:
            info = zipfile.ZipInfo(member, date_time=(2026, 10, 9, 0, 0, 0))
            original = root / member.removeprefix("source/")
            mode = (original.stat().st_mode & 0o777) if member.startswith("source/") else 0o644
            info.external_attr = mode << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(info, files[member])
            metadata[member]["package"] = name
    assert path.stat().st_size < 32 * 1024 * 1024, "ZIP must be less than 32 MiB"
    with zipfile.ZipFile(path) as z:
        assert z.testzip() is None
    packages.append({"name": name, "bytes": path.stat().st_size, "files": len(names), "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
for n in ["PROJECT_STATE.json", "README_FIRST.md", "RESTORE.md", "restore.py"]:
    (out / n).write_bytes(files[n])
(out / "PACKAGE_INDEX.json").write_text(json.dumps({"sourceCommit": commit, "published": False, "packages": packages}, indent=2))
(out / "FILE_MANIFEST.json").write_text(json.dumps({"sourceCommit": commit, "files": metadata}, ensure_ascii=False, indent=2))
(out / "SHA256SUMS.txt").write_text("".join(f"{p['sha256']}  {p['name']}\n" for p in packages))
print(json.dumps({"sourceCommit": commit, "packages": packages, "files": len(files)}, indent=2))
