import { defineConfig } from "drizzle-kit";

// Canonical baseline for a brand-new FrameFlow D1 database. Existing
// environments continue through the immutable incremental ./drizzle chain.
export default defineConfig({
  out: "./drizzle-baseline",
  schema: "./db/schema.ts",
  dialect: "sqlite",
});
