"""Historical top-up preservation test; only Python in-memory SQLite."""
import json
import sqlite3
from pathlib import Path

root = Path(__file__).resolve().parent.parent
db = sqlite3.connect(":memory:")
db.executescript((root / "drizzle/0023_topups.sql").read_text())
for values in [
    ("old-pending", "member-a", 2000, 200, "payment_review", "12345", "", "", "2026-09-01", "2026-09-02", None),
    ("old-paid", "member-b", 5000, 500, "confirmed", "54321", "isolated-reference", "isolated-gate", "2026-09-03", "2026-09-04", "2026-09-05"),
]:
    db.execute("INSERT INTO kk_topups VALUES(?,?,?,?,?,?,?,?,?,?,?)", values)
db.commit()
before = db.execute("SELECT * FROM kk_topups ORDER BY id").fetchall()
with db:
    for sql in (root / "drizzle/0025_topup_bonus_plans.sql").read_text().split("--> statement-breakpoint"):
        if sql.strip():
            db.execute(sql)
assert before == db.execute("SELECT * FROM kk_topups ORDER BY id").fetchall()
assert db.execute("SELECT name FROM sqlite_master WHERE type='index' AND name='kk_topups_member'").fetchone()
print("PASS 1: Every historical column and the member index preserved")
db.execute("INSERT INTO kk_topups(id,member_id,amount_twd,bonus_twd) VALUES('new-2000','member-a',2000,160)")
print("PASS 2: 2000 with 160 accepted")
db.execute("INSERT INTO kk_topups(id,member_id,amount_twd,bonus_twd) VALUES('new-5000','member-b',5000,600)")
print("PASS 3: 5000 with 600 accepted")
try:
    db.execute("INSERT INTO kk_topups(id,member_id,amount_twd,bonus_twd) VALUES('invalid','member-a',2000,999)")
except sqlite3.IntegrityError:
    print("PASS 4: Invalid bonus rejected")
else:
    raise AssertionError("Invalid bonus accepted")
(root / "verification/r18-migration-results.json").write_text(json.dumps({
    "checks": 4, "historicalRowsIdentical": True, "new2000Bonus": 160,
    "new5000Bonus": 600, "invalidBonusRejected": True,
    "scope": "SQLite in memory; never applied to live DB",
}, indent=2))
db.close()
