import{loadIntegration}from"../integrations/_lib";

export const TELEGRAM_ISSUER="https://oauth.telegram.org";
export async function runtime(){const{env}=await import("cloudflare:workers");return env as any}
export function cookie(req:Request,name:string){const match=(req.headers.get("cookie")||"").match(new RegExp(`(?:^|; )${name}=([^;]*)`));return match?decodeURIComponent(match[1]):""}
export function base64url(bytes:Uint8Array){let binary="";for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")}
export function decode64url(value:string){const normalized=value.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(value.length/4)*4,"="),binary=atob(normalized);return Uint8Array.from(binary,x=>x.charCodeAt(0))}
export async function hash(value:string){const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,"0")).join("")}
export function randomToken(bytes=32){return base64url(crypto.getRandomValues(new Uint8Array(bytes)))}
export async function loginConnection(db:any,env:any){const connection=await loadIntegration(db,env,"telegram-login");if(!connection?.secret||!connection.config?.clientId)throw Object.assign(new Error("Telegram Login is not configured."),{status:503});return connection}
export async function verifyTelegramIdToken(token:string,clientId:string){
 const parts=token.split(".");if(parts.length!==3)throw new Error("Invalid Telegram ID token.");
 const header=JSON.parse(new TextDecoder().decode(decode64url(parts[0]))),claims=JSON.parse(new TextDecoder().decode(decode64url(parts[1])));if(header.alg!=="RS256"||!header.kid)throw new Error("Unsupported Telegram token signature.");
 const response=await fetch(`${TELEGRAM_ISSUER}/.well-known/jwks.json`),jwks:any=await response.json();if(!response.ok)throw new Error("Telegram signing keys unavailable.");const jwk=(jwks.keys||[]).find((key:any)=>key.kid===header.kid);if(!jwk)throw new Error("Telegram signing key not found.");
 const key=await crypto.subtle.importKey("jwk",jwk,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]),valid=await crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,decode64url(parts[2]),new TextEncoder().encode(`${parts[0]}.${parts[1]}`));if(!valid)throw new Error("Telegram token signature invalid.");
 const audience=Array.isArray(claims.aud)?claims.aud:[claims.aud];if(claims.iss!==TELEGRAM_ISSUER||!audience.map(String).includes(String(clientId))||Number(claims.exp||0)*1000<=Date.now())throw new Error("Telegram token claims invalid.");return claims;
}

