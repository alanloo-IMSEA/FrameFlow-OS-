import{owner}from"../_lib";
import{syncAllProjects}from"../drive";
export async function POST(req:Request){if(!owner(req))return Response.json({error:"Owner access required"},{status:403});try{const results=await syncAllProjects(),failed=results.filter(x=>!x.ok);return Response.json({ok:!failed.length,results,failed:failed.length})}catch(error){console.error("Drive sync pass failed",error);return Response.json({error:"Drive sync could not finish. Retry the remaining items; saved files are preserved."},{status:502})}}
