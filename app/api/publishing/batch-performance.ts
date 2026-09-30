export const BATCH_METRIC_KEYS=["views","reach","likes","comments","shares","saves","engagement"] as const;

export type BatchMetricTotals=Record<(typeof BATCH_METRIC_KEYS)[number],number>;

export function metricObject(value:any):BatchMetricTotals{
 const source=typeof value==="string"?safeParse(value):value||{},totals={} as BatchMetricTotals;
 for(const key of BATCH_METRIC_KEYS)totals[key]=Number(source?.[key]||0);
 return totals;
}

function safeParse(value:string){try{return JSON.parse(value||"{}")}catch{return{}}}

export function sumBatchMetrics(records:any[]):BatchMetricTotals{
 const totals=metricObject({});
 for(const record of records){const metrics=metricObject(record.metrics??record.normalizedMetrics);for(const key of BATCH_METRIC_KEYS)totals[key]+=metrics[key]}
 return totals;
}

export function performanceScore(record:any){const metrics=metricObject(record.metrics??record.normalizedMetrics);return metrics.engagement+metrics.saves*2+metrics.shares*2}

export function rankBatchContent(records:any[],limit=3){return records.filter(record=>record.status==="PUBLISHED").map(record=>({...record,metrics:metricObject(record.metrics??record.normalizedMetrics),performanceScore:performanceScore(record)})).sort((a,b)=>b.performanceScore-a.performanceScore||Number(b.metrics.views||b.metrics.reach)-Number(a.metrics.views||a.metrics.reach)).slice(0,limit)}

export function buildBatchTrend(snapshots:any[]){
 const ordered=snapshots.filter(row=>row.publishingRecordId!=null&&Number.isFinite(Date.parse(String(row.capturedAt||"")))).slice().sort((a,b)=>Date.parse(a.capturedAt)-Date.parse(b.capturedAt)),latestByRecord=new Map<string,any>(),points:any[]=[];
 let day="";
 const flush=()=>{if(!day)return;points.push({capturedAt:day,...sumBatchMetrics([...latestByRecord.values()])})};
 for(const row of ordered){const nextDay=String(row.capturedAt).slice(0,10);if(day&&nextDay!==day)flush();day=nextDay;latestByRecord.set(String(row.publishingRecordId),{metrics:row.metrics??row.normalizedMetrics})}
 flush();return points.slice(-14);
}

export function compareBatchTotals(current:BatchMetricTotals,previous:BatchMetricTotals|null){const comparison:any={};for(const key of BATCH_METRIC_KEYS){const currentValue=current[key],previousValue=previous?.[key]??null;comparison[key]={current:currentValue,previous:previousValue,delta:previousValue===null?null:currentValue-previousValue,percent:previousValue===null||previousValue===0?null:Math.round(((currentValue-previousValue)/previousValue)*1000)/10}}return comparison}

export function batchDataMaturity(records:any[],now=Date.now()){
 const published=records.filter(record=>record.status==="PUBLISHED"&&Number.isFinite(Date.parse(String(record.publishedAt||"")))),synced=published.filter(record=>record.performanceSyncStatus==="SYNCED"),ages=synced.map(record=>Math.max(0,(now-Date.parse(record.publishedAt))/3_600_000)),count=(hours:number)=>ages.filter(age=>age>=hours).length;
 let code="NO_PUBLISHED_DATA",label="Waiting for first publish",description="No post in this Batch has been published yet.";
 if(published.length&&!synced.length){code="AWAITING_SYNC";label="Awaiting verified data";description="Published outcomes exist, but provider Performance has not synced yet."}
 else if(synced.length){const oldest=Math.max(...ages);if(oldest<24){code="EARLY";label="Early · under 24h";description="Use for observation only; do not treat early movement as a stable rule."}else if(oldest<72){code="EMERGING";label="Emerging · 24–72h";description="Directional signals are forming, but the sample is still young."}else if(oldest<168){code="DIRECTIONAL";label="Directional · 3–7d";description="Useful for controlled next-Batch tests, with caution."}else if(oldest<336){code="STABILIZING";label="Stabilizing · 7–14d";description="Most short-term engagement patterns are becoming comparable."}else{code="MATURE";label="Mature · 14d+";description="The Batch has at least one complete 14-day measurement window."}}
 return{code,label,description,totalRecords:records.length,publishedRecords:published.length,syncedRecords:synced.length,windows:{h24:count(24),h72:count(72),d7:count(168),d14:count(336)}};
}

export function selectCurrentBatch(batches:any[]){const ordered=batches.slice().sort((a,b)=>Number(a.batchNumber)-Number(b.batchNumber));return ordered.find(batch=>batch.status==="Active")||ordered.find(batch=>batch.status!=="Completed")||ordered.at(-1)||null}
