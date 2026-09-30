import{FACEBOOK_SCOPES,apiVersion,appConnection,callbackUrl,encodeState,origin,recordOAuthError,runtime}from"../_lib";
import{socialAccess}from"../../social-connections/_lib";
import{AUTOPOST_ENABLED,autoPostNotFound}from"../../../autopost-mode";

export async function GET(req:Request){
 if(!AUTOPOST_ENABLED)return autoPostNotFound();
 const env=await runtime(),url=new URL(req.url),projectId=String(url.searchParams.get("projectId")||""),connectionId=String(url.searchParams.get("connectionId")||"");
 if(!projectId)return Response.redirect(`${origin(req)}/?facebook=missing-project`);
 let actor:any;try{actor=await socialAccess(req,env.DB,projectId,true)}catch{return Response.redirect(`${origin(req)}/?facebook=management-required`)}
 const project=await env.DB.prepare("SELECT id FROM projects WHERE id=?").bind(projectId).first();if(!project)return Response.redirect(`${origin(req)}/?facebook=project-not-found`);
 let app:any;try{app=await appConnection(env.DB,env)}catch(error:any){await recordOAuthError(env.DB,projectId,String(actor?.email||"system"),"CONFIGURATION_REQUIRED",String(error?.message||"Facebook App is not configured."),{stage:"connect"});return Response.redirect(`${origin(req)}/?facebook=configuration-required`)}
 const stale=new Date(Date.now()-15*60*1000).toISOString();await env.DB.prepare("DELETE FROM integration_connections WHERE provider LIKE 'facebook-selection:%' AND updated_at<?").bind(stale).run();
 const state=crypto.randomUUID().replaceAll("-",""),context=encodeState({state,projectId,connectionId:connectionId||null}),params=new URLSearchParams({client_id:String(app.config.appId),redirect_uri:callbackUrl(req),response_type:"code",scope:FACEBOOK_SCOPES.join(","),state,auth_type:"rerequest",return_scopes:"true"});
 return new Response(null,{status:302,headers:{location:`https://www.facebook.com/${apiVersion(app.config)}/dialog/oauth?${params}`,"set-cookie":`ff_fb_oauth=${context}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`}});
}
