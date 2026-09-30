// Read-only requests fail visibly; an unavailable service is never an empty list.
export async function readJson(url: string, signal?: AbortSignal) {
  const response = await fetch(url, { cache: "no-store", signal: signal || AbortSignal.timeout(20000) });
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new Error("The service did not return data. Please retry; your saved records have not been removed.");
  }
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Unable to load saved records. Please retry.");
  return result;
}
