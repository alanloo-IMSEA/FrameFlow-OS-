import{loadIntegration,saveIntegration}from"../integrations/_lib";
import{readProjectConnection}from"../social-connections/_lib";
import{credentialSecret,parseCredentialSecret}from"./state";
export{TIKTOK_SCOPES,callbackUrl,cookie,credentialSecret,decodeState,encodeState,origin,parseCredentialSecret,projectRedirect}from"./state";

export async function runtime(){const{env}=await import("cloudflare:workers");return env as any}

export async function appConnection(db:any,env:any){
 const app=await loadIntegration(db,env,"tiktok-app");
 if(!app?.secret||!app.config?.clientKey)throw Object.assign(new Error("Configure TikTok Login Kit in Tier 0 System Connections first."),{status:409,code:"TIKTOK_APP_NOT_CONFIGURED"});
 return app;
}

export async function projectConnection(db:any,env:any,projectId:string,connectionId?:string|null){return readProjectConnection(db,env,projectId,"TikTok",connectionId)}

function providerMessage(result:any,status:number){return String(result?.error_description||result?.error?.message||result?.message||result?.error||`TikTok returned HTTP ${status}`)}

export async function refreshProjectAccessToken(db:any,env:any,connection:any){
 const stored=parseCredentialSecret(connection?.token),config=connection?.tokenConfig||{},expiresAt=Date.parse(String(config.accessTokenExpiresAt||config.expiresAt||connection?.tokenExpiresAt||""));
 if(stored.accessToken&&Number.isFinite(expiresAt)&&expiresAt>Date.now()+60_000)return stored.accessToken;
 if(!stored.refreshToken)throw Object.assign(new Error("TikTok refresh token is not available. Reconnect this Project Profile."),{status:409,code:"TIKTOK_REFRESH_TOKEN_MISSING"});
 const app=await appConnection(db,env),response=await fetch("https://open.tiktokapis.com/v2/oauth/token/",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded","cache-control":"no-cache"},body:new URLSearchParams({client_key:String(app.config.clientKey),client_secret:String(app.secret),grant_type:"refresh_token",refresh_token:stored.refreshToken})}),result:any=await response.json().catch(()=>({}));
 if(!response.ok||!result.access_token)throw Object.assign(new Error(providerMessage(result,response.status)),{status:409,code:String(result.error||"TIKTOK_TOKEN_REFRESH_FAILED")});
 const now=Date.now(),accessTokenExpiresAt=new Date(now+Math.max(1,Number(result.expires_in||86400))*1000).toISOString(),refreshTokenExpiresAt=new Date(now+Math.max(1,Number(result.refresh_expires_in||31536000))*1000).toISOString(),nextRefreshToken=String(result.refresh_token||stored.refreshToken),scopes=String(result.scope||config.scopes?.join(",")||"").split(",").map((scope:string)=>scope.trim()).filter(Boolean),nextConfig={...config,accountId:String(result.open_id||connection.accountId||""),accessTokenExpiresAt,refreshTokenExpiresAt,expiresAt:accessTokenExpiresAt,scopes};
 await saveIntegration(db,env,String(connection.providerKey),credentialSecret(String(result.access_token),nextRefreshToken),nextConfig,"Connected");
 await db.prepare("UPDATE project_social_connections SET permissions_json=?,token_expires_at=?,status='Connected',last_checked_at=?,updated_at=? WHERE project_id=? AND platform='TikTok' AND connection_id=?").bind(JSON.stringify(scopes),accessTokenExpiresAt,new Date(now).toISOString(),new Date(now).toISOString(),connection.projectId,connection.connectionId).run();
 return String(result.access_token);
}

export async function recordOAuthError(db:any,projectId:string,actorEmail:string,code:string,message:string,details:Record<string,unknown>={}){
 const now=new Date().toISOString();
 await db.prepare("INSERT INTO audit_log(project_id,event_type,actor_email,event_data,created_at) VALUES(?,?,?,?,?)").bind(projectId||null,"tiktok_oauth_failed",actorEmail||"system",JSON.stringify({code,message,...details}),now).run();
}

export function oauthErrorResult(result:any,status:number){return{code:String(result?.error||result?.error?.code||`HTTP_${status}`),message:providerMessage(result,status),logId:String(result?.log_id||result?.error?.log_id||"")}}
