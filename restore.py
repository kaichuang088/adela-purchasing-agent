import argparse,hashlib,json,zipfile
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
   assert not r.is_absolute() and '..' not in r.parts and '\\' not in entry.filename,'Unsafe path'
   assert entry.filename not in seen,'Duplicate entry';seen.add(entry.filename)
   data=z.read(entry);expected=manifest['files'][entry.filename]
   assert len(data)==expected['bytes'] and hashlib.sha256(data).hexdigest()==expected['sha256'],'File mismatch'
   target=dest.joinpath(*r.parts);target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data);target.chmod((entry.external_attr>>16)&0o777 or 0o644)
assert seen==set(manifest['files']),'Missing files'
print('Verified and restored',len(seen),'files in',len(packages),'ZIPs. This is not a database backup.')
