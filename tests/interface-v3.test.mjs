import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const css = await readFile(new URL("../app/interface-v3.css", import.meta.url), "utf8");
const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const languageSwitch = await readFile(new URL("../app/language-switch.tsx", import.meta.url), "utf8");
const clientReview = await readFile(new URL("../app/review/client/page.tsx", import.meta.url), "utf8");
const telegramLogin = await readFile(new URL("../app/telegram-login/page.tsx", import.meta.url), "utf8");

test("the final stylesheet owns the interface cascade", () => {
  const imports = [...layout.matchAll(/import\s+"\.\/(.+?\.css)";/g)].map((match) => match[1]);
  assert.equal(imports.at(-1), "interface-v3.css");
});

test("desktop controls and navigation meet the minimum interaction size", () => {
  assert.match(css, /\.nav-list button\s*\{[\s\S]*?min-height:\s*46px/);
  assert.match(css, /\.top-actions \.search\s*\{[\s\S]*?min-height:\s*44px/);
  assert.match(css, /\.create-btn,[\s\S]*?min-height:\s*44px/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /\.welcome\s*\{[\s\S]*?background:\s*transparent/);
  assert.match(css, /\.welcome\s*\{[\s\S]*?box-shadow:\s*none/);
});

test("mobile layout uses scrollable navigation and readable form controls", () => {
  const mobile = css.slice(css.indexOf("@media (max-width: 760px)"));
  assert.match(mobile, /\.nav-list\s*\{[\s\S]*?overflow-x:\s*auto/);
  assert.match(mobile, /\.nav-list button\s*\{[\s\S]*?min-height:\s*64px/);
  assert.match(mobile, /\.field input,[\s\S]*?font-size:\s*16px/);
  assert.match(mobile, /env\(safe-area-inset-bottom\)/);
  assert.doesNotMatch(mobile, /grid-template-columns:\s*repeat\(6/);
});

test("feedback notices stay bounded, dismissible, and cannot stretch between top and bottom", () => {
  const correction = css.slice(css.indexOf("v4 usability correction"));
  assert.match(correction, /\.toast\s*\{[\s\S]*?top:\s*auto\s*!important/);
  assert.match(correction, /\.toast\s*\{[\s\S]*?max-height:\s*180px/);
  assert.match(page, /aria-label="Dismiss notification"/);
  assert.match(page, /window\.setTimeout\(\(\)\s*=>\s*setNotice\(""\),\s*6500\)/);
});

test("desktop navigation can collapse and remembers the user's choice", () => {
  assert.match(css, /\.sidebar-collapsed \.sidebar\s*\{\s*width:\s*76px/);
  assert.match(css, /\.sidebar-collapsed \.workspace\s*\{\s*margin-left:\s*76px/);
  assert.match(page, /aria-label=\{[\s\S]*?sidebarCollapsed\s*\?\s*"Expand navigation"\s*:\s*"Collapse navigation"[\s\S]*?\}/);
  assert.match(page, /frameflow:sidebar-collapsed/);
});

test("the top bar offers a persistent English and Chinese interface switch", () => {
  assert.match(page, /<LanguageSwitch\s*\/>/);
  assert.match(languageSwitch, /frameflow:language/);
  assert.match(languageSwitch, /localStorage\.setItem\(STORAGE_KEY, language\)/);
  assert.match(languageSwitch, />\s*EN\s*</);
  assert.match(languageSwitch, />\s*中文\s*</);
  assert.match(languageSwitch, /document\.documentElement\.lang = language === "zh" \? "zh-CN" : "en"/);
  assert.match(languageSwitch, /"Client Brief": "客户简报"/);
  assert.match(languageSwitch, /"Waiting for Management Review": "等待管理层审核"/);
  assert.match(languageSwitch, /"Human Workload": "团队工作量"/);
  assert.match(languageSwitch, /"Project Calendar": "项目日历"/);
  assert.match(languageSwitch, /"Reel Video Production": "短视频制作"/);
  assert.match(languageSwitch, /"Save Reel Setup": "保存短视频设置"/);
  assert.match(languageSwitch, /"Sync records & uploads": "同步记录与上传文件"/);
  assert.match(languageSwitch, /\.reel-prompt-review header b/);
  assert.match(languageSwitch, /\.production-content-card > summary p/);
  assert.match(languageSwitch, /"\[data-i18n-ignore\]"/);
  assert.match(css, /\.language-switch\s*\{[\s\S]*?min-height:\s*44px/);
});

test("standalone client review and Telegram identity pages also support Chinese", () => {
  assert.match(clientReview, /import LanguageSwitch/);
  assert.match(clientReview, /<LanguageSwitch\/>/);
  assert.match(clientReview, /data-i18n-ignore>\{item\.content\}/);
  assert.match(telegramLogin, /import LanguageSwitch/);
  assert.match(telegramLogin, /<LanguageSwitch\/>/);
  assert.match(languageSwitch, /"FRAMEFLOW CLIENT REVIEW": "FRAMEFLOW 客户审核"/);
  assert.match(languageSwitch, /"Telegram login verified": "Telegram 登录已验证"/);
  assert.match(css, /\.standalone-language\s*\{/);
});
