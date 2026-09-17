// Read-only/rollback verification against the configured development database.
import { config } from 'dotenv';
import pg from 'pg';
config({ path: '.env.local', quiet: true });
config({ quiet: true });
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });
try {
  await client.connect();
  for (const role of ['anon', 'authenticated']) {
    await client.query('BEGIN');
    await client.query(`SET LOCAL ROLE ${role}`);
    const countries = await client.query('SELECT count(*)::int AS count FROM public.countries');
    const sources = await client.query('SELECT count(*)::int AS count FROM public.sources');
    for (const table of ['countries', 'sources']) {
      for (const operation of [`INSERT INTO public.${table} DEFAULT VALUES`, `UPDATE public.${table} SET name = name`, `DELETE FROM public.${table}`]) {
        await client.query('SAVEPOINT denied_write');
        let denied = false;
        try { await client.query(operation); } catch (error) { denied = error.code === '42501'; }
        await client.query('ROLLBACK TO SAVEPOINT denied_write');
        if (!denied) throw new Error('Public write was not denied');
      }
    }
    await client.query('ROLLBACK');
    console.log(JSON.stringify({ role, countries: countries.rows[0].count, sources: sources.rows[0].count, writesDenied: true }));
  }
} catch (error) {
  console.error(JSON.stringify({ operation: 'verify_registry', status: 'failed', code: error.code ?? 'verification_failed' }));
  process.exitCode = 1;
} finally {
  await client.end();
}
