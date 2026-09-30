import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  client: text("client").notNull(),
  type: text("type").notNull(),
  projectType: text("project_type_code"),
  projectMode: text("project_mode"),
  purpose: text("purpose"),
  mvEntry: text("mv_entry"),
  projectConfig: text("project_config").notNull().default("{}"),
  legacyType: text("legacy_type"),
  status: text("status").notNull(),
  projectStatus: text("project_status").notNull().default("Active"),
  phaseStatus: text("phase_status").notNull().default("In Progress"),
  paymentConfirmed: integer("payment_confirmed").notNull().default(0),
  paymentPercentage: integer("payment_percentage").notNull().default(0),
  deliveryConfirmed: integer("delivery_confirmed").notNull().default(0),
  paymentCleared: integer("payment_cleared").notNull().default(0),
  stage: text("stage").notNull(),
  progress: integer("progress").notNull().default(0),
  recurring: text("recurring"),
  projectNature: text("project_nature").notNull().default("one_off"),
  frequencyCount: integer("frequency_count").notNull().default(0),
  frequencyUnit: text("frequency_unit"),
  projectStartDate: text("project_start_date"),
  projectEndDate: text("project_end_date"),
  projectDuration: text("project_duration"),
  foundationStatus: text("foundation_status").notNull().default("Locked"),
  foundationVersion: integer("foundation_version").notNull().default(0),
  completedAt: text("completed_at"),
  isDemo: integer("is_demo").notNull().default(0),
  assignmentMembers: text("assignment_members"),
  assignmentStage: text("assignment_stage"),
  assignmentStatus: text("assignment_status"),
  assignedAt: text("assigned_at"),
  assignmentDueAt: text("assignment_due_at"),
  revisionNote: text("revision_note"),
  driveUrl: text("drive_url"),
  approvalTitle: text("approval_title"),
  briefOwner: text("brief_owner"),
  clientName: text("client_name"),
  brandOverview: text("brand_overview"),
  projectGoal: text("project_goal"),
  audience: text("audience"),
  deliverables: text("deliverables"),
  keyMessage: text("key_message"),
  tone: text("tone"),
  dueDate: text("due_date"),
  restrictions: text("restrictions"),
  briefStatus: text("brief_status").notNull().default("Draft"),
  briefDocUrl: text("brief_doc_url"),
  researchAssignee: text("research_assignee"),
  trendAssignee: text("trend_assignee"),
  marketSnapshot: text("market_snapshot"),
  marketOpportunities: text("market_opportunities"),
  marketDirection: text("market_direction"),
  marketReferences: text("market_references"),
  marketStatus: text("market_status").notNull().default("Locked"),
  trendObservations: text("trend_observations"),
  trendFit: text("trend_fit"),
  trendReferences: text("trend_references"),
  trendStatus: text("trend_status").notNull().default("Locked"),
  creativeConcept: text("creative_concept"),
  creativeObjective: text("creative_objective"),
  contentPillars: text("content_pillars"),
  visualStyle: text("visual_style"),
  toneMood: text("tone_mood"),
  keyTakeaway: text("key_takeaway"),
  formatDirection: text("format_direction"),
  scriptData: text("script_data"),
  scriptStatus: text("script_status").notNull().default("Locked"),
  scriptVersion: integer("script_version").notNull().default(0),
  teamId: integer("team_id"),
  briefVersion: integer("brief_version").notNull().default(0),
  researchVersion: integer("research_version").notNull().default(0),
  driveSyncStatus: text("drive_sync_status").notNull().default("Not connected"),
  createdAt: text("created_at").notNull(),
});

export const changeRequests = sqliteTable("change_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }), projectId: text("project_id").notNull(), phaseKey: text("phase_key").notNull(), requestedBy: text("requested_by").notNull(), requestNote: text("request_note"), status: text("status").notNull().default("Requested"), decidedBy: text("decided_by"), decidedAt: text("decided_at"), createdAt: text("created_at").notNull(),
});

export const reviewSessions = sqliteTable("review_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }), projectId: text("project_id").notNull(), scopeType: text("scope_type").notNull(), scopeId: text("scope_id").notNull(), reviewKind: text("review_kind").notNull(), sessionNumber: integer("session_number").notNull(), maxIncluded: integer("max_included").notNull(), status: text("status").notNull(), submittedAt: text("submitted_at"), completedAt: text("completed_at"), createdAt: text("created_at").notNull(),
});

export const videoSlots = sqliteTable("video_slots", {
  id: integer("id").primaryKey({ autoIncrement: true }), projectId: text("project_id").notNull(), slotNumber: integer("slot_number").notNull(), purpose: text("purpose"), status: text("status").notNull().default("Available"), phaseStatus: text("phase_status").notNull().default("Locked"), data: text("data").notNull().default("{}"), createdAt: text("created_at").notNull(),
});

export const productionCycles = sqliteTable("production_cycles", {
  id: integer("id").primaryKey({ autoIncrement: true }), projectId: text("project_id").notNull(), cycleType: text("cycle_type").notNull(), startsAt: text("starts_at").notNull(), endsAt: text("ends_at"), status: text("status").notNull(), configuration: text("configuration").notNull().default("{}"), createdAt: text("created_at").notNull(),
});

export const productionBatches = sqliteTable("production_batches", {
  id: integer("id").primaryKey({ autoIncrement: true }), projectId: text("project_id").notNull(), cycleId: integer("cycle_id"), batchNumber: integer("batch_number").notNull(), startsAt: text("starts_at"), endsAt: text("ends_at"), status: text("status").notNull(), gateStatus: text("gate_status").notNull().default("Locked"), plannedCount: integer("planned_count").notNull().default(0), createdAt: text("created_at").notNull(),
},table=>[index("production_batches_project_status_number").on(table.projectId,table.status,table.batchNumber)]);

export const contentItems = sqliteTable("content_items", {
  id: integer("id").primaryKey({ autoIncrement: true }), projectId: text("project_id").notNull(), cycleId: integer("cycle_id"), batchId: integer("batch_id"), originalCycleId: integer("original_cycle_id"), contentType: text("content_type").notNull(), title: text("title"), status: text("status").notNull(), quotaType: text("quota_type"), quotaConsumed: integer("quota_consumed").notNull().default(0), carryCount: integer("carry_count").notNull().default(0), isOutstanding: integer("is_outstanding").notNull().default(0), data: text("data").notNull().default("{}"), createdAt: text("created_at").notNull(),
});

export const documentVersions = sqliteTable("document_versions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: text("project_id").notNull(),
  documentType: text("document_type").notNull(),
  version: integer("version").notNull(),
  snapshot: text("snapshot").notNull(),
  approvedBy: text("approved_by"),
  createdAt: text("created_at").notNull(),
});

export const ideaFolders = sqliteTable("idea_folders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: text("project_id").notNull(),
  ideaIndex: integer("idea_index").notNull(),
  title: text("title"),
  publishDate: text("publish_date"),
  folderName: text("folder_name").notNull(),
  driveStatus: text("drive_status").notNull().default("Pending Drive connection"),
  driveUrl: text("drive_url"),
  createdAt: text("created_at").notNull(),
});

export const members = sqliteTable("members", {
  email: text("email").primaryKey(),
  name: text("name").notNull(),
  tier: integer("tier").notNull().default(2),
  status: text("status").notNull().default("Pending site access"),
  telegramChatId: text("telegram_chat_id"),
  telegramStatus: text("telegram_status").notNull().default("Not connected"),
  memberKind: text("member_kind").notNull().default("human"),
  telegramUsername: text("telegram_username"),
  agentLanguage: text("agent_language"),
  agentStopPhase: text("agent_stop_phase"),
  teamId: integer("team_id"),
  createdAt: text("created_at").notNull(),
});

export const integrationConnections = sqliteTable("integration_connections", {
  provider: text("provider").primaryKey(),
  encryptedSecret: text("encrypted_secret").notNull(),
  configJson: text("config_json").notNull().default("{}"),
  status: text("status").notNull().default("Configured"),
  lastTestedAt: text("last_tested_at"),
  updatedAt: text("updated_at").notNull(),
});

export const memberTelegramIdentities = sqliteTable("member_telegram_identities", {
  memberEmail: text("member_email").primaryKey(),
  expectedUsername: text("expected_username"),
  telegramUserId: text("telegram_user_id").unique(),
  username: text("username"),
  displayName: text("display_name"),
  pictureUrl: text("picture_url"),
  status: text("status").notNull().default("Ready to link"),
  linkedAt: text("linked_at"),
  lastLoginAt: text("last_login_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const memberTelegramLoginRequests = sqliteTable("member_telegram_login_requests", {
  stateHash: text("state_hash").primaryKey(),
  memberEmail: text("member_email").notNull(),
  codeVerifier: text("code_verifier").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
});

export const memberTelegramSessions = sqliteTable("member_telegram_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  memberEmail: text("member_email").notNull(),
  telegramUserId: text("telegram_user_id").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
  revokedAt: text("revoked_at"),
});

export const teams = sqliteTable("teams", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  leadEmail: text("lead_email"),
  createdAt: text("created_at").notNull(),
});

export const projectMembers = sqliteTable("project_members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: text("project_id").notNull(),
  memberEmail: text("member_email").notNull(),
});

export const researchEdits = sqliteTable("research_edits", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: text("project_id").notNull(),
  researchType: text("research_type").notNull(),
  editorEmail: text("editor_email").notNull(),
  editorName: text("editor_name").notNull(),
  editorTier: integer("editor_tier").notNull(),
  changedFields: text("changed_fields").notNull(),
  createdAt: text("created_at").notNull(),
  seenByManagement: integer("seen_by_management").notNull().default(0),
});

export const visualAssetRevisions = sqliteTable("visual_asset_revisions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: text("project_id").notNull(),
  phase: text("phase").notNull(),
  itemKey: text("item_key").notNull(),
  version: integer("version").notNull(),
  storageKey: text("storage_key").notNull(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  uploadedBy: text("uploaded_by").notNull(),
  isCurrent: integer("is_current").notNull().default(1),
  driveSyncStatus: text("drive_sync_status").notNull().default("Pending Drive sync"),
  createdAt: text("created_at").notNull(),
},table=>[index("visual_asset_lookup").on(table.projectId,table.phase,table.itemKey,table.version)]);

export const assetUpscaleJobs = sqliteTable("asset_upscale_jobs", {
  id: text("id").primaryKey(),
  jobId: text("job_id").notNull().unique(),
  projectId: text("project_id").notNull(),
  sourceAssetId: integer("source_asset_id").notNull().unique(),
  derivedAssetId: integer("derived_asset_id"),
  contentId: text("content_id"),
  phase: text("phase").notNull(),
  itemKey: text("item_key").notNull(),
  runninghubWorkflowId: text("runninghub_workflow_id").notNull(),
  runninghubTaskId: text("runninghub_task_id"),
  runninghubFileName: text("runninghub_file_name"),
  status: text("status").notNull().default("UPSCALE_PENDING"),
  originalDimensions: text("original_dimensions"),
  finalDimensions: text("final_dimensions"),
  assetPurpose: text("asset_purpose").notNull().default("UPSCALED_MASTER"),
  pollCount: integer("poll_count").notNull().default(0),
  lastError: text("last_error"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  completedAt: text("completed_at"),
},table=>[
  index("asset_upscale_project_status_lookup").on(table.projectId,table.status,table.updatedAt),
  index("asset_upscale_task_lookup").on(table.runninghubTaskId),
]);

export const externalReviewLinks = sqliteTable("external_review_links", {
  id: integer("id").primaryKey({ autoIncrement: true }), projectId: text("project_id").notNull(), batchId: integer("batch_id").notNull(), tokenHash: text("token_hash").notNull(), status: text("status").notNull().default("Active"), expiresAt: text("expires_at").notNull(), submittedAt: text("submitted_at"), invalidatedAt: text("invalidated_at"), createdBy: text("created_by").notNull(), createdAt: text("created_at").notNull(),
});

export const auditLog = sqliteTable("audit_log", {
  id: integer("id").primaryKey({ autoIncrement: true }), projectId: text("project_id"), eventType: text("event_type").notNull(), actorEmail: text("actor_email"), eventData: text("event_data").notNull().default("{}"), createdAt: text("created_at").notNull(), demoData: integer("demo_data").notNull().default(0),
},table=>[index("audit_log_project_created_lookup").on(table.projectId,table.createdAt),index("audit_log_event_created_lookup").on(table.eventType,table.createdAt)]);

export const clientProfiles = sqliteTable("client_profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }), brandName: text("brand_name").notNull(), market: text("market").notNull(), positioning: text("positioning"), audience: text("audience"), coreProducts: text("core_products"), brandIdentity: text("brand_identity"), status: text("status").notNull().default("Active"), createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
});

export const learningDifferences = sqliteTable("learning_differences", {
  id: integer("id").primaryKey({ autoIncrement: true }), projectId: text("project_id").notNull(), clientProfileId: integer("client_profile_id"), contentKind: text("content_kind").notNull(), aiOriginal: text("ai_original"), humanEdit: text("human_edit"), finalApproved: text("final_approved"), extractedPattern: text("extracted_pattern"), createdAt: text("created_at").notNull(), demoData: integer("demo_data").notNull().default(0), learningStatus: text("learning_status").notNull().default("Pending Review"),
},table=>[index("learning_differences_project_status_created").on(table.projectId,table.learningStatus,table.createdAt)]);

export const phaseRecords = sqliteTable("phase_records", {
  id: integer("id").primaryKey({ autoIncrement: true }), projectId: text("project_id").notNull(), phaseKey: text("phase_key").notNull(), position: integer("position").notNull(), label: text("label").notNull(), reviewKind: text("review_kind").notNull().default("none"), maxReviews: integer("max_reviews"), status: text("status").notNull().default("Locked"), data: text("data").notNull().default("{}"), version: integer("version").notNull().default(0), openedAt: text("opened_at"), approvedAt: text("approved_at"), updatedAt: text("updated_at").notNull(),
},table=>[uniqueIndex("phase_records_project_phase_unique").on(table.projectId,table.phaseKey),index("phase_records_project_status_position").on(table.projectId,table.status,table.position)]);

export const publishingRecords = sqliteTable("publishing_records", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobId: text("job_id").unique(),
  projectId: text("project_id").notNull(),
  batchId: integer("batch_id"),
  contentItemId: integer("content_item_id"),
  contentKey: text("content_key"),
  publishingOrder: integer("publishing_order").notNull().default(0),
  platform: text("platform").notNull(),
  socialConnectionId: text("social_connection_id"),
  connectedAccountId: text("connected_account_id"),
  connectedHandle: text("connected_handle"),
  caption: text("caption").notNull().default(""),
  assets: text("assets").notNull().default("[]"),
  scheduledAt: text("scheduled_at"),
  publishedAt: text("published_at"),
  providerContainerId: text("provider_container_id"),
  providerPostId: text("provider_post_id"),
  providerMediaId: text("provider_media_id"),
  postUrl: text("post_url"),
  status: text("status").notNull().default("READY"),
  result: text("result").notNull().default("{}"),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").notNull().default(0),
  performanceSyncStatus: text("performance_sync_status").notNull().default("PENDING"),
  rawMetrics: text("raw_metrics").notNull().default("{}"),
  normalizedMetrics: text("normalized_metrics").notNull().default("{}"),
  telegramNotificationStatus: text("telegram_notification_status").notNull().default("PENDING"),
  telegramNotifiedAt: text("telegram_notified_at"),
  telegramNotificationError: text("telegram_notification_error"),
  requiresHumanAction: integer("requires_human_action").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at"),
},table=>[index("publishing_project_status_published").on(table.projectId,table.status,table.publishedAt),index("publishing_project_batch_order").on(table.projectId,table.batchId,table.publishingOrder)]);

export const projectSocialConnections = sqliteTable("project_social_connections", {
  connectionId: text("connection_id"),
  projectId: text("project_id").notNull(),
  platform: text("platform").notNull(),
  providerKey: text("provider_key").notNull(),
  externalAccountId: text("external_account_id").notNull(),
  profileUrl: text("profile_url").notNull().default(""),
  handle: text("handle").notNull().default(""),
  accountType: text("account_type"),
  status: text("status").notNull().default("DISCONNECTED"),
  permissionsJson: text("permissions_json").notNull().default("[]"),
  capabilitiesJson: text("capabilities_json").notNull().default("{}"),
  tokenExpiresAt: text("token_expires_at"),
  connectedBy: text("connected_by"),
  connectedAt: text("connected_at"),
  lastCheckedAt: text("last_checked_at"),
  disconnectedAt: text("disconnected_at"),
  isDefault: integer("is_default").notNull().default(0),
  updatedAt: text("updated_at").notNull(),
}, table => [uniqueIndex("social_connection_id_unique").on(table.connectionId), uniqueIndex("social_connection_project_account_unique").on(table.projectId, table.platform, table.externalAccountId), index("social_connection_project_platform_lookup").on(table.projectId, table.platform, table.isDefault), index("social_connection_account_lookup").on(table.platform, table.externalAccountId)]);

export const publishingAttempts = sqliteTable("publishing_attempts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  publishingRecordId: integer("publishing_record_id"),
  jobId: text("job_id"),
  projectId: text("project_id").notNull(),
  platform: text("platform").notNull(),
  attemptNumber: integer("attempt_number").notNull(),
  status: text("status").notNull(),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  providerResponse: text("provider_response").notNull().default("{}"),
  startedAt: text("started_at").notNull(),
  completedAt: text("completed_at"),
},table=>[index("publishing_attempts_project_started_lookup").on(table.projectId,table.startedAt),index("publishing_attempts_record_attempt_lookup").on(table.publishingRecordId,table.attemptNumber)]);

export const temporaryPublishingAssets = sqliteTable("temporary_publishing_assets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: text("project_id").notNull(),
  publishingRecordId: integer("publishing_record_id"),
  jobId: text("job_id"),
  accessToken: text("access_token").notNull().unique(),
  originalStorageKey: text("original_storage_key").notNull(),
  temporaryStorageKey: text("temporary_storage_key").notNull().unique(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  status: text("status").notNull().default("ACTIVE"),
  expiresAt: text("expires_at").notNull(),
  deleteAfter: text("delete_after"),
  firstFetchedAt: text("first_fetched_at"),
  lastFetchedAt: text("last_fetched_at"),
  deletedAt: text("deleted_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, table => [index("temporary_publishing_assets_expiry_lookup").on(table.status, table.expiresAt), index("temporary_publishing_assets_record_lookup").on(table.publishingRecordId, table.originalStorageKey)]);

export const socialPerformanceSnapshots = sqliteTable("social_performance_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: text("project_id").notNull(),
  batchId: integer("batch_id"),
  platform: text("platform").notNull(),
  socialConnectionId: text("social_connection_id"),
  connectedAccountId: text("connected_account_id"),
  publishingRecordId: integer("publishing_record_id"),
  scope: text("scope").notNull().default("CONTENT"),
  capturedAt: text("captured_at").notNull(),
  rawMetrics: text("raw_metrics").notNull().default("{}"),
  normalizedMetrics: text("normalized_metrics").notNull().default("{}"),
},table=>[index("performance_project_captured_lookup").on(table.projectId,table.capturedAt),index("performance_project_batch_captured").on(table.projectId,table.batchId,table.capturedAt),index("performance_record_captured_lookup").on(table.publishingRecordId,table.capturedAt)]);

export const batchLearningRecords = sqliteTable("batch_learning_records", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: text("project_id").notNull(),
  batchKey: text("batch_key").notNull(),
  sourceWindowStart: text("source_window_start"),
  sourceWindowEnd: text("source_window_end"),
  keepJson: text("keep_json").notNull().default("[]"),
  improveJson: text("improve_json").notNull().default("[]"),
  testNextJson: text("test_next_json").notNull().default("[]"),
  evidenceJson: text("evidence_json").notNull().default("{}"),
  status: text("status").notNull().default("READY"),
  approvedBy: text("approved_by"),
  approvedAt: text("approved_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
},table=>[index("batch_learning_project_status_updated").on(table.projectId,table.status,table.updatedAt),index("batch_learning_project_key_id").on(table.projectId,table.batchKey,table.id)]);

export const agentFileGrants = sqliteTable("agent_file_grants", {
  id: text("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  jobId: text("job_id").notNull().unique(),
  agentId: text("agent_id").notNull(),
  projectId: text("project_id").notNull(),
  phaseKey: text("phase_key").notNull(),
  contentId: text("content_id").notNull(),
  readAssetIds: text("read_asset_ids").notNull().default("[]"),
  writeItemKeys: text("write_item_keys").notNull().default("[]"),
  status: text("status").notNull().default("Active"),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
  lastUsedAt: text("last_used_at"),
  revokedAt: text("revoked_at"),
});

export const agentApiTokens = sqliteTable("agent_api_tokens", {
  id: text("id").primaryKey(),
  agentId: text("agent_id").notNull(),
  tokenHash: text("token_hash").notNull(),
  label: text("label"),
  scopesJson: text("scopes_json").notNull().default('["projects:read"]'),
  status: text("status").notNull().default("Active"),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
  expiresAt: text("expires_at"),
  lastUsedAt: text("last_used_at"),
  revokedAt: text("revoked_at"),
}, table => [uniqueIndex("agent_api_tokens_hash_unique").on(table.tokenHash), index("agent_api_tokens_agent_status_lookup").on(table.agentId, table.status)]);

export const agentFileGrantEvents = sqliteTable("agent_file_grant_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  grantId: text("grant_id").notNull(),
  eventType: text("event_type").notNull(),
  itemKey: text("item_key"),
  eventData: text("event_data").notNull().default("{}"),
  createdAt: text("created_at").notNull(),
},table=>[index("agent_file_events_grant_created").on(table.grantId,table.createdAt)]);

export const orchestratorJobs = sqliteTable("orchestrator_jobs", {
  id: text("id").primaryKey(),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  parentJobId: text("parent_job_id"),
  projectId: text("project_id").notNull(),
  contentId: text("content_id"),
  taskId: text("task_id").notNull(),
  jobType: text("job_type").notNull(),
  actor: text("actor").notNull(),
  provider: text("provider"),
  model: text("model"),
  inputAssets: text("input_assets").notNull().default("[]"),
  outputAssets: text("output_assets").notNull().default("[]"),
  inputPayload: text("input_payload").notNull().default("{}"),
  outputPayload: text("output_payload").notNull().default("{}"),
  status: text("status").notNull().default("QUEUED"),
  attemptCount: integer("attempt_count").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(3),
  scheduledFor: text("scheduled_for"),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  lastError: text("last_error"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const orchestratorJobEvents = sqliteTable("orchestrator_job_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobId: text("job_id").notNull(),
  eventType: text("event_type").notNull(),
  actor: text("actor").notNull(),
  eventData: text("event_data").notNull().default("{}"),
  createdAt: text("created_at").notNull(),
},table=>[index("orchestrator_events_job_created").on(table.jobId,table.createdAt)]);

export const orchestratorJobTokens = sqliteTable("orchestrator_job_tokens", {
  id: text("id").primaryKey(),
  jobId: text("job_id").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  scope: text("scope").notNull(),
  status: text("status").notNull().default("Active"),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
  revokedAt: text("revoked_at"),
});

export const orchestratorCosts = sqliteTable("orchestrator_costs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobId: text("job_id").notNull(),
  provider: text("provider").notNull(),
  model: text("model"),
  currency: text("currency").notNull().default("USD"),
  amountMicros: integer("amount_micros").notNull().default(0),
  inputUnits: integer("input_units").notNull().default(0),
  outputUnits: integer("output_units").notNull().default(0),
  pricingStatus: text("pricing_status").notNull().default("UNPRICED"),
  metadata: text("metadata").notNull().default("{}"),
  createdAt: text("created_at").notNull(),
});

export const formulaLibrary = sqliteTable("formula_library", {
  id: integer("id").primaryKey({autoIncrement:true}),formulaId:text("formula_id").notNull(),formulaName:text("formula_name").notNull(),projectType:text("project_type").notNull(),phaseKey:text("phase_key").notNull(),version:text("version").notNull(),status:text("status").notNull(),promptTemplate:text("prompt_template").notNull(),expectedOutputSchema:text("expected_output_schema").notNull(),createdAt:text("created_at").notNull(),updatedAt:text("updated_at").notNull(),
},table=>[uniqueIndex("formula_library_formula_version_unique").on(table.formulaId,table.version),index("formula_library_active_phase_lookup").on(table.projectType,table.phaseKey,table.status)]);

export const approvedPhaseSnapshots = sqliteTable("approved_phase_snapshots", {
  id:integer("id").primaryKey({autoIncrement:true}),projectId:text("project_id").notNull(),projectType:text("project_type").notNull(),phaseKey:text("phase_key").notNull(),phaseLabel:text("phase_label").notNull(),version:integer("version").notNull(),approvedContent:text("approved_content").notNull(),approvedBy:text("approved_by").notNull(),approvedAt:text("approved_at").notNull(),formulaId:text("formula_id"),formulaVersion:text("formula_version"),generationMethod:text("generation_method").notNull(),demoData:integer("demo_data").notNull().default(0),learningStatus:text("learning_status").notNull().default("Not Applicable"),
},table=>[uniqueIndex("approved_snapshots_project_phase_version_unique").on(table.projectId,table.phaseKey,table.version),index("approved_snapshots_latest_lookup").on(table.projectId,table.phaseKey,table.version,table.id)]);

export const phaseGenerationRecords = sqliteTable("phase_generation_records", {
  id:integer("id").primaryKey({autoIncrement:true}),projectId:text("project_id").notNull(),projectType:text("project_type").notNull(),phaseKey:text("phase_key").notNull(),formulaId:text("formula_id"),formulaVersion:text("formula_version"),generationMethod:text("generation_method").notNull(),originalGeneratedDraft:text("original_generated_draft"),humanEditedVersion:text("human_edited_version"),finalApprovedVersion:text("final_approved_version"),changedFields:text("changed_fields"),createdAt:text("created_at").notNull(),editedAt:text("edited_at"),approvedAt:text("approved_at"),reviewResult:text("review_result"),demoData:integer("demo_data").notNull().default(0),learningStatus:text("learning_status").notNull().default("Pending Review"),
},table=>[index("phase_generation_project_learning_created").on(table.projectId,table.learningStatus,table.createdAt),index("phase_generation_project_phase_approved").on(table.projectId,table.phaseKey,table.approvedAt)]);

export const generationContextCache = sqliteTable("generation_context_cache", {
  projectId:text("project_id").notNull(),currentPhaseKey:text("current_phase_key").notNull(),contextJson:text("context_json").notNull(),builtAt:text("built_at").notNull(),demoData:integer("demo_data").notNull().default(0),
},table=>[primaryKey({columns:[table.projectId,table.currentPhaseKey]})]);

export const productionEvents = sqliteTable("production_events", {
  id:integer("id").primaryKey({autoIncrement:true}),projectId:text("project_id").notNull(),eventType:text("event_type").notNull(),actorEmail:text("actor_email").notNull(),actorName:text("actor_name").notNull(),actorTier:integer("actor_tier").notNull(),eventData:text("event_data").notNull(),createdAt:text("created_at").notNull(),
},table=>[index("production_events_project_created_lookup").on(table.projectId,table.createdAt)]);

export const agentProjectControls = sqliteTable("agent_project_controls", {
  projectId:text("project_id").primaryKey(),agentId:text("agent_id").notNull(),active:integer("active").notNull().default(0),stopPhaseKey:text("stop_phase_key").notNull().default("reel-video-production"),status:text("status").notNull(),activatedAt:text("activated_at").notNull(),updatedAt:text("updated_at").notNull(),lastPhaseKey:text("last_phase_key"),lastError:text("last_error"),
});

export const agentRuns = sqliteTable("agent_runs", {
  id:integer("id").primaryKey({autoIncrement:true}),projectId:text("project_id").notNull(),agentId:text("agent_id").notNull(),phaseKey:text("phase_key").notNull(),status:text("status").notNull(),formulaId:text("formula_id"),formulaVersion:text("formula_version"),provider:text("provider"),model:text("model"),startedAt:text("started_at").notNull(),completedAt:text("completed_at"),error:text("error"),
},table=>[index("agent_runs_project_phase_started").on(table.projectId,table.phaseKey,table.startedAt)]);

export const appMigrations = sqliteTable("app_migrations", {
  id:text("id").primaryKey(),appliedAt:text("applied_at").notNull(),
});

export const driveConnections = sqliteTable("drive_connections", {
  accountEmail:text("account_email").primaryKey(),encryptedRefreshToken:text("encrypted_refresh_token").notNull(),rootFolderId:text("root_folder_id").notNull(),rootFolderUrl:text("root_folder_url").notNull(),connectedAt:text("connected_at").notNull(),updatedAt:text("updated_at").notNull(),
});

export const driveSyncQueue = sqliteTable("drive_sync_queue", {
  id:integer("id").primaryKey({autoIncrement:true}),eventKey:text("event_key").notNull().unique(),projectId:text("project_id").notNull(),phaseKey:text("phase_key").notNull(),eventType:text("event_type").notNull(),actorEmail:text("actor_email"),payload:text("payload").notNull().default("{}"),status:text("status").notNull().default("Pending"),attempts:integer("attempts").notNull().default(0),lastError:text("last_error"),createdAt:text("created_at").notNull(),syncedAt:text("synced_at"),
},table=>[index("drive_sync_project_status_created").on(table.projectId,table.status,table.createdAt)]);

export const projectDriveFolders = sqliteTable("project_drive_folders", {
  projectId:text("project_id").primaryKey(),folderId:text("folder_id").notNull(),folderUrl:text("folder_url").notNull(),demo:integer("demo").notNull().default(0),createdAt:text("created_at").notNull(),
});
