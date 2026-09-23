import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { IngestionError, MAX_BODY_BYTES } from "./domain";

export function authorizeIngestion(header: string | null, secret = process.env.INGESTION_API_TOKEN) {
  // Fail closed; a missing/weak configuration must never become anonymous access.
  if (!secret || secret.length < 32 || /\s/.test(secret)) throw new IngestionError("ingestion_not_configured", 503);
  const token = header?.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || token.length > 512) throw new IngestionError("unauthorized", 401);
  const digest = (value: string) => createHash("sha256").update(value).digest();
  if (!timingSafeEqual(digest(token), digest(secret))) throw new IngestionError("unauthorized", 401);
}

export async function readPayload(request: Request): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") throw new IngestionError("unsupported_media_type", 415);
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) throw new IngestionError("payload_too_large", 413);
  // Count streamed bytes as well: content-length can be missing or dishonest.
  const reader = request.body?.getReader();
  if (!reader) throw new IngestionError("invalid_json", 400);
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BODY_BYTES) { await reader.cancel(); throw new IngestionError("payload_too_large", 413); }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    if (error instanceof IngestionError) throw error;
    throw new IngestionError("invalid_json", 400);
  } finally { reader.releaseLock(); }
}
