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
parser.add_argument("--state", required=True)
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
state = json.loads(Path(args.state).read_text())
assert state['sourceCommit'] == commit and state['published'] is True
label = f"Adela_R20_Sites_v{state['siteVersion']}"
files["PROJECT_STATE.json"] = (json.dumps(state, ensure_ascii=False, indent=2) + "\n").encode()
files["README_FIRST.md"] = f"""# Adela R20 — Sites 第{state['siteVersion']}版

同一私人 Site：{state['frontend']}
後台：{state['admin']}
原始碼 commit：{commit}

先讀 PROJECT_STATE.json、source/RECOVERY_R20_20261010.md、source/PERSONAL_ACCOUNT_HANDOFF.md。
本次取消新儲值販售，保留既有餘額與歷史紀錄；加入銀行轉帳退款申請、每位會員餘額增減；
Le Labo 與新建商品共用浮動代購費及台灣比較價95%上限。成本高於上限由店家吸收，真實成本保留。
真實AI／Push／Email／背景排程、完整商品證據與手機實機驗收尚未完成，不可宣稱Finalize。

完整 source/ 分在原始碼包及資產包中；所有ZIP都必須下载。先解壓Verification包到一個包目錄，
將其他ZIP放在同一包目錄，執行 `python restore.py --destination ./Adela_R20_Restored`。
還原工具核對各包SHA256、ZIP CRC及逐檔manifest，全部還原到同一空目錄。
不是二進位切片，不要串接ZIP。原始碼不含node_modules、建置cache、密碼、金鑰或線上DB備份。
R19及更早文件僅供歷史追溯，以R20與根目錄實際發布資料為準。
""".encode()
files["RESTORE.md"] = """# 還原與續作

1. 下載所有ZIP（每包小於32MiB），先解壓Verification包；把所有ZIP放在其旁邊。
2. 執行 `python restore.py --destination ./Adela_R20_Restored`，目的地須不存在或為空。
3. 工具驗證每包SHA256、CRC、每檔大小／SHA256，還原source/、指定screenshots與說明文件。
4. source/中所有檔案逐位元對應PROJECT_STATE.json內實際發布commit；不含Gitmetadata。
5. 接續修改先讀同一Sites最新版本／來源，與本包比對並保留任何較新修改。
6. 使用原專案的Sites權限及原DB／R2，秘密僅用平台安全設定。只套用尚未執行的遷移，
   本次新增0026，不能重播0025或改寫歷史贈額／價格／圖片快照。ZIP不是線上DB備份。
7. 先依RECOVERY_R20_20261010.md建置及測試；Netlify須經Finalize與publish批准，
   Cloudflare後端／DB切換及Stripe啟用另需授權。personal account權限不會隨ZIP轉移。
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
groups = []
source_group = []
source_bytes = 0
for member in source_names:
    if source_group and source_bytes + len(files[member]) > 29 * 1024 * 1024:
        groups.append(source_group)
        source_group, source_bytes = [], 0
    source_group.append(member)
    source_bytes += len(files[member])
if source_group:
    groups.append(source_group)
source_group_count = len(groups)
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
    name = f"{label}_{i:02d}_{'Source' if i <= source_group_count else 'Assets'}.zip"
    path = out / name
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for member in names:
            info = zipfile.ZipInfo(member, date_time=(2026, 10, 10, 0, 0, 0))
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
(out / "PACKAGE_INDEX.json").write_text(json.dumps({"sourceCommit": commit, "published": True, "packages": packages}, indent=2))
(out / "FILE_MANIFEST.json").write_text(json.dumps({"sourceCommit": commit, "files": metadata}, ensure_ascii=False, indent=2))
(out / "SHA256SUMS.txt").write_text("".join(f"{p['sha256']}  {p['name']}\n" for p in packages))
verification = out / f"{label}_{len(packages)+1:02d}_Verification.zip"
with zipfile.ZipFile(verification, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as z:
    for name in ["README_FIRST.md", "PROJECT_STATE.json", "RESTORE.md", "restore.py", "PACKAGE_INDEX.json", "FILE_MANIFEST.json", "SHA256SUMS.txt"]:
        z.write(out / name, name)
assert verification.stat().st_size < 32 * 1024 * 1024
with zipfile.ZipFile(verification) as z:
    assert z.testzip() is None
with (out / "SHA256SUMS.txt").open("a") as f:
    f.write(hashlib.sha256(verification.read_bytes()).hexdigest()+"  "+verification.name+"\n")
print(json.dumps({"sourceCommit": commit, "packages": packages, "verificationPackage": verification.name, "files": len(files)}, indent=2))
