// TLS settings for the worker connections (crawler, extractor).
//
// Supabase's database certificates are signed by Supabase's own root CA, which
// is not in Node's default trust store. With `sslmode=require` node-postgres
// verifies the full chain (it treats require as verify-full) and fails with
// "self-signed certificate in certificate chain". The safe fix is to trust
// that specific CA — never to turn verification off.
//
// DATABASE_CA_CERT holds the PEM downloaded from Supabase (Project Settings →
// Database → SSL configuration). When it is set, sslmode/sslrootcert are
// removed from the URL (node-postgres would otherwise let the URL override
// this object) and the connection is verified against that CA.
export type WorkerPoolConfig = { connectionString: string; ssl?: { ca: string; rejectUnauthorized: true }; verified: boolean };

const SSL_PARAMS = ["sslmode", "sslrootcert", "sslcert", "sslkey", "uselibpqcompat"];

export function workerPoolConfig(connectionString: string, caCert?: string | null): WorkerPoolConfig {
  const pem = caCert?.trim().replace(/\\n/g, "\n");
  if (!pem) return { connectionString, verified: false };
  if (!/^-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----$/.test(pem)) {
    throw new Error("DATABASE_CA_CERT is not a PEM certificate (expected -----BEGIN CERTIFICATE----- … -----END CERTIFICATE-----).");
  }
  const url = new URL(connectionString);
  for (const p of SSL_PARAMS) url.searchParams.delete(p);
  return { connectionString: url.toString(), ssl: { ca: pem, rejectUnauthorized: true }, verified: true };
}
