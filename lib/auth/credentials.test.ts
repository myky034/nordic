import { afterEach, expect, it, vi } from "vitest";
import { logAuthFailure } from "./credentials";

afterEach(() => vi.restoreAllMocks());
it("logs known diagnostic codes without raw provider data", () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  logAuthFailure("sign_up", { status: 422, code: "email_address_not_authorized", message: "private@example.com", token: "secret" });
  expect(log).toHaveBeenCalledWith(expect.objectContaining({ status: 422, code: "email_address_not_authorized" }));
  expect(JSON.stringify(log.mock.calls)).not.toMatch(/private@example|secret/);
});
it("redacts unknown codes", () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  logAuthFailure("sign_up", { code: "private@example.com" });
  expect(log).toHaveBeenCalledWith(expect.objectContaining({ code: "unknown" }));
});
