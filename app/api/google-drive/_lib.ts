import{requestUserEmail}from"../../chatgpt-auth";
const OWNER="alanloo927@gmail.com";
export async function runtime(){const{env}=await import("cloudflare:workers");return env as any}
export function owner(req:Request){return requestUserEmail(req)===OWNER}
export async function table(db:any){await db.prepare(`CREATE TABLE IF NOT EXISTS drive_connections (account_email TEXT PRIMARY KEY,encrypted_refresh_token TEXT NOT NULL,root_folder_id TEXT NOT NULL,root_folder_url TEXT NOT NULL,connected_at TEXT NOT NULL,updated_at TEXT NOT NULL)`).run()}
function bytes(s:string){return new TextEncoder().encode(s)}
function b64(a:Uint8Array){let s="";for(const x of a)s+=String.fromCharCode(x);return btoa(s)}
function unb64(s:string){return Uint8Array.from(atob(s),c=>c.charCodeAt(0))}
async function key(secret:string){const digest=await crypto.subtle.digest("SHA-256",bytes(secret));return crypto.subtle.importKey("raw",digest,{name:"AES-GCM"},false,["encrypt","decrypt"])}
export async function encrypt(value:string,secret:string){const iv=crypto.getRandomValues(new Uint8Array(12)),out=await crypto.subtle.encrypt({name:"AES-GCM",iv},await key(secret),bytes(value));return `${b64(iv)}.${b64(new Uint8Array(out))}`}
export async function decrypt(value:string,secret:string){const[iv,body]=value.split(".");const out=await crypto.subtle.decrypt({name:"AES-GCM",iv:unb64(iv)},await key(secret),unb64(body));return new TextDecoder().decode(out)}
export function cookie(req:Request,name:string){return(req.headers.get("cookie")||"").split(";").map(x=>x.trim()).find(x=>x.startsWith(`${name}=`))?.slice(name.length+1)||""}
export function base(req:Request){return new URL(req.url).origin}
