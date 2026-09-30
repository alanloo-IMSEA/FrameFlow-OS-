export type ImageProviderFailureDecision={
 retry:boolean;
 retryDelayMs:number;
 nextStatus:"RETRY_PENDING"|"FAILED";
};

export function imageProviderFailureDecision(status:number,attemptCount:number,maxAttempts:number):ImageProviderFailureDecision{
 return{
  retry:false,
  retryDelayMs:0,
  nextStatus:"FAILED",
 };
}
