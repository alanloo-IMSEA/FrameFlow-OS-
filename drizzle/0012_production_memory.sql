CREATE TABLE IF NOT EXISTS `production_events` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `project_id` text NOT NULL,
  `event_type` text NOT NULL,
  `actor_email` text NOT NULL,
  `actor_name` text NOT NULL,
  `actor_tier` integer NOT NULL,
  `event_data` text NOT NULL,
  `created_at` text NOT NULL
);

-- Repair any previously reviewed production task whose inline feedback contains refinements.
UPDATE `projects`
SET `assignment_status` = 'Revision Requested',
    `approval_title` = NULL
WHERE `script_data` LIKE '%"productionReviews"%'
  AND `script_data` LIKE '%"status":"refine"%'
  AND `assignment_status` NOT IN ('Revision Requested', 'Completed');
