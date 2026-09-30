INSERT INTO `members` (`email`,`name`,`tier`,`status`,`created_at`) VALUES
('alex.demo@imarketing.test','Alex Tan · Demo Project Manager',1,'Active','2026-08-15T00:59:00Z'),
('maya.demo@imarketing.test','Maya Chen · Demo Social Creator',2,'Active','2026-08-15T01:00:00Z'),
('daniel.demo@imarketing.test','Daniel Wong · Demo Story Writer',3,'Active','2026-08-15T01:01:00Z'),
('nova.demo@imarketing.test','Nova AI · Demo Production Worker',4,'Active','2026-08-15T01:02:00Z')
ON CONFLICT(`email`) DO UPDATE SET `name`=excluded.`name`,`tier`=excluded.`tier`,`status`='Active';--> statement-breakpoint

UPDATE `projects` SET
`project_nature`='recurring',`frequency_count`=3,`frequency_unit`='week',`recurring`='3 times / week',
`project_start_date`='2026-08-17',`project_end_date`='2026-11-30',
`brief_owner`='Hana Lim',`client_name`='Hana Personal Brand',
`brand_overview`='A polished lifestyle and creator brand focused on fashion, travel, beauty and authentic everyday moments.',
`project_goal`='Build a consistent social presence with three memorable posts each week while maintaining a two-week approved content buffer.',
`audience`='Women and lifestyle audiences aged 20–38 in Malaysia and Southeast Asia who enjoy fashion, travel and aspirational but natural content.',
`deliverables`='3 posts per week. Mixed photo posts, carousel posts and short Reels. Each idea includes story, caption, hashtags and publish date.',
`key_message`='Confident, stylish and real. Everyday moments can still feel cinematic and personal.',
`tone`='Warm, feminine, polished, candid and premium without looking overly staged.',
`due_date`='2026-11-30',`restrictions`='Keep Hana identity consistent. Avoid plastic skin, generic influencer poses, excessive branding and repetitive concepts.',
`brief_status`='Complete',`brief_version`=1,
`market_snapshot`='Lifestyle audiences respond strongly to recognizable personal identity, repeatable content pillars and authentic visual moments. Consistency matters more than isolated viral posts.',
`market_opportunities`='Own a recognizable mix of polished fashion, playful everyday life and Southeast Asian travel moments. Use recurring formats so followers know what to expect.',
`market_direction`='Position Hana as an approachable premium lifestyle creator with a consistent face, color language and personal point of view.',
`market_references`='[{"url":"https://www.instagram.com/","note":"Reference platform for carousel pacing and caption structure"},{"url":"https://www.tiktok.com/","note":"Reference platform for short lifestyle story hooks"}]',
`trend_observations`='Photo dumps, first-person mini stories, understated luxury styling, behind-the-scenes moments and short Reels with one simple emotional beat are performing well.',
`trend_fit`='These formats support frequent production without making every post feel like a full commercial. They also preserve Hana personality and consistency.',
`trend_references`='[{"url":"https://www.instagram.com/","note":"Photo dump and lifestyle storytelling reference"},{"url":"https://www.tiktok.com/","note":"Short-form hook and movement reference"}]',
`creative_concept`='Cinematic Everyday Hana: small real-life moments presented with a refined visual eye and a clear personal story.',
`creative_objective`='Make the audience feel close to Hana while reinforcing her confident, stylish and playful identity.',
`content_pillars`='1. Fashion and styling. 2. Travel and city moments. 3. Playful home life. 4. Beauty and self-care. 5. Behind the scenes.',
`visual_style`='Natural smartphone realism, soft cinematic light, off-centre compositions, tactile clothing detail and consistent warm skin tone.',
`tone_mood`='Confident, friendly, playful and intimate. Reels use simple movement and a clear visual payoff.',
`key_takeaway`='Hana makes an ordinary moment feel personal, stylish and worth remembering.',
`format_direction`='Use photo posts for strong single moods, carousels for mini narratives and Reels when movement or transformation improves the idea.',
`market_status`='Approved',`trend_status`='Approved',`research_version`=1,
`script_data`='{"ideas":[{"publishDate":"2026-08-24","format":"Photo Post","title":"Monday Café Reset","story":"Hana takes a quiet café break before a busy week. The story moves from city rush to one calm personal moment.","caption":"A little pause before the week begins. Coffee, sunlight and a fresh plan.","hashtags":"#HanaDaily #CafeMoment #LifestyleCreator"},{"publishDate":"2026-08-26","format":"Short Video / Reels","title":"One Blazer Three Moods","story":"A playful outfit transition showing one blazer styled for work, dinner and a casual night out.","caption":"One blazer, three different versions of me. Which mood wins?","hashtags":"#StyleReels #OutfitIdeas #HanaStyle"},{"publishDate":"2026-08-28","format":"Carousel","title":"Bangkok Night Details","story":"A six-frame visual diary of lights, food, textures and one candid portrait from a Bangkok evening.","caption":"The little details I want to remember from tonight.","hashtags":"#BangkokNights #TravelDiary #PhotoDump"},{"publishDate":"2026-08-31","format":"Photo Post","title":"Soft Morning Portrait","story":"A natural window-light portrait that introduces a calm new-week mood.","caption":"Starting slowly, but starting with intention.","hashtags":"#MorningLight #PortraitMood #HanaDaily"},{"publishDate":"2026-09-02","format":"Short Video / Reels","title":"From Home to Dinner","story":"A simple getting-ready transformation from comfortable homewear to an elegant dinner look.","caption":"Five minutes, one playlist, completely different energy.","hashtags":"#GetReadyWithMe #FashionReels #NightOut"},{"publishDate":"2026-09-04","format":"Carousel","title":"Things Making Me Smile","story":"A warm weekly recap featuring food, a funny candid, one outfit detail and a quiet sunset.","caption":"Small things, very good week.","hashtags":"#WeeklyRecap #LifestyleMoments #HanaDiary"}]}',
`script_status`='Draft',`assignment_members`='["maya.demo@imarketing.test","nova.demo@imarketing.test"]',
`assignment_stage`='Script · 2-Week Content Batch',`assignment_status`='Ongoing',`assigned_at`='2026-08-12T09:00:00Z',`assignment_due_at`='2026-08-19',`revision_note`=NULL,
`research_assignee`='Maya Chen · Demo Social Creator, Nova AI · Demo Production Worker',`trend_assignee`='Maya Chen · Demo Social Creator, Nova AI · Demo Production Worker',
`stage`='Script · In Progress',`progress`=55
WHERE `id`='PRJ-0001';--> statement-breakpoint

UPDATE `projects` SET
`project_nature`='one_off',`frequency_count`=0,`frequency_unit`=NULL,`recurring`=NULL,
`project_start_date`='2026-08-18',`project_end_date`='2026-09-15',
`brief_owner`='Hana Lim',`client_name`='ID Demo',
`brand_overview`='A demonstration brand showing how I-Marketing can create a polished 15–30 second AI-assisted commercial from strategy to delivery.',
`project_goal`='Create a memorable 30-second commercial that demonstrates strong storytelling, premium execution and efficient AI production.',
`audience`='Business owners, marketing managers and brands considering AI-assisted commercial production.',
`deliverables`='1 x 30-second master commercial, 1 x 15-second cutdown and key visual frames.',
`key_message`='High-level commercial storytelling can be produced faster and more efficiently without losing creative intention.',
`tone`='Confident, cinematic, modern and human.',`due_date`='2026-09-15',
`restrictions`='Avoid generic AI imagery, unclear product value, robotic performances and technology-first messaging without emotion.',
`brief_status`='Complete',`brief_version`=1,
`market_snapshot`='Brands want faster content production but remain concerned about visual consistency, generic concepts and unreliable AI output.',
`market_opportunities`='Demonstrate a structured human-led process where research, creative direction and approvals guide AI production.',
`market_direction`='Sell confidence in the production system rather than selling AI as a novelty.',
`market_references`='[{"url":"https://www.youtube.com/","note":"Reference for concise commercial storytelling and brand films"}]',
`trend_observations`='Short commercials increasingly open with a visual contradiction, reveal the production problem quickly and end with a simple transformation or proof.',
`trend_fit`='The demonstration can show a familiar expensive-production problem and resolve it through a controlled creative workflow.',
`trend_references`='[{"url":"https://www.youtube.com/","note":"15–30 second commercial pacing reference"}]',
`creative_concept`='From Impossible Brief to Finished World: an empty studio transforms into a complete branded commercial environment around one creator.',
`creative_objective`='Make potential clients understand that I-Marketing turns ambitious ideas into controlled, production-ready visual stories.',
`content_pillars`='Creative control, production efficiency, visual consistency and human-led decision making.',
`visual_style`='Begin minimal and neutral, then expand into a richly lit cinematic environment with tactile detail and confident camera movement.',
`tone_mood`='Curious opening, accelerating transformation and a confident final reveal.',
`key_takeaway`='The tool is AI, but the value is a well-managed creative production system.',
`format_direction`='One-off 30-second commercial followed by Storyboard, Image Generation, Video Generation, Editing and Client Review.',
`market_status`='Approved',`trend_status`='Approved',`research_version`=1,
`script_data`='{"theme":"From Impossible Brief to Finished World","duration":"30 seconds","storyPremise":"A creator stands in an empty studio holding an ambitious client brief that normally demands a large set, cast and budget.","storyFlow":"The empty space responds to each line of the brief. Light shapes the room, environments form, wardrobe changes and branded details appear. The creator remains calm while the world builds around her. The transformation ends on a finished commercial frame, revealing that the spectacle came from a controlled production workflow rather than chaos.","ending":"The final world pauses like a completed campaign key visual. The I-Marketing name appears with a clear invitation to bring the next impossible brief.","meaning":"The changing environment represents the gap between an idea and execution. The creator staying composed represents creative control throughout AI production.","designReason":"The transformation provides immediate visual proof while the human character keeps the story relatable. It demonstrates capability without turning the commercial into a technical tutorial."}',
`script_status`='Revision Requested',`assignment_members`='["daniel.demo@imarketing.test"]',
`assignment_stage`='Script · One-off Story Flow',`assignment_status`='Revision Requested',`assigned_at`='2026-08-11T10:00:00Z',`assignment_due_at`='2026-08-18',
`revision_note`='Strengthen the emotional payoff and make the final brand reveal feel less technical.',
`research_assignee`='Daniel Wong · Demo Story Writer',`trend_assignee`='Daniel Wong · Demo Story Writer',
`stage`='Script · Revision',`progress`=55
WHERE `id`='PRJ-0002';--> statement-breakpoint

DELETE FROM `project_members` WHERE `project_id` IN ('PRJ-0001','PRJ-0002');--> statement-breakpoint
INSERT OR IGNORE INTO `project_members` (`project_id`,`member_email`) VALUES
('PRJ-0001','maya.demo@imarketing.test'),('PRJ-0001','nova.demo@imarketing.test'),('PRJ-0002','daniel.demo@imarketing.test');
