export const FACEBOOK_SCOPES=["pages_show_list","pages_read_engagement","pages_manage_posts","read_insights"];

export function origin(req:Request){return new URL(req.url).origin}
export function callbackUrl(req:Request){return `${origin(req)}/api/facebook/callback`}
export function encodeState(value:Record<string,unknown>){const bytes=new TextEncoder().encode(JSON.stringify(value));let binary="";for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary).replaceAll("+","-").replaceAll("/","_").replace(/=+$/g,"")}
export function decodeState(value:string){try{const normalized=value.replaceAll("-","+").replaceAll("_","/")+"===".slice((value.length+3)%4),binary=atob(normalized),bytes=Uint8Array.from(binary,x=>x.charCodeAt(0));return JSON.parse(new TextDecoder().decode(bytes))}catch{return null}}
export function cookie(req:Request,name:string){const found=(req.headers.get("cookie")||"").split(";").map(x=>x.trim()).find(x=>x.startsWith(name+"="));return found?decodeURIComponent(found.slice(name.length+1)):""}
export function projectRedirect(req:Request,projectId:string,result:string){const target=new URL("/",origin(req));if(projectId)target.searchParams.set("projectId",projectId);target.searchParams.set("phase","publishing");target.searchParams.set("facebook",result);return target.toString()}

export type FacebookPageCandidate={id:string;name:string;link:string;category:string;tasks:string[];accessToken:string};
export type FacebookSelectionSecret={pages:FacebookPageCandidate[]};
export function selectionSecret(pages:FacebookPageCandidate[]){return JSON.stringify({pages})}
export function parseSelectionSecret(value:unknown):FacebookSelectionSecret{try{const parsed=JSON.parse(String(value||"{}"));return{pages:Array.isArray(parsed.pages)?parsed.pages:[]}}catch{return{pages:[]}}}
