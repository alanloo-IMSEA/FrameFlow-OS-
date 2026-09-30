# Frameflow OS confirmed rules audit — 2026-08-21

No historical project, approval, asset, Drive link, member or version record may be deleted by this migration.

| Rule | Classification | Audit finding / patch route |
|---:|---|---|
| 1 | Conflict — Migrate Carefully | Legacy Commercial Video, Brand Film, Reels Package and Social Account need canonical type/mode/purpose fields while retaining legacy labels. |
| 2 | Conflict — Migrate Carefully | Project `status`, phase fields and assignment status are currently mixed. Add canonical project and phase status fields first. |
| 3 | Missing — Add | Add management-approved Change Request and Reopened lifecycle with audit log; no downstream auto-pause. |
| 4 | Missing — Add | Add AI Video Package Slot Bank and recurring 2-week batches. |
| 5 | Conflict — Migrate Carefully | Existing normal AI Video includes Storyboard. New canonical flow uses Script and Keyshot Image Set; preserve old approved Storyboards as historical records. |
| 6 | Missing — Add | Add formal client review-session counters and per-video locks. |
| 7 | Missing — Add | Add AI Reels conversion from one-off to recurring in the same project. |
| 8 | Conflict — Migrate Carefully | Existing Reels uses a Script-labelled stage; migrate new work to Idea / Hook / Story without deleting old scripts. |
| 9 | Missing — Add | Add 2-week Reel Batch Gate. |
| 10 | Missing — Add | Add two-session limits and one goodwill Final Check. |
| 11 | Missing — Add | Add Carry-over +1, one-carry limit and anonymised R&D transfer. |
| 12 | Needs Patch | Existing Hana Social project maps to Internal Social Account continuous batches; remove quota assumptions. |
| 13 | Missing — Add | Add end-of-batch Keep / Propose Adjustment review. |
| 14 | Missing — Add | Add Client Social Account as a separate continuous project type. |
| 15 | Missing — Add | Add start-date Monthly Cycles with exactly two 2-week batches. |
| 16 | Missing — Add | Add Waiting Payment cycle gate; keep distinct from Inactive. |
| 17 | Missing — Add | Add quota ledger consumed only by Final Publishing Approval. |
| 18 | Needs Patch | Current social formats partly exist; formalise Reel, Carousel, Photo and Threads Article semantics. |
| 19 | Missing — Add | Add multi-format quota hierarchy. |
| 20 | Missing — Add | Add project-authorised platforms and publishing-stage distribution choices. |
| 21 | Missing — Add | Separate approved content lock from editable publishing schedule/order. |
| 22 | Missing — Add | Add operational correction log outside formal review sessions. |
| 23 | Missing — Add | Add one internally reviewed Creative Direction per Monthly Cycle and weekly observations. |
| 24 | Needs Patch | Per-item internal review exists; add full-batch gate before production. |
| 25 | Needs Patch | Independent production review exists; add complete-batch client publishing review. |
| 26 | Missing — Add | Add client Final Publishing Approval and two-redo limit. |
| 27 | Missing — Add | Add cancelled-item quota replacement rule. |
| 28 | Missing — Add | Add Outstanding Content linked to original cycle with no deadline and parallel execution. |
| 29 | Missing — Add | Add separate Outstanding Content overview block. |
| 30 | Missing — Add | Add anonymous, unique external batch review links. |
| 31 | Missing — Add | Add minimal long-scroll external review page. |
| 32 | Missing — Add | Add draft decisions and final locked Submit Review. |
| 33 | Missing — Add | Add three-day action window, no auto-approval, and management follow-up task. |
| 34 | Missing — Add | Add link regeneration and old-link invalidation with audit retention. |
| 35 | Missing — Add | Add whole-batch withdrawal and mandatory new link. |
| 36 | Missing — Add | Add automatic publishing handoff after final approval; no Published phase. |
| 37 | Missing — Add | Add retryable vs human-required Publish Failed states and manual Retry Publish. |
| 38 | Conflict — Migrate Carefully | Existing MV is song-first but phase ordering differs. Preserve approved music/assets while migrating Entry A/B. |
| 39 | Missing — Add | Add Ready to Complete, payment gate and management-only Complete Project. |
| 40 | Missing — Add | Add six-month retention clock from manual Completed and selective cleanup policy. |
| 41 | Missing — Add | Add brand+market Client Profiles without contact records. |
| 42 | Needs Patch | Production memory exists; split Client Profile, client-specific learning and anonymised global learning with retention. |
| 43 | Missing — Add | Add AI Original → Human Edit → Final Approved difference records. |
| 44 | Missing — Add | Add advisory-only AI Review trial for Internal Social Reviewing state. |
| 45 | Missing — Add | Add management-only Internal R&D / Lab and terminal Promote / Archived outcomes. |
| 46 | Needs Patch | Retention and learning model must favour extracted experience over unlimited operational data. |
| 47 | Already Correct | Existing IDs, D1 records, assets, Drive links and version tables can be preserved through additive migrations. |

## Existing project classification

| Existing project | Canonical classification | Migration treatment |
|---|---|---|
| Hana Social Media Post | Internal Social Account · Continuous | Keep all data/assets; map canonical fields only. |
| ID Demo Commercial Video | AI Video · One-off · Commercial Video | Keep approved Storyboard as historical compatibility data; new AI Video flow uses Keyshot Set. |
| KK Slot_MV | MV · One-off | Keep music, lyrics, approvals, audio and Drive link; migrate only future phase routing. |
