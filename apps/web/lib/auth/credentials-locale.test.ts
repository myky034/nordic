import { expect, it } from "vitest";
import { readCredentials } from "./credentials";

const form = (fields: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(fields)) f.set(k, v); return f; };

it("returns validation messages in the visitor's language", () => {
  expect(readCredentials(form({ email: "x", password: "p" }))).toEqual({ error: "Nhập địa chỉ email hợp lệ." });
  expect(readCredentials(form({ email: "x", password: "p" }), false, "en")).toEqual({ error: "Enter a valid email address." });
  expect(readCredentials(form({ email: "a@b.test", password: "short1" }), true, "en")).toEqual({ error: "The password needs at least 8 characters." });
  expect(readCredentials(form({ email: "a@b.test", password: "longenough", confirmPassword: "different" }), true, "en")).toEqual({ error: "The two passwords do not match." });
});
