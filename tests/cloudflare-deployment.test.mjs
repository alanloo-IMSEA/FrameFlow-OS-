import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  canonicalizeAuthenticatedRequest,
  requestUserEmail,
} from "../app/auth-headers.ts";

test("Cloudflare Access identity is normalized for existing FrameFlow routes", () => {
  const input = new Request("https://frameflow.example/api/session", {
    headers: { "cf-access-authenticated-user-email": " HANA@EXAMPLE.COM " },
  });
  const canonical = canonicalizeAuthenticatedRequest(input);
  assert.equal(requestUserEmail(canonical), "hana@example.com");
  assert.equal(
    canonical.headers.get("oai-authenticated-user-email"),
    "hana@example.com",
  );
});

test("ChatGPT Sites identity remains authoritative when both headers exist", () => {
  const input = new Request("https://frameflow.example/api/session", {
    headers: {
      "oai-authenticated-user-email": "sites@example.com",
      "cf-access-authenticated-user-email": "access@example.com",
    },
  });
  const canonical = canonicalizeAuthenticatedRequest(input);
  assert.equal(requestUserEmail(canonical), "sites@example.com");
});

test("Cloudflare config generator emits required FrameFlow bindings", async () => {
  const generated = new URL("../.cloudflare/wrangler.jsonc", import.meta.url);
  await rm(generated, { force: true });
  const result = spawnSync(process.execPath, ["scripts/prepare-cloudflare-config.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      FRAMEFLOW_WORKER_NAME: "frameflow-os",
      CLOUDFLARE_D1_DATABASE_ID: "11111111-1111-4111-8111-111111111111",
      CLOUDFLARE_D1_DATABASE_NAME: "frameflow-production-db",
      CLOUDFLARE_R2_BUCKET_NAME: "frameflow-production-assets",
    },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  const config = JSON.parse(await readFile(generated, "utf8"));
  assert.equal(config.name, "frameflow-os");
  assert.equal(config.main, "../dist/server/index.js");
  assert.equal(config.assets.binding, "ASSETS");
  assert.equal(config.d1_databases[0].binding, "DB");
  assert.equal(config.r2_buckets[0].binding, "BUCKET");
  assert.equal(config.images.binding, "IMAGES");
});
