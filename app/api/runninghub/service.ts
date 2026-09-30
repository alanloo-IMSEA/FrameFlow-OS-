export const RUNNINGHUB_BASE_URL="https://www.runninghub.ai";
export const RUNNINGHUB_ACCOUNT_STATUS_PATH="/uc/openapi/accountStatus";

export type RunningHubConnectionResult={connected:boolean;status:"Connected"|"Failed";httpStatus:number;message:string};

export async function testRunningHubConnection(apiKey:string,request:typeof fetch=fetch):Promise<RunningHubConnectionResult>{
 const key=String(apiKey||"").trim();
 if(!key)return{connected:false,status:"Failed",httpStatus:400,message:"RunningHub API Key is missing."};
 try{
  const response=await request(`${RUNNINGHUB_BASE_URL}${RUNNINGHUB_ACCOUNT_STATUS_PATH}`,{method:"POST",headers:{authorization:`Bearer ${key}`,"content-type":"application/json","cache-control":"no-store"},body:JSON.stringify({apikey:key})});
  const result:any=await response.json().catch(()=>({}));
  if(response.ok&&Number(result?.code)===0)return{connected:true,status:"Connected",httpStatus:response.status,message:"RunningHub API Key is valid."};
  return{connected:false,status:"Failed",httpStatus:response.status,message:String(result?.msg||result?.message||"RunningHub rejected this API Key.")};
 }catch{
  return{connected:false,status:"Failed",httpStatus:503,message:"RunningHub account status API could not be reached."};
 }
}
