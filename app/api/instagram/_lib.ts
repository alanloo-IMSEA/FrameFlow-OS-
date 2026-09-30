import{loadIntegration}from"../integrations/_lib";
import{readProjectConnection}from"../social-connections/_lib";

export const INSTAGRAM_SCOPES=["instagram_business_basic","instagram_business_content_publish","instagram_business_manage_insights"];

export async function runtime(){const{env}=await import("cloudflare:workers");return env as any}
export function origin(req:Request){return new URL(req.url).origin}
export function callbackUrl(req:Request){return `${origin(req)}/api/instagram/callback`}
export async function ensureInstagramTables(_db:any){return}

export async function appConnection(db:any,env:any){
 const app=await loadIntegration(db,env,"instagram-app");
 if(!app?.secret||!app.config?.appId)throw Object.assign(new Error("Configure the Instagram App in Tier 0 System Connections first."),{status:409,code:"INSTAGRAM_APP_NOT_CONFIGURED"});
 return app;
}

export async function projectConnection(db:any,env:any,projectId:string){
 return readProjectConnection(db,env,projectId,"Instagram");
}

export function encodeState(value:Record<string,string>){
 const bytes=new TextEncoder().encode(JSON.stringify(value));let binary="";for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary).replaceAll("+","-").replaceAll("/","_").replace(/=+$/g,"");
}
export function decodeState(value:string){try{const normalized=value.replaceAll("-","+").replaceAll("_","/")+"===".slice((value.length+3)%4),binary=atob(normalized),bytes=Uint8Array.from(binary,x=>x.charCodeAt(0));return JSON.parse(new TextDecoder().decode(bytes))}catch{return null}}
export function cookie(req:Request,name:string){const found=(req.headers.get("cookie")||"").split(";").map(x=>x.trim()).find(x=>x.startsWith(name+"="));return found?decodeURIComponent(found.slice(name.length+1)):""}
export function apiVersion(config:any){return /^v\d+\.\d+$/.test(String(config?.apiVersion||""))?String(config.apiVersion):"v26.0"}
export function jsonError(error:any){return Response.json({error:String(error?.message||error||"Instagram request failed"),code:error?.code||null},{status:Number(error?.status||500)})}
export function parse(value:any){try{return JSON.parse(value||"{}") }catch{return{}}}
