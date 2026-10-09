import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

// Current Korean commerce contracts, including migrated legacy workflows.
// Passing these isolated checks does not authorize deployment or prove live integrations.
const suites = ['wallet-delivery', 'regressions', 'auth', 'korea-photo-flow', 'catalog-expansion', 'adela-korea', 'policy-updates', 'photo-quotes', 'commerce', 'flows', 'email-outbox', 'localization', 'recovery-credit', 'recovery-scheduler', 'recovery-notifications', 'recovery-admin', 'recovery-catalog', 'recovery-sync'];
mkdirSync('verification', { recursive: true });
const results = [];
const prefix = process.env.ADELA_VERIFICATION_PREFIX || '20260930';
if (!/^[a-zA-Z0-9-]+$/.test(prefix)) throw new Error('Invalid verification prefix');
for (const suite of suites) {
  const run = spawnSync(process.execPath, [`scripts/verify-${suite}.mjs`], {
    encoding: 'utf8', timeout: 180_000, maxBuffer: 10 * 1024 * 1024,
  });
  const output = (run.stdout || '') + (run.stderr || '');
  const log = `verification/${prefix}-${suite}.log`;
  writeFileSync(log, output);
  const result = { suite, passed: run.status === 0, namedChecks: (output.match(/^PASS \d+:/gm) || []).length, log };
  results.push(result);
  console.log(`${result.passed ? 'PASS' : 'FAIL'} ${suite}: ${result.namedChecks} named checks`);
  if (!result.passed) console.error(output.slice(-1600));
}
writeFileSync(`verification/${prefix}-release-results.json`, JSON.stringify({
  checkedAt: new Date().toISOString(), suites: results,
  totalNamedChecks: results.reduce((n, s) => n + (s.passed ? s.namedChecks : 0), 0),
  scope: 'Isolated database and local compiled app. Photo AI and email transport are mocked. Not live provider, browser UI or cross-site deployment verification.',
}, null, 2) + '\n');
if (results.some(r => !r.passed)) process.exitCode = 1;
