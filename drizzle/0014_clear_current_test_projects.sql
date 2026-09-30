DELETE FROM change_requests WHERE project_id IN ('PRJ-0001','PRJ-0002','PRJ-0003');
--> statement-breakpoint
DELETE FROM review_sessions WHERE project_id IN ('PRJ-0001','PRJ-0002','PRJ-0003');
--> statement-breakpoint
DELETE FROM video_slots WHERE project_id IN ('PRJ-0001','PRJ-0002','PRJ-0003');
--> statement-breakpoint
DELETE FROM production_cycles WHERE project_id IN ('PRJ-0001','PRJ-0002','PRJ-0003');
--> statement-breakpoint
DELETE FROM production_batches WHERE project_id IN ('PRJ-0001','PRJ-0002','PRJ-0003');
--> statement-breakpoint
DELETE FROM content_items WHERE project_id IN ('PRJ-0001','PRJ-0002','PRJ-0003');
--> statement-breakpoint
DELETE FROM external_review_links WHERE project_id IN ('PRJ-0001','PRJ-0002','PRJ-0003');
--> statement-breakpoint
DELETE FROM learning_differences WHERE project_id IN ('PRJ-0001','PRJ-0002','PRJ-0003');
--> statement-breakpoint
DELETE FROM phase_records WHERE project_id IN ('PRJ-0001','PRJ-0002','PRJ-0003');
--> statement-breakpoint
DELETE FROM publishing_records WHERE project_id IN ('PRJ-0001','PRJ-0002','PRJ-0003');
--> statement-breakpoint
DELETE FROM document_versions WHERE project_id IN ('PRJ-0001','PRJ-0002','PRJ-0003');
--> statement-breakpoint
DELETE FROM idea_folders WHERE project_id IN ('PRJ-0001','PRJ-0002','PRJ-0003');
--> statement-breakpoint
DELETE FROM project_members WHERE project_id IN ('PRJ-0001','PRJ-0002','PRJ-0003');
--> statement-breakpoint
DELETE FROM research_edits WHERE project_id IN ('PRJ-0001','PRJ-0002','PRJ-0003');
--> statement-breakpoint
DELETE FROM visual_asset_revisions WHERE project_id IN ('PRJ-0001','PRJ-0002','PRJ-0003');
--> statement-breakpoint
DELETE FROM project_drive_folders WHERE project_id IN ('PRJ-0001','PRJ-0002','PRJ-0003');
--> statement-breakpoint
DELETE FROM production_events WHERE project_id IN ('PRJ-0001','PRJ-0002','PRJ-0003');
--> statement-breakpoint
DELETE FROM audit_log WHERE project_id IN ('PRJ-0001','PRJ-0002','PRJ-0003');
--> statement-breakpoint
DELETE FROM projects WHERE id IN ('PRJ-0001','PRJ-0002','PRJ-0003');
--> statement-breakpoint
INSERT OR IGNORE INTO app_migrations(id,applied_at) VALUES('v55_clear_current_three_test_projects',CURRENT_TIMESTAMP);
--> statement-breakpoint
INSERT INTO audit_log(project_id,event_type,actor_email,event_data,created_at) VALUES(NULL,'current_test_projects_cleared','alanloo927@gmail.com','{"projectIds":["PRJ-0001","PRJ-0002","PRJ-0003"],"driveFoldersPreserved":true}',CURRENT_TIMESTAMP);
