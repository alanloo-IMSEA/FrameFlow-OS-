import test from"node:test";
import assert from"node:assert/strict";
import{TIKTOK_SCOPES,credentialSecret,decodeState,encodeState,parseCredentialSecret,projectRedirect}from"../app/api/tiktok/state.ts";

test("TikTok OAuth state preserves the Project binding",()=>{
 const source={state:"csrf_123",projectId:"PRJ-0099",connectionId:"social_4"};
 assert.deepEqual(decodeState(encodeState(source)),source);
});

test("TikTok credentials keep access and refresh tokens in one encrypted secret payload",()=>{
 assert.deepEqual(parseCredentialSecret(credentialSecret("access-token","refresh-token")),{accessToken:"access-token",refreshToken:"refresh-token"});
});

test("TikTok Login Kit requests identity scopes only",()=>{
 assert.deepEqual(TIKTOK_SCOPES,["user.info.basic","user.info.profile"]);
});

test("TikTok OAuth returns to the bound Project Publishing phase",()=>{
 const url=new URL(projectRedirect(new Request("https://frameflow.example/api/tiktok/callback"),"PRJ-0099","connected"));
 assert.equal(url.origin,"https://frameflow.example");
 assert.equal(url.searchParams.get("projectId"),"PRJ-0099");
 assert.equal(url.searchParams.get("phase"),"publishing");
 assert.equal(url.searchParams.get("tiktok"),"connected");
});
