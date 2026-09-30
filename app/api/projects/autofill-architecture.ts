import{activeFormulaFor}from"../../formula-library";
export{buildGenerationContext}from"../memory/service";

// Schema ownership is migration-only. Kept as a compatibility hook for existing callers.
export async function ensureAutofillArchitecture(_db:any){return}

export async function saveApprovedSnapshot(db:any,input:{projectId:string;phaseKey:string;phaseLabel:string;content:any;approvedBy:string;generationMethod?:string;formulaId?:string;formulaVersion?:string}){
 const project=await db.prepare("SELECT project_type_code AS projectType,is_demo AS isDemo FROM projects WHERE id=?").bind(input.projectId).first<any>(),latest=await db.prepare("SELECT MAX(version) AS version FROM approved_phase_snapshots WHERE project_id=? AND phase_key=?").bind(input.projectId,input.phaseKey).first<any>(),version=Number(latest?.version||0)+1,formula=input.formulaId?null:activeFormulaFor(input.phaseKey,project?.projectType),demo=Number(project?.isDemo??0),now=new Date().toISOString();
 const generationMethod=input.generationMethod||input.content?._generationMethod||"Manual",content={...(input.content||{})},original=input.content?._originalGeneratedDraft||null;delete content._originalGeneratedDraft;delete content._generationMethod;delete content._formulaId;delete content._formulaVersion;
 if(input.phaseKey==="content-production"){
  const requestedBatchId=Number(content._productionBatchId)||0,requestedBatch=requestedBatchId?await db.prepare("SELECT id FROM production_batches WHERE project_id=? AND id=?").bind(input.projectId,requestedBatchId).first<any>():null,batch=requestedBatch||await db.prepare("SELECT id FROM production_batches WHERE project_id=? ORDER BY CASE WHEN status='Planning' THEN 0 WHEN status='Active' THEN 1 ELSE 2 END,batch_number DESC LIMIT 1").bind(input.projectId).first<any>(),batchId=Number(batch?.id)||0;
  if(batchId){
   content._productionBatchId=batchId;
   for(const item of Array.isArray(content.production_items)?content.production_items:[]){
    const contentId=String(item.contentId||item.content_id||""),anchor=(Array.isArray(item.assets)?item.assets:[]).find((asset:any)=>Number(asset.assetNumber||asset.asset_number||1)===1);
    if(!contentId||!anchor)continue;
    const itemKey=`batch-${batchId}-${contentId}-asset-1`,current=await db.prepare("SELECT id,item_key AS itemKey,file_name AS fileName,version FROM visual_asset_revisions WHERE project_id=? AND phase='content-production' AND item_key=? AND is_current=1 AND mime_type LIKE 'image/%' ORDER BY version DESC,id DESC LIMIT 1").bind(input.projectId,itemKey).first<any>();
    if(current)anchor.visualPrompt={...(anchor.visualPrompt||{}),approvedAnchorImage:{id:Number(current.id),itemKey:current.itemKey,fileName:current.fileName,version:Number(current.version||1),approvedAt:now}};
   }
  }
 }
 await db.prepare("INSERT INTO approved_phase_snapshots(project_id,project_type,phase_key,phase_label,version,approved_content,approved_by,approved_at,formula_id,formula_version,generation_method,demo_data,learning_status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(input.projectId,project?.projectType||"Unknown",input.phaseKey,input.phaseLabel,version,JSON.stringify(content),input.approvedBy,now,input.formulaId||formula?.id||null,input.formulaVersion||formula?.version||null,generationMethod,demo,"Not Applicable").run();
 await db.prepare("INSERT INTO phase_generation_records(project_id,project_type,phase_key,formula_id,formula_version,generation_method,original_generated_draft,human_edited_version,final_approved_version,changed_fields,created_at,edited_at,approved_at,review_result,demo_data,learning_status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(input.projectId,project?.projectType||"Unknown",input.phaseKey,input.formulaId||formula?.id||null,input.formulaVersion||formula?.version||null,generationMethod,original?JSON.stringify(original):null,JSON.stringify(content),JSON.stringify(content),JSON.stringify(original?changed(original,content):[]),now,now,now,"Approved",demo,"Pending Review").run();
 return version;
}

function changed(a:any,b:any){return Array.from(new Set([...Object.keys(a||{}),...Object.keys(b||{})])).filter(k=>JSON.stringify(a?.[k])!==JSON.stringify(b?.[k]))}
