// Start the existing production build on loopback and test HTTP without adding data.
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import path from 'node:path';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
const origin = 'http://127.0.0.1:3137';
// Binary is hoisted to the repo-root node_modules; the app (and its built .next) lives in apps/web.
const nextBin = path.resolve('node_modules/next/dist/bin/next');
const child = spawn(process.execPath, [nextBin, 'start', '--hostname', '127.0.0.1', '--port', '3137'], { stdio: 'ignore', cwd: path.resolve('apps/web') });
let spawnFailed = false;
child.on('error', () => { spawnFailed = true; });
async function check(path, options, expected, text) {
  const response = await fetch(origin + path, { ...options, redirect: 'manual', signal: AbortSignal.timeout(20000) });
  const statuses = Array.isArray(expected) ? expected : [expected];
  if (!statuses.includes(response.status) || (text && !(await response.text()).includes(text))) {
    console.error(JSON.stringify({ path, status: response.status, passed: false }));
    throw new Error('HTTP check failed');
  }
  console.log(JSON.stringify({ path, status: response.status, passed: true }));
}
try {
  let ready = false;
  for (let i = 0; i < 40; i++) {
    if (spawnFailed || child.exitCode !== null) throw new Error('Server did not start');
    try { await fetch(origin, { signal: AbortSignal.timeout(1000) }); ready = true; break; } catch { await sleep(250); }
  }
  if (!ready) throw new Error('Startup timeout');
  await check('/documents', {}, 200, 'No documents yet');
  // Next.js may have streamed the loading shell (HTTP 200) before notFound().
  await check('/documents/not-a-uuid', {}, [200, 404], 'Page not found');
  await check('/api/ingestion/documents', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }, 401);
  await check('/api/ingestion/documents', { method: 'POST', headers: { authorization: `Bearer ${process.env.INGESTION_API_TOKEN}`, 'content-type': 'application/json' }, body: '{}' }, 400);
} catch {
  console.error('Production HTTP smoke check failed; no payloads or credentials printed.');
  process.exitCode = 1;
} finally {
  child.kill('SIGTERM');
}
