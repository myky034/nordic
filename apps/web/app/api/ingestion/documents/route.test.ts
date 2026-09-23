import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fixture } from "@/lib/documents/fixtures.test-helper";
const { ingest } = vi.hoisted(() => ({ ingest: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/documents/ingest", () => ({ ingestDocument: ingest }));
import { POST } from "./route";
import { IngestionError } from "@/lib/documents/domain";
const token = "t".repeat(64);
function request(body: unknown = fixture, authorization = `Bearer ${token}`, type = "application/json") {
  return new Request("http://localhost/api/ingestion/documents", { method: "POST", headers: { authorization, "content-type": type }, body: JSON.stringify(body) });
}
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("INGESTION_API_TOKEN", token);
  vi.spyOn(console, "error").mockImplementation(() => {}); vi.spyOn(console, "info").mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
it("denies missing and incorrect bearer credentials before reading/writing", async () => {
  for (const header of ["", "Bearer wrong", "Basic abc"]) expect((await POST(request(fixture, header))).status).toBe(401);
  expect(ingest).not.toHaveBeenCalled();
});
it("fails closed when token is not configured", async () => {
  vi.stubEnv("INGESTION_API_TOKEN", "");
  expect((await POST(request())).status).toBe(503); expect(ingest).not.toHaveBeenCalled();
});
it("rejects invalid media types, JSON, and large bodies without content-length", async () => {
  expect((await POST(request(fixture, `Bearer ${token}`, "text/plain"))).status).toBe(415);
  expect((await POST(request({ ...fixture, excerpt: "x".repeat(17000) }))).status).toBe(413);
  const malformed = new Request("http://localhost/api/ingestion/documents", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: "{" });
  expect((await POST(malformed)).status).toBe(400); expect(ingest).not.toHaveBeenCalled();
});
it("returns created and unchanged outcomes without implying verification", async () => {
  ingest.mockResolvedValueOnce({ id: "id", outcome: "created", processingStatus: "stored", extractionStatus: "not_started" });
  const result = await POST(request()); expect(result.status).toBe(201);
  expect(result.headers.get("cache-control")).toBe("no-store");
  expect(await result.json()).toMatchObject({ extractionStatus: "not_started" });
  ingest.mockResolvedValueOnce({ id: "id", outcome: "unchanged" });
  expect((await POST(request())).status).toBe(200);
});
it("reports conflicts without leaking secrets or raw payloads", async () => {
  ingest.mockRejectedValueOnce(new IngestionError("metadata_conflict", 409));
  expect((await POST(request())).status).toBe(409);
  ingest.mockRejectedValueOnce(new Error("postgresql://password@private-host"));
  const result = await POST(request());
  expect(result.status).toBe(503);
  expect(await result.json()).toMatchObject({ error: "ingestion_unavailable" });
  const logs = JSON.stringify(vi.mocked(console.error).mock.calls);
  for (const secret of [token, "password", fixture.url, fixture.excerpt]) expect(logs).not.toContain(secret);
});
