export type GenerationMethod="Manual"|"Rule-based Autofill"|"LLM Autofill"|"Imported";
export type StructuredGenerationRequest={formulaId:string;formulaVersion:string;projectId:string;projectType:string;phase:string;approvedContext:Record<string,unknown>;learningContext?:unknown[]};
export type StructuredGenerationResult={method:GenerationMethod;status:"Complete"|"Incomplete Generation";output:Record<string,unknown>;missingFields:string[];provider?:string;model?:string};
export interface FrameFlowLLMProvider{generate(request:StructuredGenerationRequest):Promise<StructuredGenerationResult>}
export class LLMNotConnectedProvider implements FrameFlowLLMProvider{async generate():Promise<StructuredGenerationResult>{throw new Error("LLM_NOT_CONNECTED")}}
