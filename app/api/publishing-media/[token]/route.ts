async function runtime(){const{env}=await import("cloudflare:workers");return env as any}

export async function GET(_req:Request,{params}:{params:Promise<{token:string}>}){
 if(!AUTOPOST_ENABLED)return autoPostNotFound();
 const env=await runtime(),{token}=await params,now=new Date().toISOString();
 if(!/^ffpub_[a-f0-9]{64}$/.test(token))return new Response("Not found",{status:404});
 const row=await env.DB.prepare("SELECT id,temporary_storage_key AS temporaryStorageKey,file_name AS fileName,mime_type AS mimeType,expires_at AS expiresAt,status FROM temporary_publishing_assets WHERE access_token=? LIMIT 1").bind(token).first<any>();
 if(!row||row.status!=="ACTIVE")return new Response("Not found",{status:404});
 if(Date.parse(row.expiresAt)<=Date.now()){await env.BUCKET.delete(String(row.temporaryStorageKey));await env.DB.prepare("UPDATE temporary_publishing_assets SET status='DELETED',deleted_at=?,updated_at=? WHERE id=?").bind(now,now,row.id).run();return new Response("Expired",{status:410})}
 const object=await env.BUCKET.get(String(row.temporaryStorageKey));if(!object)return new Response("Not found",{status:404});
 await env.DB.prepare("UPDATE temporary_publishing_assets SET first_fetched_at=COALESCE(first_fetched_at,?),last_fetched_at=?,updated_at=? WHERE id=?").bind(now,now,now,row.id).run();
 return new Response(object.body,{headers:{"content-type":row.mimeType||object.httpMetadata?.contentType||"application/octet-stream","content-length":String(object.size),"content-disposition":`inline; filename="${String(row.fileName||"asset").replaceAll('"','')}"`,"cache-control":"public, max-age=300","access-control-allow-origin":"*","x-content-type-options":"nosniff"}})
}

export async function HEAD(req:Request,context:{params:Promise<{token:string}>}){const response=await GET(req,context);return new Response(null,{status:response.status,headers:response.headers})}
import{AUTOPOST_ENABLED,autoPostNotFound}from"../../../autopost-mode";
