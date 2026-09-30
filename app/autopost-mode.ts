/**
 * AutoPost is intentionally dormant. Keep the implementation and historical
 * records intact so it can be restored deliberately, while all user-facing
 * entry points fail closed.
 */
export const AUTOPOST_ENABLED = false;

export function autoPostNotFound() {
  return new Response("Not found", {
    status: 404,
    headers: { "cache-control": "no-store" },
  });
}
