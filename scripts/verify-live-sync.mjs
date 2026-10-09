// Online diagnostics only; the first call creates a backend identity marker.
// No product, order, or payment changes. Run after approved deployment, with the
// admin password supplied through the environment, never a command argument.
const [front,admin]=process.argv.slice(2),password=process.env.ADELA_ADMIN_PASSWORD;
if(!front||!admin||!password)throw Error('Usage: ADELA_ADMIN_PASSWORD in environment; node scripts/verify-live-sync.mjs <Netlify front URL> <Sites admin origin>');
const replies=await Promise.all([front,admin].map(async base=>{
 const url=new URL('/api/system/status',base);if(url.protocol!=='https:')throw Error('HTTPS required');
 const r=await fetch(url,{headers:{'X-KK-Admin-Password':password},redirect:'manual',signal:AbortSignal.timeout(20000)});
 if(r.status>=300&&r.status<400)throw Error('Sites access gate blocked the service connection. Use approved backend service access; do not publish a private admin site.');
 if(!r.ok)throw Error(`Endpoint returned ${r.status}; synchronization is NOT verified.`);
 return r.json();
}));
if(!replies[0].backendId||replies[0].backendId!==replies[1].backendId)throw Error('The sites do not identify the same database.');
if(replies.some(r=>r.release!=='2026-09-27-r1'||!r.inventoryMigrationReady))throw Error('Release or migration mismatch.');
console.log('PASS: both origins reach the same backend database and release. AI/payment/email require separate live tests.');
