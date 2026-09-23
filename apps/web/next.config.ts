import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // @nordic/db is a workspace package whose "generated client" is checked-in
  // TypeScript source, not a pre-built dist — Next must run it through the
  // same SWC/webpack pipeline as app code instead of treating it as an
  // opaque external dependency.
  transpilePackages: ["@nordic/db"],
  // Monorepo root: without this, Next.js's output file tracing (used for
  // Vercel deployment bundling) infers the root from the nearest lockfile,
  // which is one level up from apps/web in this workspace layout.
  outputFileTracingRoot: path.join(__dirname, "../.."),
};

export default nextConfig;
