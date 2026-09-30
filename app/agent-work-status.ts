export const AGENT_HEARTBEAT_WINDOW_MS = 5 * 60_000;

export const ACTIVE_EXECUTION_STATUSES = new Set([
  "QUEUED",
  "RUNNING",
  "WAITING_PROVIDER",
  "RETRY_PENDING",
]);

export function agentPresence(
  lastSeenAt: string | null | undefined,
  nowMs = Date.now(),
  windowMs = AGENT_HEARTBEAT_WINDOW_MS,
) {
  const seen = lastSeenAt ? Date.parse(lastSeenAt) : Number.NaN;
  const online = Number.isFinite(seen) && nowMs - seen <= windowMs;
  return {
    state: online ? "online" : "offline",
    label: online
      ? "Online · heartbeat received"
      : lastSeenAt
        ? "Offline · heartbeat expired"
        : "Offline · no recent heartbeat",
    lastSeenAt: lastSeenAt || null,
  };
}

type ExecutionInput = {
  phaseStatus?: string;
  controlStatus?: string;
  controlActive?: boolean;
  lastError?: string;
  parentStatus?: string;
  children?: Array<{ jobType?: string; status?: string }>;
};

export function summarizeAgentExecution(input: ExecutionInput) {
  const children = input.children || [];
  const count = (type: string, statuses: Set<string>) =>
    children.filter(
      (job) =>
        String(job.jobType || "") === type &&
        statuses.has(String(job.status || "").toUpperCase()),
    ).length;
  const failed = new Set(["FAILED"]);
  const activeVideos = count("VIDEO_GENERATION", ACTIVE_EXECUTION_STATUSES);
  const activeImages = count("IMAGE_GENERATION", ACTIVE_EXECUTION_STATUSES);
  const failedVideos = count("VIDEO_GENERATION", failed);
  const failedImages = count("IMAGE_GENERATION", failed);
  const scopeCompleted = String(input.controlStatus || "").includes(
    "Scope Completed",
  );

  if (scopeCompleted)
    return {
      state: "complete",
      label: String(input.controlStatus),
      needsAttention: false,
      scopeCompleted: true,
    };
  if (activeVideos)
    return {
      state: "provider",
      label: `RunningHub · ${activeVideos} Reel job${activeVideos === 1 ? "" : "s"} queued or generating`,
      needsAttention: false,
      scopeCompleted: false,
    };
  if (activeImages)
    return {
      state: "provider",
      label: `Image provider · ${activeImages} Image job${activeImages === 1 ? "" : "s"} queued or generating`,
      needsAttention: false,
      scopeCompleted: false,
    };
  if (failedVideos)
    return {
      state: "attention",
      label: `Needs Attention · ${failedVideos} Reel generation${failedVideos === 1 ? "" : "s"} failed`,
      needsAttention: true,
      scopeCompleted: false,
    };
  if (failedImages)
    return {
      state: "attention",
      label: `Needs Attention · ${failedImages} Image generation${failedImages === 1 ? "" : "s"} failed`,
      needsAttention: true,
      scopeCompleted: false,
    };
  if (String(input.controlStatus || "").includes("Resume approved Reel generation"))
    return {
      state: "attention",
      label: "Needs Attention · Resume approved Reel generation",
      needsAttention: true,
      scopeCompleted: false,
    };
  if (
    String(input.parentStatus || "").toUpperCase() === "FAILED" ||
    String(input.controlStatus || "").includes("Needs Attention")
  )
    return {
      state: "attention",
      label: "Needs Attention · Resume task to continue the saved draft",
      needsAttention: true,
      scopeCompleted: false,
    };
  if (["QUEUED", "RUNNING", "RETRY_PENDING"].includes(String(input.parentStatus || "").toUpperCase()))
    return {
      state: "processing",
      label: "FrameFlow Agent task processing",
      needsAttention: false,
      scopeCompleted: false,
    };
  if (String(input.parentStatus || "").toUpperCase() === "WAITING_PROVIDER")
    return {
      state: "provider",
      label: "Provider handoff · awaiting execution status",
      needsAttention: false,
      scopeCompleted: false,
    };
  if (
    ["Reviewing", "Client Reviewing"].includes(String(input.phaseStatus || ""))
  )
    return {
      state: "review",
      label: "Waiting for Management Review",
      needsAttention: false,
      scopeCompleted: false,
    };
  if (!input.controlActive)
    return {
      state: "paused",
      label: "Project automation paused",
      needsAttention: false,
      scopeCompleted: false,
    };
  return {
    state: "ready",
    label: `Project automation ready · ${input.phaseStatus || "In Progress"}`,
    needsAttention: false,
    scopeCompleted: false,
  };
}
