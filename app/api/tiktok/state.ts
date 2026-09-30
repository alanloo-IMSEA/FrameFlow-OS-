export const TIKTOK_SCOPES=["user.info.basic","user.info.profile"];

export function origin(req:Request){return new URL(req.url).origin}
export function callbackUrl(req:Request){return `${origin(req)}/api/tiktok/callback`}
export function encodeState(value:Record<string,unknown>){const bytes=new TextEncoder().encode(JSON.stringify(value));let binary="";for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary).replaceAll("+","-").replaceAll("/","_").replace(/=+$/g,"")}
export function decodeState(value:string){try{const normalized=value.replaceAll("-","+").replaceAll("_","/")+"===".slice((value.length+3)%4),binary=atob(normalized),bytes=Uint8Array.from(binary,x=>x.charCodeAt(0));return JSON.parse(new TextDecoder().decode(bytes))}catch{return null}}
export function cookie(req:Request,name:string){const found=(req.headers.get("cookie")||"").split(";").map(x=>x.trim()).find(x=>x.startsWith(name+"="));return found?decodeURIComponent(found.slice(name.length+1)):""}

export type TikTokCredentials={accessToken:string;refreshToken:string};
export function parseCredentialSecret(value:unknown):TikTokCredentials{try{const parsed=JSON.parse(String(value||"{}"));return{accessToken:String(parsed.accessToken||""),refreshToken:String(parsed.refreshToken||"")}}catch{return{accessToken:String(value||""),refreshToken:""}}}
export function credentialSecret(accessToken:string,refreshToken:string){return JSON.stringify({accessToken,refreshToken})}
export function projectRedirect(req:Request,projectId:string,result:string){const target=new URL("/",origin(req));if(projectId)target.searchParams.set("projectId",projectId);target.searchParams.set("phase","publishing");target.searchParams.set("tiktok",result);return target.toString()}
