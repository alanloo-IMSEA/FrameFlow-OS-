import { appConnection, runtime } from "../_lib";
import { createDeletionConfirmation, deleteThreadsAccountData, systemCallbackError, verifiedThreadsRequest, verifyDeletionConfirmation } from "../_system-callback";

export async function GET(req: Request) {
  const code = String(new URL(req.url).searchParams.get("code") || "");
  if (!code) return Response.json({ service: "threads-data-deletion-callback", ready: true });
  try {
    const env = await runtime();
    const app = await appConnection(env.DB, env);
    const valid = await verifyDeletionConfirmation(code, String(app.secret));
    return Response.json({ confirmation_code: code, status: valid ? "completed" : "not_found" }, { status: valid ? 200 : 404 });
  } catch (error) {
    return systemCallbackError(error);
  }
}

export async function POST(req: Request) {
  try {
    const { env, app, accountId } = await verifiedThreadsRequest(req);
    const { confirmationCode, statusUrl } = await createDeletionConfirmation(req, String(app.secret));
    await deleteThreadsAccountData(env.DB, accountId, confirmationCode);
    return Response.json({ url: statusUrl, confirmation_code: confirmationCode });
  } catch (error) {
    return systemCallbackError(error);
  }
}
