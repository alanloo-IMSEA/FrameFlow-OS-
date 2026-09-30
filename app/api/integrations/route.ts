import{integrationOwner,integrationStatus,loadIntegration,saveIntegration}from"./_lib";
import{AGENT_READ_SCOPES,createAgentReadToken,hashAgentToken}from"../agent-access/service";
import{RUNNINGHUB_ACCOUNT_STATUS_PATH,RUNNINGHUB_BASE_URL,testRunningHubConnection}from"../runninghub/service";
import{RUNNINGHUB_UPSCALE_WORKFLOW_ID}from"../runninghub/contract";
import{inspectRunningHubH3Graph,RUNNINGHUB_H3_WORKFLOW_ID,runningHubH3MappingIssues}from"../runninghub/video-contract";
import{verifyAndStoreRunningHubH3Contract}from"../runninghub/workflow-registry";
import{inspectRunningHubQwenImageGraph,RUNNINGHUB_QWEN_IMAGE_WORKFLOW_ID,runningHubImageMappingIssues}from"../runninghub/image-contract";
import{verifyAndStoreRunningHubImageContract}from"../runninghub/image-registry";
import{AUTOPOST_ENABLED,autoPostNotFound}from"../../autopost-mode";

const llmProviders={
 gemini:{label:"Google Gemini",baseUrl:"https://generativelanguage.googleapis.com/v1beta/openai",defaultModel:"gemini-3.5-flash-lite"},
 zai:{label:"Z.AI",baseUrl:"https://api.z.ai/api/paas/v4",defaultModel:"glm-4.7-flash"},
 zhipu:{label:"Zhipu China",baseUrl:"https://open.bigmodel.cn/api/paas/v4",defaultModel:"glm-4.7-flash"},
}as const;
const scopes=(value:any)=>{try{const parsed=JSON.parse(value||"[]");return Array.isArray(parsed)?parsed:[]}catch{return[]}};
const OPENROUTER_BASE_URL="https://openrouter.ai/api/v1",DEFAULT_TELEGRAM_CHAT_ID="8009020714",MILLA_AGENT_ID="agent:milla-im",AGENT_RELAY_URL="https://frameflow-agent-relay.alanloo927.chatgpt.site/telegram",AGENT_PROJECTS_RELAY_URL="https://frameflow-agent-relay.alanloo927.chatgpt.site/v1/projects";
const agentConnectionKey=(agentId:string)=>`agent-telegram:${agentId}`;
const agentRelayKey=(agentId:string)=>`agent-relay:${agentId}`;
const wait=(milliseconds:number)=>new Promise(resolve=>setTimeout(resolve,milliseconds));
const runningHubConfig=(existing:any={})=>({providerLabel:"RunningHub",baseUrl:RUNNINGHUB_BASE_URL,accountStatusPath:RUNNINGHUB_ACCOUNT_STATUS_PATH,workflowExecutionEnabled:true,workflowId:RUNNINGHUB_UPSCALE_WORKFLOW_ID,qwenImageWorkflowId:RUNNINGHUB_QWEN_IMAGE_WORKFLOW_ID,qwenImageMapping:existing?.qwenImageMapping||null,qwenImageContract:existing?.qwenImageContract||null,h3VideoWorkflowId:RUNNINGHUB_H3_WORKFLOW_ID,h3VideoMapping:existing?.h3VideoMapping||null,h3WorkflowContract:existing?.h3WorkflowContract||null});

async function testLlm(baseUrl:string,apiKey:string,model:string,provider:string){
 let response:Response|null=null,result:any={};
 for(let attempt=0;attempt<3;attempt++){
  const payload:any={model,temperature:0,max_tokens:512,messages:[{role:"system",content:"Return valid JSON only."},{role:"user",content:'Return exactly {"frameflow":"connected"}'}]};
  if(provider!=="gemini"&&model.toLowerCase().startsWith("glm-4.7"))payload.thinking={type:"disabled"};
  response=await fetch(`${baseUrl}/chat/completions`,{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${apiKey}`},body:JSON.stringify(payload)});
  try{result=await response.json()}catch{result={}}
  const message=String(result?.error?.message||"").toLowerCase(),busy=response.status===429||message.includes("overload")||message.includes("temporarily busy");
  if(!busy||attempt===2)return{response,result,busy};
  await wait(700*(attempt+1));
 }
 return{response:response!,result,busy:false};
}

async function runtime(){const{env}=await import("cloudflare:workers");return env as any}

export async function GET(req:Request){
 if(!integrationOwner(req))return Response.json({error:"Tier 0 Management access required"},{status:403});
 const env=await runtime(),llm=await integrationStatus(env.DB,"llm"),legacyGlm=await integrationStatus(env.DB,"glm"),active=llm.connected?llm:legacyGlm,image=await integrationStatus(env.DB,"image"),runningHub=await integrationStatus(env.DB,"runninghub"),instagramApp=await integrationStatus(env.DB,"instagram-app"),facebookApp=await integrationStatus(env.DB,"facebook-app"),threadsApp=await integrationStatus(env.DB,"threads-app"),tiktokApp=await integrationStatus(env.DB,"tiktok-app"),telegramLogin=await integrationStatus(env.DB,"telegram-login"),legacyRelay=await integrationStatus(env.DB,"agent-relay"),millaRelay=await integrationStatus(env.DB,agentRelayKey(MILLA_AGENT_ID)),rows=await env.DB.prepare("SELECT email AS id,name,telegram_username AS telegramUsername,telegram_chat_id AS telegramChatId FROM members WHERE member_kind='agent' ORDER BY created_at").all(),agents=[];
 for(const agent of rows.results as any[]){let connection=await integrationStatus(env.DB,agentConnectionKey(agent.id));if(!connection.connected&&agent.id===MILLA_AGENT_ID)connection=await integrationStatus(env.DB,"telegram");const relay=agent.id===MILLA_AGENT_ID?(millaRelay.connected?millaRelay:legacyRelay):{connected:false,status:"Scope not configured",config:{}},token=await env.DB.prepare("SELECT id,status,scopes_json AS scopesJson,created_at AS createdAt,expires_at AS expiresAt,last_used_at AS lastUsedAt FROM agent_api_tokens WHERE agent_id=? AND status='Active' AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1").bind(agent.id).first<any>(),active=Boolean(token&&(!token.expiresAt||token.expiresAt>new Date().toISOString()));agents.push({...agent,connection,relay,dataAccess:{connected:active,status:active?"Assigned Project Memory · Scoped read-only":"Not configured",config:{relayUrl:AGENT_PROJECTS_RELAY_URL,scope:scopes(token?.scopesJson),availableScopes:AGENT_READ_SCOPES,expiresAt:token?.expiresAt||null,lastUsedAt:token?.lastUsedAt||null}}})}
 return Response.json({
  llm:{...active,config:{provider:active.config?.provider||"",providerLabel:active.config?.providerLabel||"",model:active.config?.model||""}},
  image:{...image,config:{provider:image.config?.provider||"",providerLabel:image.config?.providerLabel||"",model:image.config?.model||"",baseUrl:image.config?.baseUrl||OPENROUTER_BASE_URL}},
  runningHub:{...runningHub,configured:runningHub.connected,connected:runningHub.status==="Connected",config:{...runningHubConfig(runningHub.config),qwenImageMappingConfigured:runningHubImageMappingIssues(runningHub.config?.qwenImageMapping).length===0,h3VideoMappingConfigured:runningHubH3MappingIssues(runningHub.config?.h3VideoMapping).length===0}},
  telegramLogin:{...telegramLogin,config:{clientId:telegramLogin.config?.clientId||"",redirectUri:telegramLogin.config?.redirectUri||new URL("/api/telegram-login/callback",req.url).toString(),issuer:"https://oauth.telegram.org"}},
  agents,relay:millaRelay.connected?millaRelay:legacyRelay,
 });
}

export async function POST(req:Request){
 if(!integrationOwner(req))return Response.json({error:"Tier 0 Management access required"},{status:403});
 const env=await runtime(),body=await req.json()as any,action=String(body.action||"");
 if(!AUTOPOST_ENABLED&&["configureInstagramApp","configureFacebookApp","configureThreadsApp","configureTikTokApp","configurePublishingMedia","configurePublishingScheduler"].includes(action))return autoPostNotFound();
 if(action==="connectLlm"||action==="connectGlm"){
  const provider=String(body.provider||"")as keyof typeof llmProviders,model=String(body.model||"").trim(),apiKey=String(body.apiKey||"").trim(),definition=llmProviders[provider];
  if(!definition||!model||!apiKey)return Response.json({error:"Choose the Provider, enter the exact model name and API Key."},{status:400});
  const{response:test,result,busy}=await testLlm(definition.baseUrl,apiKey,model,provider);
  if(busy){await saveIntegration(env.DB,env,"llm",apiKey,{provider,providerLabel:definition.label,model,baseUrl:definition.baseUrl},"Credentials saved · provider busy · test pending");return Response.json({ok:true,warning:true,message:`${definition.label} credentials were saved securely. Validation is pending because the provider is busy.`})}
  const message=result?.choices?.[0]?.message,hasResponse=Boolean(message&&(message.content||message.reasoning_content));
  if(!test.ok||!hasResponse)return Response.json({error:result?.error?.message||`${definition.label} returned HTTP ${test.status} without a usable completion.`},{status:400});
  await saveIntegration(env.DB,env,"llm",apiKey,{provider,providerLabel:definition.label,model,baseUrl:definition.baseUrl},"Connected");
  return Response.json({ok:true,message:`${definition.label} · ${model} connected and tested.`});
 }
 if(action==="connectImageProvider"){
  const provider=String(body.provider||""),model=String(body.model||"").trim(),apiKey=String(body.apiKey||"").trim();
  if(provider!=="openrouter"||!model||!apiKey)return Response.json({error:"OpenRouter API Key and exact image model slug are required."},{status:400});
  const response=await fetch(`${OPENROUTER_BASE_URL}/images/models`,{headers:{authorization:`Bearer ${apiKey}`}}),result:any=await response.json().catch(()=>({})),models=Array.isArray(result?.data)?result.data:[];
  if(!response.ok)return Response.json({error:result?.error?.message||`OpenRouter returned HTTP ${response.status}.`},{status:400});
  if(!models.some((item:any)=>String(item.id)===model))return Response.json({error:`${model} is not listed by OpenRouter as an image-output model. Use the exact model slug.`},{status:400});
  await saveIntegration(env.DB,env,"image",apiKey,{provider:"openrouter",providerLabel:"OpenRouter Image API",model,baseUrl:OPENROUTER_BASE_URL},"Connected");
  return Response.json({ok:true,message:`OpenRouter · ${model} connected. Image jobs will route through the System Orchestrator.`});
 }
 if(action==="saveRunningHub"){
  const apiKey=String(body.apiKey||"").trim();
  if(!apiKey)return Response.json({error:"Enter the RunningHub API Key."},{status:400});
  const existing=await loadIntegration(env.DB,env,"runninghub");await saveIntegration(env.DB,env,"runninghub",apiKey,runningHubConfig(existing?.config),"Saved · not tested",{tested:false});
  return Response.json({ok:true,message:"RunningHub API Key saved securely. Use Test Connection to validate it."});
 }
 if(action==="testRunningHub"){
  const saved=await loadIntegration(env.DB,env,"runninghub");
  if(!saved?.secret)return Response.json({error:"Save a RunningHub API Key before testing."},{status:409});
  const tested=await testRunningHubConnection(saved.secret);
  const config=runningHubConfig(saved.config);
  await saveIntegration(env.DB,env,"runninghub",saved.secret,config,tested.status);
  if(!tested.connected)return Response.json({error:tested.httpStatus>=500?"RunningHub account status API could not be reached.":"RunningHub rejected the saved API Key.",status:"Failed"},{status:tested.httpStatus>=500?502:400});
  return Response.json({ok:true,message:"RunningHub connection verified.",status:"Connected"});
 }
 if(action==="inspectRunningHubH3"){
  try{const result=await verifyAndStoreRunningHubH3Contract(env.DB,env);return Response.json({ok:true,configured:true,inspection:inspectRunningHubH3Graph(result.graph)})}catch(error:any){return Response.json({error:String(error?.message||error),issues:error?.issues||null,fingerprint:error?.fingerprint||null},{status:Number(error?.status)||502})}
 }
 if(action==="inspectRunningHubQwenImage"){
  try{const result=await verifyAndStoreRunningHubImageContract(env.DB,env);return Response.json({ok:true,configured:true,inspection:inspectRunningHubQwenImageGraph(result.graph)})}catch(error:any){return Response.json({error:String(error?.message||error),issues:error?.issues||null,fingerprint:error?.fingerprint||null},{status:Number(error?.status)||502})}
 }
 if(action==="configureRunningHubH3"){
  return Response.json({error:"MiniMax H3 node mappings are owned by the FrameFlow Workflow Registry and cannot be edited from Tier 0 settings."},{status:409});
 }
 if(action==="configureInstagramApp"){
  const appId=String(body.appId||"").trim(),appSecret=String(body.appSecret||"").trim(),apiVersion=String(body.apiVersion||"v26.0").trim(),redirectUri=new URL("/api/instagram/callback",req.url).toString();
  if(!/^\d{6,}$/.test(appId)||!appSecret)return Response.json({error:"Enter the Instagram App ID and App Secret from Meta for Developers."},{status:400});
  if(!/^v\d+\.\d+$/.test(apiVersion))return Response.json({error:"Instagram API version must look like v26.0."},{status:400});
  const scopes=["instagram_business_basic","instagram_business_content_publish","instagram_business_manage_insights"];
  await saveIntegration(env.DB,env,"instagram-app",appSecret,{appId,apiVersion,redirectUri,scopes,loginType:"Instagram Login"},"Configured · OAuth ready");
  return Response.json({ok:true,message:"Instagram App saved securely. Register the callback URL in Meta, then connect the Creator account from Publishing Settings."});
 }
 if(action==="configureFacebookApp"){
  const appId=String(body.appId||"").trim(),appSecret=String(body.appSecret||"").trim(),apiVersion=String(body.apiVersion||"v26.0").trim(),redirectUri=new URL("/api/facebook/callback",req.url).toString();
  if(!/^\d{6,}$/.test(appId)||!appSecret)return Response.json({error:"Enter the Facebook App ID and App Secret from Meta for Developers."},{status:400});
  if(!/^v\d+\.\d+$/.test(apiVersion))return Response.json({error:"Facebook Graph API version must look like v26.0."},{status:400});
  const scopes=["pages_show_list","pages_read_engagement","pages_manage_posts","read_insights"];
  await saveIntegration(env.DB,env,"facebook-app",appSecret,{appId,apiVersion,redirectUri,scopes,loginType:"Facebook Login",targetType:"Facebook Page only",publishingEnabled:false},"Configured · OAuth ready");
  return Response.json({ok:true,message:"Facebook App saved securely. Register the callback URL in Facebook Login, then connect a Page from Project Publishing Settings."});
 }
 if(action==="configureThreadsApp"){
  const appId=String(body.appId||"").trim(),appSecret=String(body.appSecret||"").trim(),apiVersion=String(body.apiVersion||"v1.0").trim(),redirectUri=new URL("/api/threads/callback",req.url).toString();
  if(!/^\d{6,}$/.test(appId)||!appSecret)return Response.json({error:"Enter the Threads App ID and App Secret from Meta for Developers."},{status:400});
  if(!/^v\d+\.\d+$/.test(apiVersion))return Response.json({error:"Threads API version must look like v1.0."},{status:400});
  const scopes=["threads_basic","threads_content_publish","threads_manage_insights"];
  await saveIntegration(env.DB,env,"threads-app",appSecret,{appId,apiVersion,redirectUri,scopes},"Configured · OAuth ready");
  return Response.json({ok:true,message:"Threads App saved securely. Each Project can now authorize its own Threads account."});
 }
 if(action==="configureTikTokApp"){
  const clientKey=String(body.clientKey||"").trim(),clientSecret=String(body.clientSecret||"").trim(),redirectUri=new URL("/api/tiktok/callback",req.url).toString(),scopes=["user.info.basic","user.info.profile"];
  if(!/^[A-Za-z0-9_-]{6,}$/.test(clientKey)||!clientSecret)return Response.json({error:"Enter the TikTok Login Kit Client Key and Client Secret from TikTok for Developers."},{status:400});
  await saveIntegration(env.DB,env,"tiktok-app",clientSecret,{clientKey,redirectUri,scopes,connectionType:"Login Kit only",publishingEnabled:false},"Configured · OAuth ready");
  return Response.json({ok:true,message:"TikTok Login Kit saved securely. Each Project can now authorize its own TikTok Profile; TikTok publishing remains disabled."});
 }
 if(action==="configurePublishingMedia"||action==="configurePublishingScheduler")return Response.json({error:"This service is now managed automatically by FrameFlow and has no Project or owner credentials to configure."},{status:409});
 if(action==="issueAgentReadToken"){
  const agentId=String(body.agentId||""),agent=await env.DB.prepare("SELECT email,name FROM members WHERE email=? AND member_kind='agent'").bind(agentId).first<any>();
  if(!agent)return Response.json({error:"Choose a valid Tier 4 Agent profile first."},{status:400});
  const rawToken=createAgentReadToken(),tokenHash=await hashAgentToken(rawToken),now=new Date(),expires=new Date(now);expires.setUTCFullYear(expires.getUTCFullYear()+1);
  await env.DB.prepare("UPDATE agent_api_tokens SET status='Revoked',revoked_at=? WHERE agent_id=? AND status='Active' AND revoked_at IS NULL").bind(now.toISOString(),agentId).run();
  const tokenId=`aat_${crypto.randomUUID()}`;
  await env.DB.prepare("INSERT INTO agent_api_tokens(id,agent_id,token_hash,label,scopes_json,status,created_by,created_at,expires_at) VALUES(?,?,?,?,?,'Active',?,?,?)").bind(tokenId,agentId,tokenHash,`${agent.name} Scoped Memory Reader`,JSON.stringify(AGENT_READ_SCOPES),String(req.headers.get("oai-authenticated-user-email")||"system").toLowerCase(),now.toISOString(),expires.toISOString()).run();
  await env.DB.prepare("INSERT INTO audit_log(project_id,event_type,actor_email,event_data,created_at) VALUES(NULL,?,?,?,?)").bind("agent_read_token_issued",String(req.headers.get("oai-authenticated-user-email")||"system").toLowerCase(),JSON.stringify({agentId,tokenId,scope:AGENT_READ_SCOPES,expiresAt:expires.toISOString()}),now.toISOString()).run();
  return Response.json({ok:true,message:`Scoped read-only Project Memory access created for ${agent.name}. Copy the token now; it will not be shown again.`,token:rawToken,relayUrl:AGENT_PROJECTS_RELAY_URL,scopes:AGENT_READ_SCOPES,expiresAt:expires.toISOString()});
 }
 if(action==="revokeAgentReadToken"){
  const agentId=String(body.agentId||""),now=new Date().toISOString();
  await env.DB.prepare("UPDATE agent_api_tokens SET status='Revoked',revoked_at=? WHERE agent_id=? AND status='Active' AND revoked_at IS NULL").bind(now,agentId).run();
  await env.DB.prepare("INSERT INTO audit_log(project_id,event_type,actor_email,event_data,created_at) VALUES(NULL,?,?,?,?)").bind("agent_read_token_revoked",String(req.headers.get("oai-authenticated-user-email")||"system").toLowerCase(),JSON.stringify({agentId}),now).run();
  return Response.json({ok:true,message:"Agent read-only Project access revoked."});
 }
 if(action==="connectAgent"||action==="connectTelegram"){
  const agentId=String(body.agentId||MILLA_AGENT_ID),agent=await env.DB.prepare("SELECT email,name FROM members WHERE email=? AND member_kind='agent'").bind(agentId).first<any>();
  if(!agent)return Response.json({error:"Choose a valid Tier 4 Agent profile first."},{status:400});
  const token=String(body.botToken||"").trim(),botUsername=String(body.botUsername||"").trim(),chatId=String(body.chatId||"").trim();
  if(!token||!botUsername.startsWith("@")||!chatId)return Response.json({error:"Bot Token, @Bot username and allowed Chat ID are required."},{status:400});
  const meResponse=await fetch(`https://api.telegram.org/bot${token}/getMe`),me:any=await meResponse.json();
  if(!meResponse.ok||!me.ok)return Response.json({error:me.description||"Telegram Bot Token is invalid."},{status:400});
  const actual=`@${String(me.result?.username||"")}`;if(actual.toLowerCase()!==botUsername.toLowerCase())return Response.json({error:`This token belongs to ${actual||"another bot"}, not ${botUsername}.`},{status:400});
  if(chatId===String(me.result?.id||""))return Response.json({error:`${chatId} is the Bot ID, not a delivery Chat ID.`,code:"BOT_ID_USED",suggestedChatId:DEFAULT_TELEGRAM_CHAT_ID},{status:400});
  const send=await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({chat_id:chatId,text:`FrameFlow connected to ${agent.name}. The Agent is registered, but receives only tasks and permissions explicitly granted by the System Orchestrator.`})}),sent:any=await send.json();
  if(!send.ok||!sent.ok)return Response.json({error:sent.description||"Bot is valid, but FrameFlow could not send to this Chat ID. Open the bot and press Start first."},{status:400});
  const config={botUsername,chatId,agentId,language:"Bilingual",inboundMode:agentId===MILLA_AGENT_ID?"relay_optional":"outbound_only"};
  await saveIntegration(env.DB,env,agentConnectionKey(agentId),token,config,"Outbound connected");
  if(agentId===MILLA_AGENT_ID)await saveIntegration(env.DB,env,"telegram",token,{...config,stopPhase:"content-production"},"Outbound connected");
  await env.DB.prepare("UPDATE members SET telegram_status=?,status=?,telegram_username=?,telegram_chat_id=? WHERE email=?").bind("Outbound connected","Agent profile connected",botUsername,chatId,agentId).run();
  return Response.json({ok:true,message:`${agent.name} connected through its own Telegram Bot credential.`});
 }
 if(action==="connectTelegramLogin"){
  const clientId=String(body.clientId||"").trim(),clientSecret=String(body.clientSecret||"").trim(),redirectUri=new URL("/api/telegram-login/callback",req.url).toString();
  if(!clientId||!clientSecret)return Response.json({error:"Telegram Login Client ID and Client Secret are required."},{status:400});
  await saveIntegration(env.DB,env,"telegram-login",clientSecret,{clientId,redirectUri,issuer:"https://oauth.telegram.org",scope:"openid profile"},"Configured · identity only");
  return Response.json({ok:true,message:"Telegram Login identity provider saved. Register the displayed callback URL in BotFather before testing."});
 }
 if(action==="activateAgentRelay"){
  const agentId=String(body.agentId||MILLA_AGENT_ID);if(agentId!==MILLA_AGENT_ID)return Response.json({error:"Additional Agent command scopes are intentionally not designed yet. Only Agent Relay can be activated."},{status:409});
  const telegram=await loadIntegration(env.DB,env,agentConnectionKey(agentId))||await loadIntegration(env.DB,env,"telegram");if(!telegram?.secret)return Response.json({error:"Connect Agent's Telegram Bot first."},{status:409});
  try{const health=await fetch(AGENT_RELAY_URL.replace("/telegram","/health"));if(!health.ok)throw new Error("Relay unavailable")}catch{return Response.json({error:"The public Relay deployment is not ready. Agent can still start work from FrameFlow."},{status:503})}
  const relaySecret=crypto.randomUUID().replaceAll("-",""),webhook=await fetch(`https://api.telegram.org/bot${telegram.secret}/setWebhook`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({url:AGENT_RELAY_URL,secret_token:relaySecret,allowed_updates:["message","edited_message"],drop_pending_updates:true})}),result:any=await webhook.json();
  if(!webhook.ok||!result.ok)return Response.json({error:result.description||"Telegram could not activate the Agent Relay."},{status:400});
  const config={relayUrl:AGENT_RELAY_URL,agentId,scope:["Internal Social Account","Client Social Account"],stopPhase:"content-production"};
  await saveIntegration(env.DB,env,agentRelayKey(agentId),relaySecret,config,"Public relay active");
  await saveIntegration(env.DB,env,"agent-relay",relaySecret,config,"Public relay active");
  await env.DB.prepare("UPDATE members SET telegram_status=?,status=? WHERE email=?").bind("Agent Runner active","Agent Runner active",agentId).run();
  return Response.json({ok:true,message:"Agent Agent Relay activated."});
 }
 return Response.json({error:"Unknown integration action"},{status:400});
}
