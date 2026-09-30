export const FRAMEFLOW_IMAGE_REFERENCE_LIMIT=2 as const;

const category=(asset:any)=>String(asset?.itemKey||"").replace(/-reference$/i,"");
const name=(asset:any)=>String(asset?.fileName||"");
const byVersion=(a:any,b:any)=>Number(a?.version||0)-Number(b?.version||0)||Number(a?.id||0)-Number(b?.id||0);
const bodyName=/(full[ _-]?body|body[ _-]?diagram|turnaround|character[ _-]?sheet|model[ _-]?sheet|全身|设定图)/i;
const faceName=/(face|facial|head[ _-]?shot|portrait|identity|脸|面部|五官)/i;

export const BODY_DIAGRAM_USE={
 role:"Full-body character diagram",
 use:"preserve the approved full-body proportions, silhouette, body shape, character design and wardrobe facts",
 avoid:"do not copy the diagram layout, labels, repeated views, neutral sheet pose, crop or background",
};
export const FACE_IDENTITY_USE={
 role:"Facial identity reference",
 use:"preserve the exact same face, facial geometry, eyes, brows, nose, lips, skin tone, hairline and defining identity traits",
 avoid:"do not copy the reference crop, expression, pose, lighting, wardrobe or background",
};
export const APPROVED_ANCHOR_USE={
 role:"Approved first Content Anchor",
 use:"preserve the approved subject continuity, wardrobe, scene, materials and other locked visual facts visible in the approved first image",
 avoid:"do not blindly copy its camera angle or pose when the current shot direction requires a different view",
};

export function characterReferencePair(references:any[]){
 const rows=references.filter(asset=>category(asset)==="character").sort(byVersion);
 if(rows.length<2)return null;
 const body=rows.find(asset=>bodyName.test(name(asset)))||rows[0];
 const face=rows.find(asset=>asset!==body&&faceName.test(name(asset)))||[...rows].reverse().find(asset=>asset!==body);
 return face?{body,face}:null;
}

export function selectFrameFlowImageReferences(input:{references:any[];referenceTypes:string[];continuityWithFirstImage:boolean;approvedAnchor?:any}){
 const pair=input.referenceTypes.includes("character")?characterReferencePair(input.references):null;
 if(pair&&!input.continuityWithFirstImage)return[
  {...pair.body,referenceRole:"character-full-body-diagram",referenceUse:BODY_DIAGRAM_USE},
  {...pair.face,referenceRole:"character-face-identity",referenceUse:FACE_IDENTITY_USE},
 ];
 if(pair&&input.continuityWithFirstImage&&input.approvedAnchor)return[
  {...pair.face,referenceRole:"character-face-identity",referenceUse:FACE_IDENTITY_USE},
  {...input.approvedAnchor,referenceRole:"approved-first-image",referenceUse:APPROVED_ANCHOR_USE},
 ];
 const selected=input.referenceTypes.map(type=>input.references.find(asset=>category(asset)===type)).filter(Boolean);
 if(input.continuityWithFirstImage&&input.approvedAnchor)return[
  ...selected.slice(0,1).map((asset:any)=>({...asset,referenceRole:category(asset)})),
  {...input.approvedAnchor,referenceRole:"approved-first-image",referenceUse:APPROVED_ANCHOR_USE},
 ];
 return selected.slice(0,FRAMEFLOW_IMAGE_REFERENCE_LIMIT).map((asset:any)=>({...asset,referenceRole:category(asset)}));
}
