-- Keep demo handlers' assigned work visible while production stages are being tested.
UPDATE `projects`
SET `assignment_status` = CASE
      WHEN `script_status` = 'Revision Requested' THEN 'Revision Requested'
      ELSE 'Ongoing'
    END,
    `assignment_stage` = CASE
      WHEN `script_status` = 'Approved' AND `project_nature` = 'recurring' THEN 'Image Generation'
      WHEN `script_status` = 'Approved' THEN 'Storyboard'
      WHEN `script_status` = 'Revision Requested' THEN 'Script Refinement'
      ELSE 'Script'
    END
WHERE `id` IN ('PRJ-0001', 'PRJ-0002')
  AND COALESCE(`assignment_members`, '[]') <> '[]';
