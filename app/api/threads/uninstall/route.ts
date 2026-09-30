import { deauthorizeThreadsAccount, systemCallbackError, verifiedThreadsRequest } from "../_system-callback";

export async function GET() {
  return Response.json({ service: "threads-deauthorization-callback", ready: true });
}

export async function POST(req: Request) {
  try {
    const { env, accountId } = await verifiedThreadsRequest(req);
    const connectionsUpdated = await deauthorizeThreadsAccount(env.DB, accountId);
    return Response.json({ success: true, connectionsUpdated });
  } catch (error) {
    return systemCallbackError(error);
  }
}
