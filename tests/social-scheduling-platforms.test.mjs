import test from"node:test";
import assert from"node:assert/strict";
import{AUTO_PUBLISH_PLATFORMS,SOCIAL_SCHEDULE_PLATFORMS,canonicalSocialPlatform,configuredSchedulePlatforms,isAutomaticPublishingPlatform,platformAllowedForContent,resolvePlannedBatchItem}from"../app/social-scheduling-platforms.ts";

test("Two-week Batch scheduling exposes the four Project destinations",()=>{
 assert.deepEqual(SOCIAL_SCHEDULE_PLATFORMS,["Instagram","Threads","TikTok","Facebook Page"]);
 assert.deepEqual(configuredSchedulePlatforms([]),["Instagram","Threads","TikTok","Facebook Page"]);
 assert.deepEqual(configuredSchedulePlatforms(["Instagram","Facebook"]),["Instagram","Facebook Page"]);
 assert.equal(canonicalSocialPlatform("facebook"),"Facebook Page");
});

test("TikTok scheduling is available only for Reel content",()=>{
 assert.equal(platformAllowedForContent("TikTok","Reel"),true);
 assert.equal(platformAllowedForContent("TikTok","Photo"),false);
 assert.equal(platformAllowedForContent("TikTok","Carousel"),false);
 assert.equal(platformAllowedForContent("Instagram","Photo"),true);
 assert.equal(platformAllowedForContent("Facebook Page","Photo"),true);
});

test("schedule destinations do not imply an implemented publishing connector",()=>{
 assert.deepEqual(AUTO_PUBLISH_PLATFORMS,["Instagram","Threads"]);
 assert.equal(isAutomaticPublishingPlatform("Instagram"),true);
 assert.equal(isAutomaticPublishingPlatform("Threads"),true);
 assert.equal(isAutomaticPublishingPlatform("TikTok"),false);
 assert.equal(isAutomaticPublishingPlatform("Facebook Page"),false);
});

test("approved Content matches Batch plans by id, publishing order, then stable index",()=>{
 const items=[{title:"First",publishing_order:1},{id:"content_2",title:"Second"},{title:"Third"}];
 assert.equal(resolvePlannedBatchItem(items,"content_2",1).title,"Second");
 assert.equal(resolvePlannedBatchItem(items,"content_1",0).title,"First");
 assert.equal(resolvePlannedBatchItem(items,"content_3",2).title,"Third");
});
