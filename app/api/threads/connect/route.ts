import{THREADS_SCOPES,appConnection,callbackUrl,encodeState,origin,runtime}from"../_lib";
import{socialAccess}from"../../social-connections/_lib";
import{AUTOPOST_ENABLED,autoPostNotFound}from"../../../autopost-mode";

export async function GET(req:Request){
 if(!AUTOPOST_ENABLED)return autoPostNotFound();
 const env=await runtime(),url=new URL(req.url),projectId=String(url.searchParams.get("projectId")||""),connectionId=String(url.searchParams.get("connectionId")||"");
 if(!projectId)return Response.redirect(`${origin(req)}/?threads=missing-project`);
 try{await socialAccess(req,env.DB,projectId,true)}catch{return Response.redirect(`${origin(req)}/?threads=management-required`)}
 const project=await env.DB.prepare("SELECT id FROM projects WHERE id=?").bind(projectId).first();if(!project)return Response.redirect(`${origin(req)}/?threads=project-not-found`);
 let app:any;try{app=await appConnection(env.DB,env)}catch{return Response.redirect(`${origin(req)}/?threads=configuration-required`)}
 const state=crypto.randomUUID().replaceAll("-",""),context=encodeState({state,projectId,connectionId:connectionId||null}),params=new URLSearchParams({client_id:String(app.config.appId),redirect_uri:callbackUrl(req),response_type:"code",scope:THREADS_SCOPES.join(","),state});
 return new Response(null,{status:302,headers:{location:`https://threads.net/oauth/authorize?${params}`,"set-cookie":`ff_threads_oauth=${context}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`}});
}
