// Explicit local input only. No source fetching and no raw content upload.
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
config({ quiet: true });
try {
  const [metadataPath, contentPath] = process.argv.slice(2);
  if (!metadataPath || !contentPath) throw new Error('Usage: node scripts/ingest-document.mjs metadata.json source-content-file');
  if ((await stat(metadataPath)).size > 16384 || (await stat(contentPath)).size > 10 * 1024 * 1024) throw new Error('Local input exceeds size limit');
  const metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) throw new Error('Invalid metadata');
  // Hash the original response/file bytes, not a summary, excerpt or JSON metadata.
  metadata.contentHash = createHash('sha256').update(await readFile(contentPath)).digest('hex');
  const endpoint = new URL('/api/ingestion/documents', process.env.NEXT_PUBLIC_APP_URL);
  if (endpoint.protocol !== 'https:' && !(endpoint.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname))) throw new Error('HTTPS required outside localhost');
  const token = process.env.INGESTION_API_TOKEN;
  if (!token || token.length < 32) throw new Error('Ingestion token is not configured');
  const result = await fetch(endpoint, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30000),
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(metadata),
  });
  const data = await result.json();
  // Never print credentials or user-supplied content, even on failure.
  console.log(JSON.stringify({ status: result.status, outcome: data.outcome, id: data.id, error: data.error, requestId: data.requestId }));
  if (!result.ok) process.exitCode = 1;
} catch {
  console.error('Document import failed. Check input paths, configuration and server logs. No content was printed.');
  process.exitCode = 1;
}
