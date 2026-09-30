import{TIKTOK_SCOPES,appConnection,callbackUrl,encodeState,origin,runtime}from"../_lib";
import{socialAccess}from"../../social-connections/_lib";
import{AUTOPOST_ENABLED,autoPostNotFound}from"../../../autopost-mode";

export async function GET(req:Request){
 if(!AUTOPOST_ENABLED)return autoPostNotFound();
 const env=await runtime(),url=new URL(req.url),projectId=String(url.searchParams.get("projectId")||""),connectionId=String(url.searchParams.get("connectionId")||"");
 if(!projectId)return Response.redirect(`${origin(req)}/?tiktok=missing-project`);
 try{await socialAccess(req,env.DB,projectId,true)}catch{return Response.redirect(`${origin(req)}/?tiktok=management-required`)}
 const project=await env.DB.prepare("SELECT id FROM projects WHERE id=?").bind(projectId).first();
 if(!project)return Response.redirect(`${origin(req)}/?tiktok=project-not-found`);
 let app:any;try{app=await appConnection(env.DB,env)}catch{return Response.redirect(`${origin(req)}/?tiktok=configuration-required`)}
 const state=crypto.randomUUID().replaceAll("-",""),context=encodeState({state,projectId,connectionId:connectionId||null}),params=new URLSearchParams({client_key:String(app.config.clientKey),redirect_uri:callbackUrl(req),response_type:"code",scope:TIKTOK_SCOPES.join(","),state,disable_auto_auth:"1"});
 return new Response(null,{status:302,headers:{location:`https://www.tiktok.com/v2/auth/authorize/?${params}`,"set-cookie":`ff_tiktok_oauth=${context}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`}});
}
