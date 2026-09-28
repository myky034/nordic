import { expect, it } from "vitest";
import { workerPoolConfig } from "@nordic/db/pg-ssl";

const url = "postgresql://nordic_crawler.ref:p%40ss@pooler.example.test:5432/postgres?sslmode=require&application_name=crawler";
const pem = "-----BEGIN CERTIFICATE-----\nMIIBsynthetic\n-----END CERTIFICATE-----";

it("verifies TLS against the given CA and drops URL ssl params that would override it", () => {
  const c = workerPoolConfig(url, pem);
  expect(c.verified).toBe(true);
  expect(c.ssl).toEqual({ ca: pem, rejectUnauthorized: true });
  expect(c.connectionString).not.toContain("sslmode");
  expect(c.connectionString).toContain("application_name=crawler");
  expect(c.connectionString).toContain("p%40ss@"); // password encoding kept
});
it("accepts a PEM pasted with literal \\n and refuses anything else", () => {
  expect(workerPoolConfig(url, pem.replace(/\n/g, "\\n")).ssl?.ca).toBe(pem);
  expect(() => workerPoolConfig(url, "not a certificate")).toThrow("PEM");
});
it("leaves the URL untouched and reports unverified TLS when no CA is given", () => {
  expect(workerPoolConfig(url, undefined)).toEqual({ connectionString: url, verified: false });
});
