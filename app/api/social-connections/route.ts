import{integrationStatus}from"../integrations/_lib";
import{apiError,publicConnection,readProjectConnection,readProjectConnections,socialAccess}from"./_lib";
import{refreshProjectAccessToken}from"../tiktok/_lib";
import{AUTOPOST_ENABLED,autoPostNotFound}from"../../autopost-mode";

async function runtime(){const{env}=await import("cloudflare:workers");return env as any}
const platformKey=(value:any)=>{const key=String(value||"").toLowerCase();return key==="threads"?"Threads":key==="tiktok"?"TikTok":key==="facebook page"||key==="facebook"?"Facebook Page":"Instagram"};

export async function GET(req:Request){try{
 if(!AUTOPOST_ENABLED)return autoPostNotFound();
 const env=await runtime(),projectId=String(new URL(req.url).searchParams.get("projectId")||""),actor=await socialAccess(req,env.DB,projectId),accounts=await readProjectConnections(env.DB,env,projectId),instagramApp=await integrationStatus(env.DB,"instagram-app"),threadsApp=await integrationStatus(env.DB,"threads-app"),tiktokApp=await integrationStatus(env.DB,"tiktok-app"),facebookApp=await integrationStatus(env.DB,"facebook-app"),definitions=[{platform:"Instagram",configured:instagramApp.connected,availability:"AUTO"},{platform:"Threads",configured:threadsApp.connected,availability:"AUTO"},{platform:"TikTok",configured:tiktokApp.connected,availability:"LOGIN KIT · CONNECTION ONLY"},{platform:"Facebook Page",configured:facebookApp.connected,availability:"OAUTH · PAGE CONNECTION ONLY"}];
 return Response.json({canManage:actor.tier<=1,connections:definitions.map(definition=>{const profiles=accounts.filter(row=>row.platform===definition.platform).map(publicConnection),account=profiles.find(row=>row?.isDefault)||profiles[0]||null;return{...definition,account,profiles}}),mediaDelivery:{configured:true,status:"Temporary Publishing Storage · built in"}});
}catch(error){return apiError(error)}}

export async function POST(req:Request){try{
 if(!AUTOPOST_ENABLED)return autoPostNotFound();
 const env=await runtime(),body=await req.json()as any,projectId=String(body.projectId||""),action=String(body.action||""),platform=platformKey(body.platform),actor=await socialAccess(req,env.DB,projectId,true),connection=await readProjectConnection(env.DB,env,projectId,platform,String(body.socialConnectionId||"")||null);
 if(!connection)return Response.json({error:`No ${platform} account is connected to this Project.`},{status:404});
 const now=new Date().toISOString();
 if(action==="set_default"){
  await env.DB.batch([env.DB.prepare("UPDATE project_social_connections SET is_default=0,updated_at=? WHERE project_id=? AND platform=?").bind(now,projectId,platform),env.DB.prepare("UPDATE project_social_connections SET is_default=1,updated_at=? WHERE project_id=? AND platform=? AND connection_id=?").bind(now,projectId,platform,connection.connectionId),env.DB.prepare("INSERT INTO audit_log(project_id,event_type,actor_email,event_data,created_at) VALUES(?,?,?,?,?)").bind(projectId,"social_default_profile_changed",actor.email,JSON.stringify({platform,socialConnectionId:connection.connectionId,handle:connection.handle}),now)]);return Response.json({ok:true,status:"Default",socialConnectionId:connection.connectionId});
 }
 if(action==="disconnect"){
  await env.DB.prepare("UPDATE project_social_connections SET status='Disconnected',disconnected_at=?,updated_at=? WHERE project_id=? AND platform=? AND connection_id=?").bind(now,now,projectId,platform,connection.connectionId).run();
  await env.DB.prepare("INSERT INTO audit_log(project_id,event_type,actor_email,event_data,created_at) VALUES(?,?,?,?,?)").bind(projectId,"social_account_disconnected",actor.email,JSON.stringify({platform,accountId:connection.accountId,handle:connection.handle}),now).run();
  return Response.json({ok:true,status:"Disconnected"});
 }
 if(action==="check"){
  let response:Response,result:any;
  if(platform==="TikTok"){
   const accessToken=await refreshProjectAccessToken(env.DB,env,connection),url=new URL("https://open.tiktokapis.com/v2/user/info/");url.searchParams.set("fields","open_id,display_name,username,profile_deep_link");response=await fetch(url,{headers:{authorization:`Bearer ${accessToken}`}});result=await response.json().catch(()=>({}));
  }else if(platform==="Facebook Page"){
   const facebookApp=await integrationStatus(env.DB,"facebook-app"),version=String(facebookApp.config?.apiVersion||"v26.0"),url=new URL(`https://graph.facebook.com/${/^v\d+\.\d+$/.test(version)?version:"v26.0"}/${encodeURIComponent(String(connection.accountId||""))}`);url.searchParams.set("fields","id,name,link,category");response=await fetch(url,{headers:{authorization:`Bearer ${String(connection.token||"")}`,"cache-control":"no-store"}});result=await response.json().catch(()=>({}));
  }else{const endpoint=platform==="Threads"?"https://graph.threads.net/v1.0/me":"https://graph.instagram.com/v26.0/me",url=new URL(endpoint);url.search=new URLSearchParams({fields:platform==="Threads"?"id,username":"user_id,username,account_type",access_token:String(connection.token||"")}).toString();response=await fetch(url);result=await response.json().catch(()=>({}))}
  const status=response.ok?"Connected":"Needs Reconnect";await env.DB.prepare("UPDATE project_social_connections SET status=?,last_checked_at=?,updated_at=? WHERE project_id=? AND platform=? AND connection_id=?").bind(status,now,now,projectId,platform,connection.connectionId).run();
  await env.DB.prepare("INSERT INTO audit_log(project_id,event_type,actor_email,event_data,created_at) VALUES(?,?,?,?,?)").bind(projectId,"social_connection_checked",actor.email,JSON.stringify({platform,status,httpStatus:response.status,errorCode:result?.error?.code||result?.error||null}),now).run();
  if(!response.ok)return Response.json({error:result?.error?.message||result?.error_description||`${platform} rejected the token.`,status},{status:409});
  const account=platform==="TikTok"?result?.data?.user||{}:result;return Response.json({ok:true,status,account:{id:account.id||account.user_id||account.open_id,username:account.username||account.display_name||account.name}});
 }
 return Response.json({error:"Unknown Social Connection action."},{status:400});
}catch(error){return apiError(error)}}
