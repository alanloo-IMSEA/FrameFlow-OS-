import test from"node:test";
import assert from"node:assert/strict";
import{readFileSync}from"node:fs";
import{FACEBOOK_SCOPES,decodeState,encodeState,parseSelectionSecret,projectRedirect,selectionSecret}from"../app/api/facebook/state.ts";

test("Facebook OAuth state preserves Project and reconnect bindings",()=>{
 const source={state:"csrf_456",projectId:"PRJ-0042",connectionId:"social_fb_2"};
 assert.deepEqual(decodeState(encodeState(source)),source);
});

test("Facebook Page OAuth requests only the approved Phase 1 scopes",()=>{
 assert.deepEqual(FACEBOOK_SCOPES,["pages_show_list","pages_read_engagement","pages_manage_posts","read_insights"]);
 assert.equal(FACEBOOK_SCOPES.includes("business_management"),false);
 assert.equal(FACEBOOK_SCOPES.includes("pages_read_user_content"),false);
});

test("multiple Page selection preserves the encrypted server-side candidates",()=>{
 const pages=[{id:"101",name:"Main Page",link:"https://www.facebook.com/101",category:"Brand",tasks:["CREATE_CONTENT"],accessToken:"page-token-101"},{id:"202",name:"Second Page",link:"https://www.facebook.com/202",category:"Community",tasks:["ANALYZE"],accessToken:"page-token-202"}];
 assert.deepEqual(parseSelectionSecret(selectionSecret(pages)),{pages});
});

test("Facebook OAuth returns to the bound Project Publishing phase",()=>{
 const url=new URL(projectRedirect(new Request("https://frameflow.example/api/facebook/callback"),"PRJ-0042","connected"));
 assert.equal(url.origin,"https://frameflow.example");
 assert.equal(url.searchParams.get("projectId"),"PRJ-0042");
 assert.equal(url.searchParams.get("phase"),"publishing");
 assert.equal(url.searchParams.get("facebook"),"connected");
});

test("Project-facing Social Connection serializer never includes credential fields",()=>{
 const source=readFileSync(new URL("../app/api/social-connections/_lib.ts",import.meta.url),"utf8");
 const serializer=source.match(/export function publicConnection[\s\S]*?\n}/)?.[0]||"";
 assert.match(serializer,/socialConnectionId:/);
 assert.doesNotMatch(serializer,/token:/);
 assert.doesNotMatch(serializer,/providerKey:/);
 assert.doesNotMatch(serializer,/tokenConfig:/);
});
