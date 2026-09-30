import{base64url,hash,loginConnection,randomToken,runtime}from"../_lib";

export async function GET(req:Request){
 const env=await runtime(),url=new URL(req.url),memberEmail=String(url.searchParams.get("member")||"").trim().toLowerCase(),member=await env.DB.prepare("SELECT m.email,i.expected_username AS expectedUsername FROM members m JOIN member_telegram_identities i ON i.member_email=m.email WHERE m.email=? AND m.member_kind='human'").bind(memberEmail).first<any>();
 if(!member?.email||!member.expectedUsername)return Response.redirect(new URL("/telegram-login?status=error&reason=member-not-ready",req.url));
 let connection:any;try{connection=await loginConnection(env.DB,env)}catch{return Response.redirect(new URL("/telegram-login?status=error&reason=provider-not-ready",req.url))}
 const state=randomToken(),verifier=randomToken(48),digest=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(verifier))),challenge=base64url(digest),stamp=new Date().toISOString(),expiresAt=new Date(Date.now()+10*60*1000).toISOString();await env.DB.prepare("DELETE FROM member_telegram_login_requests WHERE expires_at<=?").bind(stamp).run();await env.DB.prepare("INSERT INTO member_telegram_login_requests(state_hash,member_email,code_verifier,expires_at,created_at) VALUES(?,?,?,?,?)").bind(await hash(state),memberEmail,verifier,expiresAt,stamp).run();
 const redirectUri=String(connection.config.redirectUri||new URL("/api/telegram-login/callback",req.url)),authorize=new URL("https://oauth.telegram.org/auth");authorize.searchParams.set("client_id",String(connection.config.clientId));authorize.searchParams.set("redirect_uri",redirectUri);authorize.searchParams.set("response_type","code");authorize.searchParams.set("scope","openid profile");authorize.searchParams.set("state",state);authorize.searchParams.set("code_challenge",challenge);authorize.searchParams.set("code_challenge_method","S256");
 return new Response(null,{status:302,headers:{location:authorize.toString(),"set-cookie":`ff_tg_login_state=${encodeURIComponent(state)}; Path=/api/telegram-login/callback; HttpOnly; Secure; SameSite=Lax; Max-Age=600`}});
}

