import { appConnection, origin, runtime } from "./_lib";

type ThreadsSignedPayload = {
  algorithm?: string;
  user_id?: string | number;
  issued_at?: number;
  [key: string]: unknown;
};

const encoder = new TextEncoder();

function decodeBase64Url(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(normalized);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function encodeBase64Url(value: Uint8Array) {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++) difference |= left[index] ^ right[index];
  return difference === 0;
}

async function hmac(secret: string, value: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

async function signedRequestFrom(req: Request) {
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    return String(body?.signed_request || "");
  }
  const form = await req.formData().catch(() => null);
  return String(form?.get("signed_request") || "");
}

export async function verifiedThreadsRequest(req: Request) {
  const env = await runtime();
  const app = await appConnection(env.DB, env);
  const signedRequest = await signedRequestFrom(req);
  const [encodedSignature, encodedPayload, extra] = signedRequest.split(".");
  if (!encodedSignature || !encodedPayload || extra) throw Object.assign(new Error("A valid Threads signed_request is required."), { status: 400 });

  let payload: ThreadsSignedPayload;
  let suppliedSignature: Uint8Array;
  try {
    suppliedSignature = decodeBase64Url(encodedSignature);
    payload = JSON.parse(new TextDecoder().decode(decodeBase64Url(encodedPayload)));
  } catch {
    throw Object.assign(new Error("The Threads signed_request is malformed."), { status: 400 });
  }

  if (String(payload.algorithm || "HMAC-SHA256").toUpperCase() !== "HMAC-SHA256") {
    throw Object.assign(new Error("Unsupported Threads signed_request algorithm."), { status: 400 });
  }
  const expectedSignature = await hmac(String(app.secret), encodedPayload);
  if (!constantTimeEqual(suppliedSignature, expectedSignature)) {
    throw Object.assign(new Error("The Threads signed_request signature is invalid."), { status: 403 });
  }
  const accountId = String(payload.user_id || "");
  if (!accountId) throw Object.assign(new Error("The Threads signed_request does not contain a user_id."), { status: 400 });
  return { env, app, payload, accountId };
}

async function accountConnections(db: any, accountId: string) {
  const rows = await db.prepare("SELECT connection_id AS connectionId,project_id AS projectId,provider_key AS providerKey FROM project_social_connections WHERE platform='Threads' AND external_account_id=?").bind(accountId).all();
  return rows.results as Array<{ connectionId: string; projectId: string; providerKey: string }>;
}

export async function deauthorizeThreadsAccount(db: any, accountId: string) {
  const connections = await accountConnections(db, accountId);
  const now = new Date().toISOString();
  for (const connection of connections) {
    await db.batch([
      db.prepare("DELETE FROM integration_connections WHERE provider=?").bind(connection.providerKey),
      db.prepare("UPDATE project_social_connections SET status='Deauthorized',token_expires_at=NULL,last_checked_at=?,disconnected_at=?,updated_at=? WHERE connection_id=? AND platform='Threads'").bind(now, now, now, connection.connectionId),
      db.prepare("INSERT INTO audit_log(project_id,event_type,actor_email,event_data,created_at) VALUES(?,'threads_account_deauthorized',NULL,?,?)").bind(connection.projectId, JSON.stringify({ socialConnectionId: connection.connectionId, source: "meta_callback" }), now),
    ]);
  }
  return connections.length;
}

export async function deleteThreadsAccountData(db: any, accountId: string, confirmationCode: string) {
  const connections = await accountConnections(db, accountId);
  const now = new Date().toISOString();
  for (const connection of connections) {
    await db.batch([
      db.prepare("DELETE FROM integration_connections WHERE provider=?").bind(connection.providerKey),
      db.prepare("DELETE FROM social_performance_snapshots WHERE platform='Threads' AND (social_connection_id=? OR connected_account_id=?)").bind(connection.connectionId, accountId),
      db.prepare("UPDATE publishing_records SET social_connection_id=NULL,connected_account_id=NULL,connected_handle=NULL,provider_post_id=NULL,provider_media_id=NULL,post_url=NULL,result='{}',raw_metrics='{}',normalized_metrics='{}',performance_sync_status='DELETED',updated_at=? WHERE platform='Threads' AND (social_connection_id=? OR connected_account_id=?)").bind(now, connection.connectionId, accountId),
      db.prepare("DELETE FROM project_social_connections WHERE connection_id=? AND platform='Threads'").bind(connection.connectionId),
      db.prepare("INSERT INTO audit_log(project_id,event_type,actor_email,event_data,created_at) VALUES(?,'threads_data_deleted',NULL,?,?)").bind(connection.projectId, JSON.stringify({ confirmationCode, source: "meta_callback" }), now),
    ]);
  }
  return connections.length;
}

export async function createDeletionConfirmation(req: Request, secret: string) {
  const payload = `${crypto.randomUUID()}.${Date.now()}`;
  const signature = encodeBase64Url(await hmac(secret, payload));
  const confirmationCode = `${payload}.${signature}`;
  const statusUrl = new URL("/api/threads/delete", origin(req));
  statusUrl.searchParams.set("code", confirmationCode);
  return { confirmationCode, statusUrl: statusUrl.toString() };
}

export async function verifyDeletionConfirmation(code: string, secret: string) {
  const parts = code.split(".");
  if (parts.length !== 3) return false;
  const payload = `${parts[0]}.${parts[1]}`;
  let supplied: Uint8Array;
  try { supplied = decodeBase64Url(parts[2]); } catch { return false; }
  return constantTimeEqual(supplied, await hmac(secret, payload));
}

export function systemCallbackError(error: unknown) {
  const value = error as { message?: string; status?: number };
  return Response.json({ error: String(value?.message || "Threads callback failed.") }, { status: Number(value?.status || 500) });
}
