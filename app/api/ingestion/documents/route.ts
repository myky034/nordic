import { randomUUID } from "node:crypto";
import { authorizeIngestion, readPayload } from "@/lib/documents/security";
import { IngestionError, parseDocumentInput } from "@/lib/documents/domain";
import { ingestDocument } from "@/lib/documents/ingest";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  const requestId = randomUUID();
  let sourceId: string | null = null;
  let operation = "authorize";
  const headers = { "Cache-Control": "no-store", "X-Request-Id": requestId };
  try {
    authorizeIngestion(request.headers.get("authorization"));
    operation = "validate";
    const input = parseDocumentInput(await readPayload(request));
    sourceId = input.sourceId;
    operation = "store";
    const result = await ingestDocument(input);
    console.info({ source: sourceId, operation, timestamp: new Date().toISOString(), status: result.outcome, requestId });
    return Response.json(result, { status: result.outcome === "created" ? 201 : 200, headers });
  } catch (error) {
    const status = error instanceof IngestionError ? error.status : 503;
    const code = error instanceof IngestionError ? error.code : "ingestion_unavailable";
    // No raw error, URL, payload, authorization header or excerpt is logged.
    console.error({ source: sourceId, operation, timestamp: new Date().toISOString(), status, category: code, requestId });
    return Response.json({ error: code, requestId }, { status, headers });
  }
}
