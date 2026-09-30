export const CHATGPT_USER_EMAIL_HEADER = "oai-authenticated-user-email";
export const CLOUDFLARE_ACCESS_EMAIL_HEADER =
  "cf-access-authenticated-user-email";

function normalizedEmail(value: string | null): string | null {
  const email = value?.trim().toLowerCase() || "";
  return email && email.includes("@") ? email : null;
}

export function requestUserEmail(
  req: Pick<Request, "headers">,
): string | null {
  return (
    normalizedEmail(req.headers.get(CHATGPT_USER_EMAIL_HEADER)) ||
    normalizedEmail(req.headers.get(CLOUDFLARE_ACCESS_EMAIL_HEADER))
  );
}

/**
 * FrameFlow's existing API routes consume the ChatGPT Sites identity header.
 * When the same application runs behind Cloudflare Access, copy Access's
 * authenticated email into that canonical header at the Worker boundary.
 * Cloudflare Access must protect the deployed hostname before production use.
 */
export function canonicalizeAuthenticatedRequest(request: Request): Request {
  if (normalizedEmail(request.headers.get(CHATGPT_USER_EMAIL_HEADER))) {
    return request;
  }

  const accessEmail = normalizedEmail(
    request.headers.get(CLOUDFLARE_ACCESS_EMAIL_HEADER),
  );
  if (!accessEmail) return request;

  const headers = new Headers(request.headers);
  headers.set(CHATGPT_USER_EMAIL_HEADER, accessEmail);
  return new Request(request, { headers });
}
