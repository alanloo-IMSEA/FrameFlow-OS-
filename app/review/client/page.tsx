"use client";
import {useEffect,useMemo,useState} from "react";
import LanguageSwitch from "../../language-switch";
import "./client-review.css";
import "./compact-review.css";

export default function ClientReview(){
 const [token,setToken]=useState("");
 const [data,setData]=useState<any>(null);
 const [error,setError]=useState("");
 const [decisions,setDecisions]=useState<Record<string,any>>({});
 const [sent,setSent]=useState("");
 useEffect(()=>{
  const t=new URLSearchParams(location.search).get("token")||"";
  setToken(t);
  fetch(`/api/external-review?token=${encodeURIComponent(t)}`).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);setData(d)}).catch(e=>setError(e.message));
 },[]);
 const pending=data?.items?.filter((x:any)=>!x.locked)||[];
 const ready=useMemo(()=>pending.every((x:any)=>decisions[x.id]?.decision&&(decisions[x.id].decision!=="reject"||decisions[x.id].comment?.trim())),[pending,decisions]);
 async function submit(){
  const r=await fetch("/api/external-review",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token,decisions:Object.entries(decisions).map(([id,d]:any)=>({id,...d}))})});
  const d=await r.json();if(!r.ok){setError(d.error);return}setSent(d.result);
 }
 if(error)return <State eyebrow="FRAMEFLOW CLIENT REVIEW" title="Review unavailable" copy={error}/>;
 if(!data)return <State eyebrow="FRAMEFLOW CLIENT REVIEW" title="Loading review…"/>;
 if(sent)return <State eyebrow="REVIEW SUBMITTED" title={sent==="Approved"?"Thank you — all approved.":"Feedback received."} copy={sent==="Approved"?"The production team may now begin the next phase.":"The production team will revise only the returned items."}/>;
 return <main className="external-review-sample compact-client-review"><div className="standalone-language"><LanguageSwitch/></div>
  <header className="review-header"><div className="review-brand"><span>F</span><b>FrameFlow Review</b></div><div className="review-window"><i/>{data.status} · expires {new Date(data.expiresAt).toLocaleDateString()}</div></header>
  <section className="review-intro"><p>CLIENT APPROVAL · {data.projectId}</p><h1 data-i18n-ignore>{data.project}</h1><span>{data.phase} passed internal approval. Previously approved topics stay locked; review only the returned topics below.</span><div><b>{data.items.length} Topics</b><b>{data.lockedCount||0} Locked ✓</b><b>{pending.length} Need Review</b></div></section>
  <section className="review-list">{data.items.map((item:any)=><ReviewItem key={item.id} item={item} phase={data.phase} choice={decisions[item.id]} decide={(decision:string,comment="")=>setDecisions(x=>({...x,[item.id]:{decision,comment}}))}/>)}</section>
  <footer className="review-submit"><div><b>{ready?"Ready to submit":`Review ${pending.length} open topic${pending.length===1?"":"s"}`}</b><span>Locked approvals are carried forward automatically.</span></div><button disabled={!ready||data.status!=="Active"} onClick={submit}>Submit Review</button></footer>
 </main>
}

function ReviewItem({item,phase,choice,decide}:{item:any;phase:string;choice:any;decide:(decision:string,comment?:string)=>void}){
 return <article className={`review-content text-review ${item.locked?"locked-approved":choice?.decision||""}`}><div className="review-copy">
  <header><span>{item.locked?"✓":String(item.number).padStart(2,"0")}</span><div><small>{phase}</small><h2 data-i18n-ignore>{item.label}</h2></div></header>
  <section>{item.kind==="image"?<div className="client-keyshot-images">{item.images?.length?item.images.map((image:any)=><a key={`${image.fileName}-${image.version}`} href={image.url} target="_blank" rel="noreferrer"><img src={image.url} alt={`${item.label} ${image.fileName}`}/><span data-i18n-ignore>{image.fileName} · v{image.version}</span></a>):<p className="missing-client-image">No review image was uploaded.</p>}</div>:<p data-i18n-ignore>{item.content}</p>}</section>
  {item.previousDecision==="reject"&&item.previousComment&&<div className="previous-feedback"><b>Previous review comment</b><p data-i18n-ignore>{item.previousComment}</p></div>}
  {item.locked?<div className="locked-decision"><b>✓ Approved in an earlier review</b><span>This topic is locked. It remains visible but does not need approval again.</span></div>:<div className="client-decision"><b>Your decision</b><div><button className={choice?.decision==="approve"?"selected":""} onClick={()=>decide("approve")}>✓ Approve</button><button className={choice?.decision==="reject"?"selected":""} onClick={()=>decide("reject",choice?.comment||"")}>× Request change</button></div>{choice?.decision==="reject"&&<label className="reject-comment">Required comment<textarea value={choice?.comment||""} onChange={e=>decide("reject",e.target.value)} placeholder="Tell the team exactly what should change…"/></label>}</div>}
 </div></article>
}

function State({eyebrow,title,copy}:{eyebrow:string;title:string;copy?:string}){return <main className="external-review-sample compact-client-review"><div className="standalone-language"><LanguageSwitch/></div><section className="review-intro"><p>{eyebrow}</p><h1>{title}</h1>{copy&&<span>{copy}</span>}</section></main>}
