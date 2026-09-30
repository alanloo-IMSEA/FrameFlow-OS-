// Production schema and indexes are owned exclusively by immutable Drizzle migrations.
// This compatibility hook intentionally performs no runtime DDL or data backfill.
export async function ensureBusinessSchema(_db:any){return}
