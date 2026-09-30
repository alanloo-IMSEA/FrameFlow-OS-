import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function required(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name} is required for a Cloudflare build.`);
  return value;
}

const workerName = String(process.env.FRAMEFLOW_WORKER_NAME || "frameflow-os").trim();
const databaseId = required("CLOUDFLARE_D1_DATABASE_ID");
const databaseName = String(
  process.env.CLOUDFLARE_D1_DATABASE_NAME || "frameflow-production-db",
).trim();
const bucketName = required("CLOUDFLARE_R2_BUCKET_NAME");

if (!/^[a-z0-9][a-z0-9-]*$/.test(workerName)) {
  throw new Error("FRAMEFLOW_WORKER_NAME must be a lowercase Worker name.");
}

const config = {
  $schema: "../node_modules/wrangler/config-schema.json",
  name: workerName,
  main: "../dist/server/index.js",
  compatibility_date: "2026-09-29",
  compatibility_flags: ["nodejs_compat"],
  assets: {
    binding: "ASSETS",
    directory: "../dist/client",
  },
  d1_databases: [
    {
      binding: "DB",
      database_name: databaseName,
      database_id: databaseId,
      migrations_dir: "../drizzle-baseline",
    },
  ],
  r2_buckets: [
    {
      binding: "BUCKET",
      bucket_name: bucketName,
    },
  ],
  images: { binding: "IMAGES" },
  vars: { FRAMEFLOW_DEPLOYMENT_TARGET: "cloudflare" },
  observability: { enabled: true },
};

const outputPath = resolve(projectRoot, ".cloudflare/wrangler.jsonc");
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
console.log(`Prepared ${outputPath}`);
