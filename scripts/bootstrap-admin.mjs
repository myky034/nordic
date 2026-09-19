// Explicit operator action; never auto-select the first signup or hard-code a user.
import pg from 'pg';
import { config } from 'dotenv';
config({path:'.env.local',quiet:true}); config({quiet:true});
const user = process.argv[2];
if (!user || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user)) {
  console.error('Usage: node scripts/bootstrap-admin.mjs <confirmed-Supabase-user-UUID>'); process.exit(1);
}
const client = new pg.Client({connectionString:process.env.DIRECT_URL,connectionTimeoutMillis:10000});
try {
  await client.connect();
  await client.query('SELECT public.bootstrap_administrator($1::uuid)',[user]);
  console.log('First administrator assigned and audited. Open /admin/access after signing in with that account.');
} catch (error) {
  const allowed=['rbac_already_bootstrapped','rbac_user_not_eligible','rbac_not_found'];
  console.error(allowed.includes(error.message)?error.message:'Bootstrap failed. Check connection and migration status.');process.exitCode=1;
} finally {await client.end();}
