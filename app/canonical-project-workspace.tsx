"use client";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { readJson } from "./read-json";
import ProjectPhaseBar from "./project-phase-bar";
import CanonicalPhaseWorkspace, {
  BatchPerformanceLearningCard,
} from "./canonical-phase-workspace";
import { selectSocialBatchLifecycle } from "./social-batch-lifecycle";
import { workflowFor } from "./workflow-definition";
import { operationalState } from "./operational-status";

function initialPhase(p: any) {
  const allowed = new Set(
      workflowFor(p.projectType || p.type, p.projectMode, p.mvEntry).map(
        (phase) => phase.key,
      ),
    ),
    records = (p.phaseRecords || []).filter((row: any) =>
      allowed.has(row.phaseKey),
    );
  if (
    p._openPhase &&
    allowed.has(p._openPhase) &&
    records.some((x: any) => x.phaseKey === p._openPhase)
  )
    return p._openPhase;
  const stage = String(p.assignmentStage || p.stage || "").toLowerCase(),
    available = records.filter((x: any) => x.status !== "Locked");
  return (
    available.find((x: any) =>
      stage.includes(String(x.label || "").toLowerCase()),
    )?.phaseKey ||
    available.find((x: any) => x.status !== "Approved")?.phaseKey ||
    available.at(-1)?.phaseKey ||
    "client-brief"
  );
}
function AgentProjectStatus({ p }: { p: any }) {
  let assigned = false;
  try {
    assigned = JSON.parse(p.assignmentMembers || "[]").includes(
      "agent:milla-im",
    );
  } catch {}
  const [item, setItem] = useState<any>(null);
  async function load() {
    const response = await fetch("/api/agent-runner", { cache: "no-store" });
    if (response.ok)
      setItem(
        ((await response.json()).assignments || []).find(
          (row: any) => row.id === p.id,
        ) || null,
      );
  }
  useEffect(() => {
    if (!assigned) return;
    load();
    const timer = window.setInterval(load, 30000),
      refresh = () => load();
    window.addEventListener("frameflow:refresh", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("frameflow:refresh", refresh);
    };
  }, [p.id, p.stage, assigned]);
  if (!assigned || !item) return null;
  const paused = item.executionState === "paused" || item.needsAttention,
    completed = Boolean(item.scopeCompleted),
    active = ["provider", "processing"].includes(item.executionState),
    online = item.agentConnectionStatus === "ONLINE";
  return (
    <section
      className={`agent-project-status ${paused ? "paused" : completed ? "complete" : active ? "active" : "ready"}`}
    >
      <span className="member-avatar">AI</span>
      <div>
        <small>AGENT (IM) · PROJECT STATUS</small>
        <b>Agent connection · {online ? "Online" : "Offline"}</b>
        <span>{item.executionStatus || "Ready"}</span>
        <p>
          {item.client} · {item.phaseLabel} · {item.phaseStatus}
        </p>
        <small>
          Project automation: {item.automationEnabled ? "Enabled" : "Paused"} ·
          Manage in Workload → Agent Work.
        </small>
      </div>
    </section>
  );
}
function ProjectBatchPerformance({ p }: { p: any }) {
  const [data, setData] = useState<any>(null),
    [selected, setSelected] = useState<number | null>(null),
    [working, setWorking] = useState(""),
    [error, setError] = useState("");
  const requestVersion = useRef(0);
  async function load(batchId: number | null = selected) {
    const version = ++requestVersion.current;
    setError("");
    try {
      const result = await readJson(
        `/api/publishing?projectId=${encodeURIComponent(p.id)}${batchId ? `&batchId=${batchId}` : ""}`,
      );
      if (version !== requestVersion.current) return;
      setData(result);
      setSelected(Number(result.selectedBatchId) || null);
    } catch (error: any) {
      if (version === requestVersion.current) setError(error.message);
    }
  }
  useEffect(() => {
    load(selected);
  }, [p.id, selected]);
  if (
    !["Internal Social Account", "Client Social Account"].includes(
      p.projectType,
    )
  )
    return null;
  if (error || !data)
    return (
      <section className="project-load-error" role={error ? "alert" : "status"}>
        <b>
          {error ? "Performance could not load" : "Loading Batch Performance…"}
        </b>
        {error && (
          <>
            <p>{error}</p>
            <button onClick={() => load(selected)}>Retry Performance</button>
          </>
        )}
      </section>
    );
  const batches = (data.batchPerformance?.availableBatches || []).filter(
      (batch: any) => ["Active", "Overdue", "Completed"].includes(batch.status),
    ),
    master = data.masterPerformance || {},
    metric = (value: any) => Number(value || 0).toLocaleString();
  async function action(actionName: string, payload: any = {}) {
    setWorking(
      actionName === "approve_batch_learning"
        ? `${actionName}${payload.learningId || ""}`
        : actionName,
    );
    await fetch("/api/publishing", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId: p.id, action: actionName, ...payload }),
    });
    await load(selected);
    setWorking("");
  }
  return (
    <section className="project-batch-performance">
      <header>
        <div>
          <small>RECURRING PROJECT · BATCH HISTORY</small>
          <h3>Batch Performance & Learning</h3>
          <p>
            Choose a Batch to inspect its own publishing evidence and approved
            Learning. Project cumulative results stay separate below.
          </p>
        </div>
        <span>
          {batches.length} Batch{batches.length === 1 ? "" : "es"}
        </span>
      </header>
      <div className="batch-history-selector">
        <label>
          <span>View Batch</span>
          <select
            value={selected || ""}
            onChange={(event) => {
              ++requestVersion.current;
              setData(null);
              setSelected(Number(event.target.value));
            }}
          >
            {batches.map((batch: any) => (
              <option value={batch.id} key={batch.id}>
                Batch {String(batch.batchNumber).padStart(2, "0")} ·{" "}
                {batch.startsAt} → {batch.endsAt} · {batch.status}
                {batch.isCurrent ? " · Current" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>
      <BatchPerformanceLearningCard
        data={data}
        management={Boolean(data.canManage)}
        working={working}
        action={action}
      />
      <details className="master-performance-card">
        <summary>View project totals across all Batches</summary>
        <header>
          <div>
            <small>PROJECT PERFORMANCE · ALL BATCHES</small>
            <h4>Cumulative Performance & Learning</h4>
          </div>
          <span>
            {master.publishedCount || 0} published · {master.syncedCount || 0}{" "}
            synced
          </span>
        </header>
        <div className="project-performance-metrics">
          {[
            ["Views", master.totals?.views],
            ["Reach", master.totals?.reach],
            ["Engagement", master.totals?.engagement],
            ["Saves", master.totals?.saves],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <small>{label}</small>
              <b>{metric(value)}</b>
            </div>
          ))}
        </div>
        <div className="master-learning-grid">
          <div>
            <b>KEEP</b>
            <p>
              {master.learning?.keep?.join(" ") || "No approved Learning yet."}
            </p>
          </div>
          <div>
            <b>IMPROVE</b>
            <p>
              {master.learning?.improve?.join(" ") ||
                "No approved Learning yet."}
            </p>
          </div>
          <div>
            <b>TEST NEXT</b>
            <p>
              {master.learning?.testNext?.join(" ") ||
                "No approved Learning yet."}
            </p>
          </div>
        </div>
        <footer>
          Accumulated from this Project’s published records across all Batches.
          Only APPROVED / READY Learning is combined; other Projects are
          excluded.
        </footer>
      </details>
    </section>
  );
}

export default function CanonicalProjectWorkspace({
  p,
  tier,
  owner,
  back,
  act,
  deleteProject,
}: {
  p: any;
  tier: number;
  owner: boolean;
  back: () => void;
  act: (id: string, b: Record<string, string>) => void;
  deleteProject: (p: any) => void;
}) {
  const defaultBatch =
      selectSocialBatchLifecycle(p.batches || []).current ||
      [...(p.batches || [])]
        .reverse()
        .find((batch: any) => batch.status !== "Locked") ||
      null,
    initialSelectedBatchId =
      Number(p._selectedBatchId || defaultBatch?.id) || null,
    [step, setStep] = useState(() =>
      p._selectedBatchId &&
      Number(p._selectedBatchId) !== Number(defaultBatch?.id) &&
      !p._openPhase
        ? "publishing"
        : initialPhase(p),
    ),
    [selectedBatchId, setSelectedBatchId] = useState<number | null>(
      initialSelectedBatchId,
    ),
    op = operationalState(p);
  useEffect(() => {
    const allowed = new Set(
      workflowFor(p.projectType || p.type, p.projectMode, p.mvEntry).map(
        (phase) => phase.key,
      ),
    );
    if (
      step !== "assign" &&
      (!allowed.has(step) ||
        !p.phaseRecords?.some((x: any) => x.phaseKey === step))
    )
      setStep(initialPhase(p));
  }, [p.id, p.stage, step]);
  useEffect(() => {
    if (p._selectedBatchId) setSelectedBatchId(Number(p._selectedBatchId));
  }, [p._selectedBatchId, p.id]);
  const social = ["Internal Social Account", "Client Social Account"].includes(
      p.projectType || p.type,
    ),
    showBatchLifecycle =
      social ||
      (p.projectMode === "recurring" &&
        (p.projectType || p.type) !== "AI Reels"),
    selectedBatch =
      (p.batches || []).find(
        (batch: any) => Number(batch.id) === Number(selectedBatchId),
      ) || defaultBatch,
    browsingHistoricalBatch = Boolean(
      selectedBatch &&
      defaultBatch &&
      Number(selectedBatch.id) !== Number(defaultBatch.id),
    ),
    selectedProject = { ...p, _selectedBatchId: selectedBatchId };
  const selectBatch = (batchId: number) => {
    setSelectedBatchId(batchId);
    if (Number(batchId) !== Number(defaultBatch?.id)) setStep("publishing");
  };
  const batchAction = (action: string, batchId: number) => {
    if (action === "open") {
      setSelectedBatchId(batchId);
      setStep("batch-ideas");
      return;
    }
    if (action === "files") {
      setSelectedBatchId(batchId);
      setStep("publishing");
      return;
    }
    act(p.id, { action, batchId: String(batchId) });
  };
  return (
    <>
      <button className="back-btn" onClick={back}>
        ← Back to projects
      </button>
      <section className="detail-hero canonical-hero">
        <div>
          <p className="eyebrow">
            {p.id} · {p.projectType || p.type} ·{" "}
            {String(p.projectMode || "").replace("_", " ")}
          </p>
          <h2>{p.client}</h2>
          <p>{op.phase}</p>
          <div className="canonical-status">
            <span className={`operational-pill ${op.tone}`}>{op.status}</span>
            <span>{op.reason}</span>
            {p.phaseRecords?.some(
              (x: any) => x.phaseKey === "payment-status",
            ) && <span>Payment {Number(p.paymentPercentage || 0)}%</span>}
            {p.purpose && <span>{p.purpose}</span>}
          </div>
        </div>
        {owner && (
          <div className="project-owner-actions">
            {p.driveUrl && (
              <a
                className="open-folder prominent"
                href={p.driveUrl}
                target="_blank"
              >
                Open linked Drive folder ↗
              </a>
            )}
            <button className="delete-project" onClick={() => deleteProject(p)}>
              Delete Project
            </button>
          </div>
        )}
      </section>
      {showBatchLifecycle && (
        <RecurringBatchLifecycle
          p={p}
          social={social}
          selectedBatchId={selectedBatchId}
          onSelect={selectBatch}
          onAction={batchAction}
          management={tier <= 1}
        />
      )}
      <AgentProjectStatus p={p} />
      <div
        className={`drive-sync-note ${p.driveSyncStatus?.startsWith("Pending") ? "pending" : ""}`}
      >
        <b>One operational status</b>
        <span>
          {op.status} · {op.nextAction} · Drive:{" "}
          {p.driveSyncStatus || "Not connected"}
        </span>
      </div>
      {tier <= 1 &&
        (p.changeRequests || []).map((request: any) => (
          <div className="change-request-banner" key={request.id}>
            <div>
              <b>
                Change Request ·{" "}
                {
                  (p.phaseRecords || []).find(
                    (x: any) => x.phaseKey === request.phaseKey,
                  )?.label
                }
              </b>
              <span>{request.requestNote}</span>
            </div>
            <button
              onClick={() =>
                act(p.id, {
                  action: "decideChange",
                  requestId: String(request.id),
                  decision: "reject",
                })
              }
            >
              Reject
            </button>
            <button
              className="approve"
              onClick={() =>
                act(p.id, {
                  action: "decideChange",
                  requestId: String(request.id),
                  decision: "approve",
                })
              }
            >
              Approve reopening
            </button>
          </div>
        ))}
      <ProjectStructures p={p} tier={tier} act={act} />
      <ProjectPhaseBar p={p} current={step} onSelect={setStep} />
      <div className="project-tools-row single">
        <button type="button" onClick={() => setStep("assign")}>
          ⚙ Project Settings · Assign People
        </button>
        <span>
          {browsingHistoricalBatch
            ? `Viewing Batch ${String(selectedBatch?.batchNumber || "").padStart(2, "0")} history. Current production remains isolated in Batch ${String(defaultBatch?.batchNumber || "").padStart(2, "0")}.`
            : "Choose an available phase directly from the roadmap."}
        </span>
      </div>
      {browsingHistoricalBatch && step !== "publishing" ? (
        <section className="panel canonical-phase batch-history-boundary">
          <header>
            <div>
              <p className="eyebrow">BATCH HISTORY · READ ONLY</p>
              <h3>
                Batch{" "}
                {String(selectedBatch?.batchNumber || "").padStart(2, "0")}{" "}
                stays isolated
              </h3>
              <p>
                Current production phases belong to Batch{" "}
                {String(defaultBatch?.batchNumber || "").padStart(2, "0")}.
                Historical Task Files remain available without mixing current
                work into this Batch.
              </p>
            </div>
            <span className="phase-status-badge">
              {selectedBatch?.status || "History"}
            </span>
          </header>
          <footer>
            <button onClick={() => setStep("publishing")}>
              View Batch{" "}
              {String(selectedBatch?.batchNumber || "").padStart(2, "0")} Task
              Files
            </button>
            <button
              className="create-btn"
              onClick={() => {
                setSelectedBatchId(Number(defaultBatch?.id));
                setStep(initialPhase(p));
              }}
            >
              Return to Current Batch{" "}
              {String(defaultBatch?.batchNumber || "").padStart(2, "0")}
            </button>
          </footer>
        </section>
      ) : step === "client-brief" ? (
        <CanonicalBrief p={p} tier={tier} act={act} />
      ) : step === "assign" ? (
        <CanonicalAssign p={p} tier={tier} act={act} />
      ) : step === "video-slot-bank" ? null : step === "batch-learning" ? (
        <ProjectBatchPerformance p={p} />
      ) : (
        <CanonicalPhaseWorkspace
          p={selectedProject}
          phaseKey={step}
          tier={tier}
          act={act}
        />
      )}
    </>
  );
}

function RecurringBatchLifecycle({
  p,
  social,
  selectedBatchId,
  onSelect,
  onAction,
  management,
}: {
  p: any;
  social: boolean;
  selectedBatchId: number | null;
  onSelect: (id: number) => void;
  onAction: (action: string, id: number) => void;
  management: boolean;
}) {
  const batches = [...(p.batches || [])]
      .filter((batch: any) => batch.status !== "Locked")
      .sort((a: any, b: any) => Number(a.batchNumber) - Number(b.batchNumber)),
    { current, next } = selectSocialBatchLifecycle(batches),
    timeZone = p.projectConfig?.timezone || "Asia/Kuala_Lumpur",
    sequential = p.projectConfig?.batchOverlapMode === "SEQUENTIAL",
    selected =
      batches.find(
        (batch: any) => Number(batch.id) === Number(selectedBatchId),
      ) ||
      current ||
      batches.at(-1) ||
      null;
  const date = (value: string) =>
      value
        ? new Date(`${value}T00:00:00Z`).toLocaleDateString("en-MY", {
            timeZone,
            day: "2-digit",
            month: "short",
            year: "numeric",
          })
        : "—",
    planningStart = (value: string) => {
      const day = new Date(`${value}T00:00:00Z`);
      day.setUTCDate(day.getUTCDate() - 6);
      return day.toISOString().slice(0, 10);
    },
    today = (() => {
      const parts = new Intl.DateTimeFormat("en-GB", {
          timeZone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).formatToParts(new Date()),
        part = (type: string) =>
          parts.find((item) => item.type === type)?.value || "";
      return `${part("year")}-${part("month")}-${part("day")}`;
    })(),
    phase =
      current?.status === "Completed"
        ? `Batch ${String(current.batchNumber).padStart(2, "0")} Complete`
        : String(p.assignmentStage || p.stage || "In Progress").split(" · ")[0],
    nextPlanning = next ? planningStart(next.startsAt) : "",
    agentStatus = !next
      ? "Next Batch not created"
      : next.status === "Planning"
        ? "Planning window open"
        : today < nextPlanning
          ? `Scheduled · starts ${date(nextPlanning)}`
          : today < next.startsAt
            ? "Planning window open"
            : "Active",
    empty = selected && Number(selected.plannedCount || 0) === 0,
    overdue = selected?.status === "Overdue",
    workLocked = selected?.status === "Locked";
  return (
    <section className="social-batch-lifecycle batch-control-center">
      <header>
        <div>
          <small>
            {social
              ? "BATCH CONTROL CENTER"
              : "RECURRING PROJECT · BATCH CONTROL"}
          </small>
          <h3>Content Production Batches</h3>
        </div>
        <span>{timeZone}</span>
      </header>
      <div className="batch-switcher" role="tablist" aria-label="Choose Batch">
        {batches.map((batch: any) => (
          <button
            role="tab"
            aria-selected={Number(batch.id) === Number(selected?.id)}
            className={
              Number(batch.id) === Number(selected?.id) ? "selected" : ""
            }
            key={batch.id}
            onClick={() => onSelect(Number(batch.id))}
          >
            <small>Batch {String(batch.batchNumber).padStart(2, "0")}</small>
            <b>{batch.status}</b>
            <span>{`${Number(batch.plannedCount || 0)} ${Number(batch.plannedCount || 0) === 1 ? "item" : "items"}`}</span>
          </button>
        ))}
      </div>
      {selected ? (
        <div className={`selected-batch-summary ${overdue ? "overdue" : ""}`}>
          <div>
            <small>SELECTED BATCH</small>
            <h4>
              Batch {String(selected.batchNumber).padStart(2, "0")} ·{" "}
              {selected.status}
            </h4>
            <p>{`${date(selected.startsAt)} → ${date(selected.endsAt)} · ${Number(selected.plannedCount || 0)} ${Number(selected.plannedCount || 0) === 1 ? "planned item" : "planned items"}`}</p>
          </div>
          <div>
            <small>CURRENT WORK</small>
            <b>
              {Number(selected.id) === Number(current?.id)
                ? phase
                : selected.gateStatus || selected.status}
            </b>
            <span>
              {selected.deadlineReminder ||
                "Batch records stay isolated from every other Batch."}
            </span>
          </div>
          <div className="batch-quick-actions">
            <button
              disabled={workLocked}
              onClick={() => onAction("open", Number(selected.id))}
            >
              {workLocked
                ? "Batch work locked"
                : empty
                  ? "Add Content Item"
                  : "Open Batch work"}
            </button>
            <button onClick={() => onAction("files", Number(selected.id))}>
              View Task Files
            </button>
            {management && overdue && !empty && (
              <button
                onClick={() => onAction("extendBatch", Number(selected.id))}
              >
                Extend 7 days
              </button>
            )}
            {management &&
              empty &&
              !["Completed", "Locked"].includes(selected.status) && (
                <button
                  className="quiet-danger"
                  onClick={() => {
                    if (
                      confirm(
                        `Close empty Batch ${String(selected.batchNumber).padStart(2, "0")}? This keeps its history but marks it Completed.`,
                      )
                    )
                      onAction("closeEmptyBatch", Number(selected.id));
                  }}
                >
                  Close empty Batch
                </button>
              )}
          </div>
        </div>
      ) : (
        <div className="batch-lifecycle-empty">
          <b>No Batch is available</b>
          <span>Create the first Batch to start production.</span>
        </div>
      )}
      {next && (
        <div className="batch-next-note">
          <b>Upcoming Batch {String(next.batchNumber).padStart(2, "0")}</b>
          <span>
            {date(next.startsAt)} → {date(next.endsAt)} ·{" "}
            {sequential && current?.status !== "Completed"
              ? "Locked until current Batch completes"
              : agentStatus}
          </span>
        </div>
      )}
    </section>
  );
}
function ProjectStructures({
  p,
  tier,
  act,
}: {
  p: any;
  tier: number;
  act: (id: string, b: Record<string, string>) => void;
}) {
  if (
    ["Internal Social Account", "Client Social Account"].includes(p.projectType)
  )
    return null;
  if (
    !p.videoSlots?.length &&
    !p.cycles?.length &&
    !p.outstandingContent?.length
  )
    return null;
  return (
    <section className="project-structures">
      {p.videoSlots?.length > 0 && (
        <VideoSlotBank p={p} tier={tier} act={act} />
      )}{" "}
      {p.projectType === "AI Reels" && p.projectMode === "recurring" ? (
        <ReelsRecurringOverview p={p} />
      ) : (
        p.cycles?.length > 0 && (
          <div>
            <header>
              <b>Production Cycle</b>
              <span>{p.cycles[0].status}</span>
            </header>
            <p>
              {p.cycles[0].startsAt} → {p.cycles[0].endsAt || "Continuous"}
            </p>
          </div>
        )
      )}
    </section>
  );
}
function ReelsRecurringOverview({ p }: { p: any }) {
  const cycle = p.cycles?.[0],
    batches = (p.batches || [])
      .filter((x: any) => !cycle || x.cycleId === cycle.id)
      .sort((a: any, b: any) => a.batchNumber - b.batchNumber),
    current =
      batches.find((x: any) => x.status === "Active") ||
      batches.find((x: any) => x.status !== "Completed"),
    next = batches.find(
      (x: any) => current && x.batchNumber > current.batchNumber,
    ),
    count = Math.max(
      1,
      Number(p.frequencyCount || cycle?.configuration?.frequencyCount || 1),
    ),
    unit = String(
      p.frequencyUnit || cycle?.configuration?.frequencyUnit || "month",
    ),
    monthly = Number(
      cycle?.configuration?.monthlyCommitment ||
        batches.reduce(
          (sum: number, x: any) => sum + Number(x.plannedCount || 0),
          0,
        ),
    );
  return (
    <div className="reels-cycle-overview">
      <header>
        <div>
          <small>PROJECT CONFIGURATION</small>
          <b>Recurring AI Reels</b>
        </div>
        <span>{cycle?.status || p.projectStatus}</span>
      </header>
      {current?.deadlineReminder && (
        <div
          className={`batch-deadline-alert ${current.status === "Overdue" ? "overdue" : ""}`}
        >
          <b>Current Batch · {current.deadlineReminder}</b>
          <span>
            Complete and submit its current work before the deadline. Overdue
            reminders remain visible daily.
          </span>
        </div>
      )}
      <div className="reels-config-grid">
        <div>
          <small>Frequency</small>
          <strong>
            {count} Reel{count === 1 ? "" : "s"} / {unit}
          </strong>
        </div>
        <div>
          <small>Monthly commitment</small>
          <strong>
            {monthly || count} Reel{(monthly || count) === 1 ? "" : "s"}
          </strong>
        </div>
        <div>
          <small>Production rhythm</small>
          <strong>2 × 2-Week Batches</strong>
        </div>
        <div>
          <small>Current cycle</small>
          <strong>
            {cycle?.startsAt || "—"} → {cycle?.endsAt || "—"}
          </strong>
        </div>
      </div>
      <div className="reels-batch-status">
        <div className="reels-batch-title">
          <b>Monthly Cycle & Batch Status</b>
          <span>
            Each Batch opens automatically on its start date. All Idea / Hook /
            Story items must pass the Batch Gate before production.
          </span>
        </div>
        {batches.map((batch: any) => (
          <article
            className={
              batch.id === current?.id
                ? "current"
                : batch.id === next?.id
                  ? "next"
                  : ""
            }
            key={batch.id}
          >
            <div className="batch-number">
              <span>{String(batch.batchNumber).padStart(2, "0")}</span>
              <div>
                <b>Batch {batch.batchNumber}</b>
                <small>
                  {batch.startsAt} → {batch.endsAt}
                </small>
              </div>
            </div>
            <div>
              <small>Planned output</small>
              <strong>
                {Number(batch.plannedCount || 0)} Reel
                {Number(batch.plannedCount || 0) === 1 ? "" : "s"}
              </strong>
            </div>
            <div>
              <small>Batch status</small>
              <strong>{batch.status}</strong>
              {batch.deadlineReminder && (
                <small className="batch-deadline-text">
                  {batch.deadlineReminder}
                </small>
              )}
            </div>
            <div>
              <small>Idea Gate</small>
              <strong>{batch.gateStatus}</strong>
            </div>
            <em>
              {batch.id === current?.id
                ? "Current"
                : batch.id === next?.id
                  ? "Scheduled"
                  : batch.status === "Overdue"
                    ? "Overdue"
                    : ""}
            </em>
          </article>
        ))}
      </div>
    </div>
  );
}
function VideoSlotBank({
  p,
  tier,
  act,
}: {
  p: any;
  tier: number;
  act: (id: string, b: Record<string, string>) => void;
}) {
  const researchApproved =
    (p.phaseRecords || []).find((x: any) => x.phaseKey === "market-research")
      ?.status === "Approved";
  const first =
    (p.videoSlots || []).find((s: any) => s.id === p._openSlotId) ||
    (p.videoSlots || []).find(
      (s: any) => s.status === "Active" && s.phaseStatus !== "Approved",
    ) ||
    (researchApproved
      ? (p.videoSlots || []).find((s: any) => s.status === "Available")
      : null);
  const [open, setOpen] = useState<number | null>(first?.id || null),
    [views, setViews] = useState<Record<number, string>>({}),
    [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({}),
    [uploads, setUploads] = useState<Record<string, any[]>>(() =>
      Object.fromEntries(
        (p.videoSlots || []).flatMap((slot: any) =>
          Array.from(
            new Set(
              (slot.keyshotAssets || []).map((asset: any) => asset.itemKey),
            ),
          ).map((itemKey: any) => [
            `${slot.id}-${itemKey}`,
            (slot.keyshotAssets || []).filter(
              (asset: any) => asset.itemKey === itemKey,
            ),
          ]),
        ),
      ),
    ),
    [uploadState, setUploadState] = useState<Record<string, string>>({});
  const flow = [
      { key: "creativeDirection", label: "Creative Direction" },
      { key: "script", label: "Script · Client Review" },
      { key: "keyshots", label: "Keyshot Image Set · Client Review" },
      { key: "videoGeneration", label: "Video Generation" },
      { key: "finalVideo", label: "Final Video · Client Review" },
      { key: "finalDelivery", label: "Final Delivery" },
    ],
    directionFields = [
      "Creative concept",
      "Audience response goal",
      "Core communication problem",
      "Selected audience tension / desire",
      "Selected market opportunity",
      "Creative proposition",
      "Story approach",
      "Visual language",
      "Tone, mood and pacing",
      "Execution rules",
      "Continuity requirements",
      "Production boundaries",
      "Reason this direction fits",
    ],
    scriptFields = [
      "Title",
      "Premise",
      "Opening hook",
      "Audience situation / tension",
      "Story outline",
      "Narrative flow",
      "Turning point",
      "Ending / payoff",
      "CTA",
      "Dialogue / voice-over",
      "Meaning",
      "Client-facing rationale",
      "Required characters",
      "Required environments",
      "Required props",
      "Important wardrobe / product requirements",
      "Continuity notes",
      "Production complexity notes",
    ];
  const key = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
  const phase = (slot: any, name: string) =>
    slot.data?.phases?.[name] || {
      status: name === "creativeDirection" ? "In Progress" : "Locked",
      content: {},
    };
  const phaseIndex = (slot: any) => {
    const phases = slot.data?.phases || {};
    if (phases.keyshots?.status && phases.keyshots.status !== "Locked")
      return 2;
    if (phases.script?.status && phases.script.status !== "Locked") return 1;
    return 0;
  };
  const selected = (slot: any) => views[slot.id] || flow[phaseIndex(slot)].key;
  const content = (slot: any, name: string) =>
    drafts[`${slot.id}-${name}`] || phase(slot, name).content || {};
  const update = (slot: any, name: string, field: string, value: string) =>
    setDrafts((x) => ({
      ...x,
      [`${slot.id}-${name}`]: { ...content(slot, name), [field]: value },
    }));
  const send = (
    slot: any,
    name: string,
    submit = false,
    extra: Record<string, string> = {},
  ) =>
    act(p.id, {
      action:
        name === "script"
          ? submit
            ? "submitVideoSlotScript"
            : "saveVideoSlotScript"
          : submit
            ? "submitVideoSlotCreativeDirection"
            : "saveVideoSlotCreativeDirection",
      slotId: String(slot.id),
      slotPhase: name,
      payload: JSON.stringify(content(slot, name)),
      ...extra,
    });
  function autofill(slot: any, name: string) {
    if (name === "creativeDirection") {
      const brief =
          (p.approvedSnapshots || [])
            .filter((x: any) => x.phaseKey === "client-brief")
            .at(-1)?.approvedContent || {},
        research =
          (p.approvedSnapshots || [])
            .filter((x: any) => x.phaseKey === "market-research")
            .at(-1)?.approvedContent || {};
      const d: any = {
        creative_concept: `A focused ${slot.purpose} concept translating ${brief.keyMessage || p.keyMessage || "the approved message"} into one clear visual promise.`,
        audience_response_goal:
          "Create immediate understanding, emotional engagement and strong recall.",
        core_communication_problem:
          brief.projectGoal ||
          p.projectGoal ||
          "Express the approved project goal clearly.",
        selected_audience_tension_desire:
          research.audience_insight ||
          research.audience_tensions_desires ||
          "Use the strongest approved audience tension.",
        selected_market_opportunity:
          research.current_opportunities ||
          "Use the approved market opportunity.",
        creative_proposition:
          "Move the audience from the approved tension toward the desired outcome through a visible transformation.",
        story_approach:
          "Immediate hook, recognisable tension, purposeful transformation and memorable payoff.",
        visual_language:
          "Premium commercial imagery with controlled hierarchy, colour and continuity.",
        tone_mood_and_pacing:
          brief.tone || p.tone || "Confident, cinematic and clear.",
        execution_rules:
          "Keep every scene relevant; avoid unsupported claims and filler.",
        continuity_requirements:
          "Preserve identity, wardrobe, environment, product, colour and lighting continuity.",
        production_boundaries:
          "Use the minimum necessary characters, environments and props.",
        reason_this_direction_fits:
          "Builds on the approved Brief and Market Research for this Slot.",
        _generationMethod: "Rule-based Autofill",
        _formulaId: "FF-02-DIRECTION",
        _formulaVersion: "1.0",
      };
      d._originalGeneratedDraft = { ...d };
      setDrafts((x) => ({ ...x, [`${slot.id}-${name}`]: d }));
    } else {
      const d = phase(slot, "creativeDirection").content || {},
        s: any = {
          title: `${slot.purpose} — ${d.creative_concept || "Approved Concept"}`,
          premise:
            d.creative_proposition ||
            d.creative_concept ||
            "Approved creative proposition",
          opening_hook:
            "Open on a visually distinctive moment that makes the audience tension immediately understandable.",
          audience_situation_tension:
            d.selected_audience_tension_desire || "Approved audience tension",
          story_outline:
            "Establish the situation, reveal the meaningful catalyst, progress through cause and effect, then resolve with a clear payoff.",
          narrative_flow:
            "Hook → tension → development → turning point → hero payoff → ending.",
          turning_point:
            "The approved proposition becomes tangible through a visible change.",
          ending_payoff:
            "Resolve on the strongest brand or product image and intended audience feeling.",
          cta: "Use the approved CTA only where appropriate.",
          dialogue_voice_over:
            "Prefer visual storytelling; use only essential dialogue or voice-over.",
          meaning:
            d.reason_this_direction_fits ||
            "Demonstrates why the proposition matters.",
          client_facing_rationale: `Fits ${p.projectDuration || "the confirmed duration"} and remains executable for AI production.`,
          required_characters: "Minimum required by the story.",
          required_environments: "Minimum required by the story.",
          required_props: "Only story-critical props or product.",
          important_wardrobe_product_requirements:
            d.continuity_requirements || "Preserve approved continuity.",
          continuity_notes:
            d.continuity_requirements ||
            "Preserve continuity across every visual state.",
          production_complexity_notes:
            d.production_boundaries || "Avoid unnecessary complexity.",
          _generationMethod: "Rule-based Autofill",
          _formulaId: "FF-03-VIDEO-SCRIPT",
          _formulaVersion: "1.0",
        };
      s._originalGeneratedDraft = { ...s };
      setDrafts((x) => ({ ...x, [`${slot.id}-${name}`]: s }));
    }
  }
  function extractKeyshots(slot: any) {
    const s = phase(slot, "script").content || {},
      beats = [
        s.opening_hook,
        s.story_outline,
        s.turning_point,
        s.ending_payoff,
      ].filter(Boolean),
      result: any = {};
    beats.forEach(
      (beat: string, i: number) =>
        (result[`keyshot_${String(i + 1).padStart(2, "0")}`] =
          `STORY BEAT: ${beat}\nVISUAL PURPOSE: Preserve this decisive story state.\nCHARACTERS / ACTION / EXPRESSION: Derive only from the approved Script; do not invent additional cast.\nENVIRONMENT / PROPS / WARDROBE: Maintain approved continuity.\nCAMERA: Choose framing, camera angle and lens that best communicates this beat.\nCOMPOSITION: Establish clear foreground, midground and background relationships.\nLIGHTING / COLOUR / MOOD: Follow the approved Creative Direction.\nGENERATION PROMPT: Create one independent cinematic keyshot image for this exact beat, not a collage, grid, split screen or contact sheet. Preserve character identity, wardrobe, environment, product and lighting continuity.\nWHY NECESSARY: This image anchors an essential change in the approved story.`),
    );
    setDrafts((x) => ({ ...x, [`${slot.id}-keyshots`]: result }));
  }
  async function loadFiles(slot: any, itemKey: string) {
    const id = `${slot.id}-${itemKey}`;
    try {
      const r = await fetch(
          `/api/uploads?projectId=${encodeURIComponent(p.id)}&phase=${encodeURIComponent(`video-slot-${slot.slotNumber}-keyshots`)}&itemKey=${encodeURIComponent(itemKey)}`,
        ),
        d = await r.json();
      if (!r.ok) throw new Error(d.error || "Unable to load images");
      setUploads((x) => ({ ...x, [id]: d.assets || [] }));
      setUploadState((x) => ({ ...x, [id]: "" }));
    } catch (error: any) {
      setUploadState((x) => ({
        ...x,
        [id]: error.message || "Unable to load images",
      }));
    }
  }
  async function upload(slot: any, itemKey: string, files: FileList | null) {
    if (!files?.length) return;
    const id = `${slot.id}-${itemKey}`;
    setUploadState((x) => ({
      ...x,
      [id]: `Uploading ${files.length} image${files.length === 1 ? "" : "s"}…`,
    }));
    try {
      for (const file of Array.from(files)) {
        const f = new FormData();
        f.set("file", file);
        f.set("projectId", p.id);
        f.set("phase", `video-slot-${slot.slotNumber}-keyshots`);
        f.set("itemKey", itemKey);
        const r = await fetch("/api/uploads", { method: "POST", body: f }),
          d = await r.json();
        if (!r.ok) throw new Error(d.error || `Unable to upload ${file.name}`);
      }
      await loadFiles(slot, itemKey);
      setUploadState((x) => ({ ...x, [id]: "Upload complete" }));
    } catch (error: any) {
      setUploadState((x) => ({
        ...x,
        [id]: error.message || "Unable to upload image",
      }));
    }
  }
  return (
    <div className="video-slot-bank slot-bank-v2">
      <header>
        <div>
          <b>Video Slot Bank</b>
          <small>
            Brief and Market Research are shared. Open a Slot to work through
            its independent phases.
          </small>
        </div>
        <span>
          {p.videoSlots.filter((x: any) => x.status === "Available").length}{" "}
          available
        </span>
      </header>
      {!researchApproved && (
        <div className="slot-gate-note">
          Market Research must receive ✅ before any Slot Creative Direction can
          begin.
        </div>
      )}
      <div className="slot-list">
        {p.videoSlots.map((slot: any) => {
          const idx = phaseIndex(slot),
            view = selected(slot),
            current = phase(slot, view),
            fields =
              view === "creativeDirection"
                ? directionFields
                : view === "script"
                  ? scriptFields
                  : [],
            editable = ![
              "Reviewing",
              "Client Reviewing",
              "Approved",
              "Locked",
            ].includes(current.status),
            keyshotEntries = Object.entries(content(slot, "keyshots")).filter(
              ([k]) => /^keyshot_\d+$/.test(k),
            );
          return (
            <article className={open === slot.id ? "open" : ""} key={slot.id}>
              <button
                className="slot-summary"
                onClick={() => setOpen(open === slot.id ? null : slot.id)}
              >
                <strong>Slot {String(slot.slotNumber).padStart(2, "0")}</strong>
                <small>{slot.purpose || "Select Purpose to activate"}</small>
                <span>{phase(slot, flow[idx].key).status || slot.status}</span>
                <i>{open === slot.id ? "−" : "+"}</i>
              </button>
              {open === slot.id && (
                <div className="slot-detail">
                  {slot.status === "Available" &&
                    tier <= 1 &&
                    researchApproved && (
                      <div className="slot-purpose">
                        <b>Choose this video’s Purpose</b>
                        {[
                          "Commercial Video",
                          "Brand Film",
                          "Product Intro",
                          "Other",
                        ].map((x) => (
                          <button
                            key={x}
                            onClick={() =>
                              act(p.id, {
                                action: "configureVideoSlot",
                                slotId: String(slot.id),
                                purpose: x,
                              })
                            }
                          >
                            {x}
                          </button>
                        ))}
                      </div>
                    )}
                  <div className="slot-flow interactive">
                    {flow.map((x, i) => {
                      const ph = phase(slot, x.key),
                        available = i <= idx || ph.status === "Approved";
                      return (
                        <button
                          disabled={!available}
                          className={
                            ph.status === "Approved"
                              ? "done"
                              : i === idx
                                ? "current"
                                : "locked"
                          }
                          onClick={() =>
                            setViews((v) => ({ ...v, [slot.id]: x.key }))
                          }
                          key={x.key}
                        >
                          <b>
                            {ph.status === "Approved"
                              ? "✓"
                              : String(i + 1).padStart(2, "0")}
                          </b>
                          {x.label}
                        </button>
                      );
                    })}
                  </div>
                  {slot.status === "Active" &&
                    ["creativeDirection", "script"].includes(view) && (
                      <section className="slot-creative-workspace">
                        <header>
                          <div>
                            <small>
                              SLOT {String(slot.slotNumber).padStart(2, "0")} ·{" "}
                              {slot.purpose}
                            </small>
                            <h3>{flow.find((x) => x.key === view)?.label}</h3>
                          </div>
                          <span>{current.status}</span>
                        </header>
                        {editable && (
                          <div className="phase-autofill-note">
                            <div>
                              <b>Rule-based Autofill</b>
                              <small>
                                Uses the latest Approved upstream context;
                                remains editable.
                              </small>
                            </div>
                            <button onClick={() => autofill(slot, view)}>
                              ✦ Autofill{" "}
                              {view === "script"
                                ? "Script"
                                : "Creative Direction"}
                            </button>
                          </div>
                        )}
                        <div className="slot-creative-grid">
                          {fields.map((label) => (
                            <label key={label}>
                              <b>{label}</b>
                              <textarea
                                disabled={!editable}
                                value={content(slot, view)[key(label)] || ""}
                                onChange={(e) =>
                                  update(slot, view, key(label), e.target.value)
                                }
                              />
                            </label>
                          ))}
                        </div>
                        {editable && (
                          <footer>
                            <button onClick={() => send(slot, view)}>
                              Save draft
                            </button>
                            <button
                              className="create-btn"
                              onClick={() => send(slot, view, true)}
                            >
                              Submit for Internal Review →
                            </button>
                          </footer>
                        )}
                        {current.status === "Reviewing" && tier <= 1 && (
                          <div className="slot-review-actions">
                            <button
                              className="revise"
                              onClick={() => {
                                const reviewNote = prompt(
                                  "What needs to be refined?",
                                );
                                if (reviewNote)
                                  act(p.id, {
                                    action: "reviewVideoSlotCreativeDirection",
                                    slotId: String(slot.id),
                                    slotPhase: view,
                                    decision: "retake",
                                    reviewNote,
                                  });
                              }}
                            >
                              × Retake
                            </button>
                            <button
                              className="approve"
                              onClick={() =>
                                act(p.id, {
                                  action: "reviewVideoSlotCreativeDirection",
                                  slotId: String(slot.id),
                                  slotPhase: view,
                                  decision: "approve",
                                })
                              }
                            >
                              ✓{" "}
                              {view === "script"
                                ? "Internal approve & create client link"
                                : "Approve"}
                            </button>
                          </div>
                        )}
                        {current.externalReviewUrl && (
                          <div className="client-review-ready">
                            <div>
                              <b>Client Review Link</b>
                              <small>
                                {current.status === "Client Reviewing"
                                  ? "Waiting for client decision"
                                  : "Previous review record"}
                              </small>
                            </div>
                            <a
                              href={current.externalReviewUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Open / share review link ↗
                            </a>
                          </div>
                        )}
                        {current.reviewNote && (
                          <div className="retake-note">
                            <b>Review feedback</b>
                            <p>{current.reviewNote}</p>
                          </div>
                        )}
                        {current.status === "Approved" && (
                          <div className="approved-change">
                            <b>✓ Approved Slot phase</b>
                            <button
                              onClick={() => {
                                const requestNote = prompt(
                                  "Describe the requested change",
                                );
                                if (requestNote)
                                  act(p.id, {
                                    action: "saveVideoSlotCreativeDirection",
                                    slotId: String(slot.id),
                                    slotPhase: "change-request",
                                    targetPhase: view,
                                    requestNote,
                                  });
                              }}
                            >
                              Request Change
                            </button>
                          </div>
                        )}
                      </section>
                    )}
                  {slot.status === "Active" && view === "keyshots" && (
                    <section className="slot-creative-workspace keyshot-slot-workspace">
                      <header>
                        <div>
                          <small>APPROVED SCRIPT SOURCE</small>
                          <h3>Keyshot Image Set · Client Review</h3>
                        </div>
                        <span>{current.status}</span>
                      </header>
                      <div className="keyshot-story-source">
                        <small>STORYTELLING SOURCE</small>
                        <h4>
                          {phase(slot, "script").content?.title ||
                            "Approved Slot Script"}
                        </h4>
                        <p>
                          {phase(slot, "script").content?.narrative_flow ||
                            phase(slot, "script").content?.story_outline}
                        </p>
                      </div>
                      {editable && (
                        <div className="phase-autofill-note">
                          <div>
                            <b>Minimum Sufficient Keyshots</b>
                            <small>
                              Extracts decisive visual states only, not a
                              storyboard grid.
                            </small>
                          </div>
                          <button onClick={() => extractKeyshots(slot)}>
                            ✦ Extract Keyshot prompts
                          </button>
                        </div>
                      )}
                      <div className="slot-keyshot-list">
                        {keyshotEntries.map(([itemKey, value], i) => (
                          <article key={itemKey}>
                            <header>
                              <b>Keyshot {String(i + 1).padStart(2, "0")}</b>
                              <button
                                disabled={!editable}
                                onClick={() =>
                                  setDrafts((x) => ({
                                    ...x,
                                    [`${slot.id}-keyshots`]: Object.fromEntries(
                                      Object.entries(
                                        content(slot, "keyshots"),
                                      ).filter(([k]) => k !== itemKey),
                                    ),
                                  }))
                                }
                              >
                                Remove
                              </button>
                            </header>
                            <textarea
                              disabled={!editable}
                              value={String(value)}
                              onChange={(e) =>
                                update(
                                  slot,
                                  "keyshots",
                                  itemKey,
                                  e.target.value,
                                )
                              }
                            />
                            <label className="mini-upload">
                              ＋ Upload multiple images
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                disabled={!editable}
                                onChange={(e) =>
                                  upload(slot, itemKey, e.target.files)
                                }
                              />
                            </label>
                            <button
                              className="load-images"
                              onClick={() => loadFiles(slot, itemKey)}
                            >
                              View uploaded images
                            </button>
                            <div className="mini-files">
                              {(uploads[`${slot.id}-${itemKey}`] || []).map(
                                (file) => (
                                  <a
                                    key={file.id}
                                    target="_blank"
                                    href={`/api/uploads?file=${encodeURIComponent(file.storageKey)}`}
                                  >
                                    {file.fileName}
                                  </a>
                                ),
                              )}
                            </div>
                          </article>
                        ))}
                      </div>
                      {editable && (
                        <footer>
                          <button
                            onClick={() => {
                              const n = keyshotEntries.length + 1;
                              update(
                                slot,
                                "keyshots",
                                `keyshot_${String(n).padStart(2, "0")}`,
                                "",
                              );
                            }}
                          >
                            ＋ Add Keyshot
                          </button>
                          <button onClick={() => send(slot, "keyshots")}>
                            Save draft
                          </button>
                          <button
                            className="create-btn"
                            onClick={() => send(slot, "keyshots", true)}
                          >
                            Submit for Internal Review →
                          </button>
                        </footer>
                      )}
                      {current.status === "Reviewing" && tier <= 1 && (
                        <div className="slot-review-actions">
                          <button
                            className="revise"
                            onClick={() => {
                              const reviewNote = prompt(
                                "Which Keyshot needs refinement?",
                              );
                              if (reviewNote)
                                act(p.id, {
                                  action: "reviewVideoSlotCreativeDirection",
                                  slotId: String(slot.id),
                                  slotPhase: "keyshots",
                                  decision: "retake",
                                  reviewNote,
                                });
                            }}
                          >
                            × Retake
                          </button>
                          <button
                            className="approve"
                            onClick={() =>
                              act(p.id, {
                                action: "reviewVideoSlotCreativeDirection",
                                slotId: String(slot.id),
                                slotPhase: "keyshots",
                                decision: "approve",
                              })
                            }
                          >
                            ✓ Internal approve & create client link
                          </button>
                        </div>
                      )}
                      {current.externalReviewUrl && (
                        <div className="client-review-ready">
                          <div>
                            <b>Keyshot Client Review Link</b>
                            <small>Active for 3 days</small>
                          </div>
                          <a href={current.externalReviewUrl} target="_blank">
                            Open / share review link ↗
                          </a>
                        </div>
                      )}
                    </section>
                  )}
                  {slot.status === "Active" &&
                    !["creativeDirection", "script", "keyshots"].includes(
                      view,
                    ) && (
                      <div className="slot-future-phase">
                        <b>{flow.find((x) => x.key === view)?.label}</b>
                        <span>
                          This production phase remains locked until the
                          approved Keyshot set. Video Generation automation is
                          intentionally not implemented yet.
                        </span>
                      </div>
                    )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
function VideoSlotBankLegacy({
  p,
  tier,
  act,
}: {
  p: any;
  tier: number;
  act: (id: string, b: Record<string, string>) => void;
}) {
  const [open, setOpen] = useState<number | null>(
      p._openSlotId ||
        (p.videoSlots || []).find(
          (s: any) => s.status === "Active" && s.phaseStatus !== "Approved",
        )?.id ||
        null,
    ),
    [directionDrafts, setDirectionDrafts] = useState<
      Record<number, Record<string, string>>
    >({}),
    [scriptDrafts, setScriptDrafts] = useState<
      Record<number, Record<string, string>>
    >({});
  const flow = [
      "Creative Direction",
      "Script · Client Review",
      "Keyshot Image Set · Client Review",
      "Video Generation",
      "Final Video · Client Review",
      "Final Delivery",
    ],
    directionFields = [
      "Creative concept",
      "Audience response goal",
      "Core communication problem",
      "Selected audience tension / desire",
      "Selected market opportunity",
      "Creative proposition",
      "Story approach",
      "Visual language",
      "Tone, mood and pacing",
      "Execution rules",
      "Continuity requirements",
      "Production boundaries",
      "Reason this direction fits",
    ],
    scriptFields = [
      "Title",
      "Premise",
      "Opening hook",
      "Audience situation / tension",
      "Story outline",
      "Narrative flow",
      "Turning point",
      "Ending / payoff",
      "CTA",
      "Dialogue / voice-over",
      "Meaning",
      "Client-facing rationale",
      "Required characters",
      "Required environments",
      "Required props",
      "Important wardrobe / product requirements",
      "Continuity notes",
      "Production complexity notes",
    ];
  const key = (label: string) =>
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
  const snapshot = (phaseKey: string) =>
    (p.approvedSnapshots || [])
      .filter((x: any) => x.phaseKey === phaseKey)
      .at(-1)?.approvedContent || {};
  function directionContent(slot: any) {
    return (
      directionDrafts[slot.id] ||
      slot.data?.phases?.creativeDirection?.content ||
      {}
    );
  }
  function scriptContent(slot: any) {
    return scriptDrafts[slot.id] || slot.data?.phases?.script?.content || {};
  }
  function updateDirection(slot: any, name: string, value: string) {
    setDirectionDrafts((x) => ({
      ...x,
      [slot.id]: { ...directionContent(slot), [name]: value },
    }));
  }
  function updateScript(slot: any, name: string, value: string) {
    setScriptDrafts((x) => ({
      ...x,
      [slot.id]: { ...scriptContent(slot), [name]: value },
    }));
  }
  function send(
    slot: any,
    action: string,
    kind: "direction" | "script",
    extra: Record<string, string> = {},
  ) {
    act(p.id, {
      action,
      slotId: String(slot.id),
      payload: JSON.stringify(
        kind === "direction" ? directionContent(slot) : scriptContent(slot),
      ),
      ...extra,
    });
  }
  function autofillDirection(slot: any) {
    const brief = snapshot("client-brief"),
      research = snapshot("market-research"),
      purpose = slot.purpose || "video";
    const generated: any = {
      creative_concept: `A focused ${purpose} concept that turns ${brief.keyMessage || brief.key_message || p.keyMessage || "the approved key message"} into a clear visual promise for ${brief.audience || p.audience || "the approved audience"}.`,
      audience_response_goal: `Make the audience quickly understand the value, feel emotionally engaged and remember the central brand promise.`,
      core_communication_problem: `Translate ${brief.projectGoal || brief.project_goal || p.projectGoal || "the approved project goal"} into one simple visual idea without losing clarity.`,
      selected_audience_tension_desire:
        research.audienceTensionsDesires ||
        research.audience_tensions_desires ||
        research.audienceInsight ||
        "Use the strongest approved audience need documented in Market Research.",
      selected_market_opportunity:
        research.currentOpportunities ||
        research.current_opportunities ||
        "Use the clearest approved market opportunity without inventing unsupported claims.",
      creative_proposition: `Show how the brand or product meaningfully moves the audience from its present tension toward the desired outcome.`,
      story_approach: `A concise visual cause-and-effect story: immediate hook, recognisable tension, purposeful transformation and a memorable payoff.`,
      visual_language: `Premium, intentional commercial imagery with a controlled palette, readable subject hierarchy and consistent product/brand presentation.`,
      tone_mood_and_pacing:
        brief.tone ||
        p.tone ||
        "Confident, cinematic and clear, with pacing appropriate to the confirmed duration.",
      execution_rules: `Keep every scene relevant to the single proposition. Avoid generic filler, unsupported claims and unnecessary production complexity.`,
      continuity_requirements: `Preserve character identity, wardrobe, environment, product appearance, colour language and lighting logic across the video.`,
      production_boundaries: `Work within the approved deliverables, restrictions and duration. Use the minimum necessary characters, environments and props.`,
      reason_this_direction_fits: `It mechanically inherits the approved Brief and Research constraints while creating the decisions needed for this Slot’s ${purpose}.`,
      _generationMethod: "Rule-based Autofill",
      _formulaId: "FF-02-DIRECTION",
      _formulaVersion: "1.0",
    };
    generated._originalGeneratedDraft = { ...generated };
    setDirectionDrafts((x) => ({ ...x, [slot.id]: generated }));
  }
  function autofillScript(slot: any) {
    const d = slot.data?.phases?.creativeDirection?.content || {},
      duration = p.projectDuration || "the confirmed duration";
    const generated: any = {
      title: `${slot.purpose || "Video"} — ${d.creative_concept || "Approved Concept"}`,
      premise: `A concise visual story that expresses the approved proposition: ${d.creative_proposition || d.creative_concept || "the approved Creative Direction"}.`,
      opening_hook: `Open immediately on a visually distinctive moment that makes the approved audience tension understandable without explanation.`,
      audience_situation_tension:
        d.selected_audience_tension_desire ||
        "Use the approved audience tension from Creative Direction.",
      story_outline: `Introduce the audience situation, reveal the brand or product as the meaningful catalyst, then progress to a clear transformation and payoff.`,
      narrative_flow: `Hook → recognisable tension → visual cause and effect → turning point → hero payoff → concise ending.`,
      turning_point: `The audience sees the approved proposition become tangible through an observable change in action, environment or outcome.`,
      ending_payoff: `Resolve on the strongest brand/product image and the intended audience feeling from the approved direction.`,
      cta: `Use the approved offer or CTA only when it supports the project purpose.`,
      dialogue_voice_over: `Prefer visual storytelling. Add only the minimum dialogue or voice-over needed to communicate information that cannot be shown.`,
      meaning:
        d.reason_this_direction_fits ||
        "The story demonstrates why the approved creative proposition matters to the audience.",
      client_facing_rationale: `This structure is designed to fit ${duration}, preserve the approved Creative Direction and remain executable for AI image and video production.`,
      required_characters: `Minimum characters required by the approved story.`,
      required_environments: `Minimum environments required to show the transformation clearly.`,
      required_props: `Only story-critical product and props.`,
      important_wardrobe_product_requirements:
        d.continuity_requirements ||
        "Preserve approved wardrobe and product continuity.",
      continuity_notes:
        d.continuity_requirements ||
        "Maintain identity, wardrobe, environment, product, light and colour continuity.",
      production_complexity_notes:
        d.production_boundaries ||
        "Avoid unnecessary cast, locations, props and continuity changes.",
      _generationMethod: "Rule-based Autofill",
      _formulaId: "FF-03-VIDEO-SCRIPT",
      _formulaVersion: "1.0",
    };
    generated._originalGeneratedDraft = { ...generated };
    setScriptDrafts((x) => ({ ...x, [slot.id]: generated }));
  }
  return (
    <div className="video-slot-bank">
      <header>
        <div>
          <b>Video Slot Bank</b>
          <small>
            Brief and Research are shared. Each Slot has its own Creative
            Direction, Script and review history.
          </small>
        </div>
        <span>
          {p.videoSlots.filter((x: any) => x.status === "Available").length}{" "}
          available
        </span>
      </header>
      <div className="slot-list">
        {p.videoSlots.map((slot: any) => {
          const direction = slot.data?.phases?.creativeDirection || {},
            script = slot.data?.phases?.script || {},
            inScript = direction.status === "Approved",
            activeIndex = inScript ? 1 : 0,
            current = inScript ? script : direction;
          return (
            <article className={open === slot.id ? "open" : ""} key={slot.id}>
              <button
                className="slot-summary"
                onClick={() => setOpen(open === slot.id ? null : slot.id)}
              >
                <strong>Slot {String(slot.slotNumber).padStart(2, "0")}</strong>
                <small>{slot.purpose || "Select Purpose to activate"}</small>
                <span>{current.status || slot.status}</span>
                <i>{open === slot.id ? "−" : "+"}</i>
              </button>
              {open === slot.id && (
                <div className="slot-detail">
                  {slot.status === "Available" && tier <= 1 && (
                    <div className="slot-purpose">
                      <b>Choose this video’s Purpose</b>
                      {[
                        "Commercial Video",
                        "Brand Film",
                        "Product Intro",
                        "Other",
                      ].map((purpose) => (
                        <button
                          key={purpose}
                          onClick={() =>
                            act(p.id, {
                              action: "configureVideoSlot",
                              slotId: String(slot.id),
                              purpose,
                            })
                          }
                        >
                          {purpose}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="slot-flow">
                    {flow.map((name, i) => (
                      <span
                        className={
                          i < activeIndex
                            ? "done"
                            : slot.status === "Active" && i === activeIndex
                              ? "current"
                              : "locked"
                        }
                        key={name}
                      >
                        <b>
                          {i < activeIndex
                            ? "✓"
                            : String(i + 1).padStart(2, "0")}
                        </b>
                        {name}
                      </span>
                    ))}
                  </div>
                  {slot.status === "Active" && !inScript && (
                    <section className="slot-creative-workspace">
                      <header>
                        <div>
                          <small>
                            SLOT {String(slot.slotNumber).padStart(2, "0")} ·{" "}
                            {slot.purpose}
                          </small>
                          <h3>Creative Direction</h3>
                        </div>
                        <span>{direction.status || "In Progress"}</span>
                      </header>
                      <div className="phase-autofill-note">
                        <div>
                          <b>Rule-based Autofill</b>
                          <small>
                            Uses the latest Approved Brief and Market Research.
                            It is editable and is not an LLM.
                          </small>
                        </div>
                        {!["Reviewing", "Approved"].includes(
                          direction.status,
                        ) && (
                          <button
                            type="button"
                            onClick={() => autofillDirection(slot)}
                          >
                            ✦ Autofill Creative Direction
                          </button>
                        )}
                      </div>
                      <div className="slot-creative-grid">
                        {directionFields.map((label) => (
                          <label key={label}>
                            <b>{label}</b>
                            <textarea
                              disabled={["Reviewing", "Approved"].includes(
                                direction.status,
                              )}
                              value={directionContent(slot)[key(label)] || ""}
                              onChange={(e) =>
                                updateDirection(
                                  slot,
                                  key(label),
                                  e.target.value,
                                )
                              }
                              placeholder={`Write ${label.toLowerCase()} for this video only…`}
                            />
                          </label>
                        ))}
                      </div>
                      {!["Reviewing", "Approved"].includes(
                        direction.status,
                      ) && (
                        <footer>
                          <button
                            onClick={() =>
                              send(
                                slot,
                                "saveVideoSlotCreativeDirection",
                                "direction",
                              )
                            }
                          >
                            Save draft
                          </button>
                          <button
                            className="create-btn"
                            onClick={() =>
                              send(
                                slot,
                                "submitVideoSlotCreativeDirection",
                                "direction",
                              )
                            }
                          >
                            Submit for Internal Review →
                          </button>
                        </footer>
                      )}
                      {direction.status === "Reviewing" && tier <= 1 && (
                        <div className="slot-review-actions">
                          <button
                            className="revise"
                            onClick={() => {
                              const reviewNote = prompt(
                                "What needs to be refined?",
                              );
                              if (reviewNote)
                                send(
                                  slot,
                                  "reviewVideoSlotCreativeDirection",
                                  "direction",
                                  { decision: "retake", reviewNote },
                                );
                            }}
                          >
                            × Retake
                          </button>
                          <button
                            className="approve"
                            onClick={() =>
                              send(
                                slot,
                                "reviewVideoSlotCreativeDirection",
                                "direction",
                                { decision: "approve" },
                              )
                            }
                          >
                            ✓ Approve
                          </button>
                        </div>
                      )}
                      {direction.status === "Retake" &&
                        direction.reviewNote && (
                          <div className="retake-note">
                            <b>Review feedback</b>
                            <p>{direction.reviewNote}</p>
                          </div>
                        )}
                    </section>
                  )}
                  {slot.status === "Active" && inScript && (
                    <section className="slot-creative-workspace">
                      <header>
                        <div>
                          <small>
                            SLOT {String(slot.slotNumber).padStart(2, "0")} ·
                            APPROVED DIRECTION
                          </small>
                          <h3>Script · Client Review</h3>
                        </div>
                        <span>{script.status || "In Progress"}</span>
                      </header>
                      <div className="phase-autofill-note">
                        <div>
                          <b>Rule-based Script Autofill</b>
                          <small>
                            Builds from this Slot’s approved Creative Direction.
                            Review and rewrite before submission.
                          </small>
                        </div>
                        {![
                          "Reviewing",
                          "Client Reviewing",
                          "Approved",
                        ].includes(script.status) && (
                          <button
                            type="button"
                            onClick={() => autofillScript(slot)}
                          >
                            ✦ Autofill Script
                          </button>
                        )}
                      </div>
                      <div className="slot-creative-grid">
                        {scriptFields.map((label) => (
                          <label key={label}>
                            <b>{label}</b>
                            <textarea
                              disabled={[
                                "Reviewing",
                                "Client Reviewing",
                                "Approved",
                              ].includes(script.status)}
                              value={scriptContent(slot)[key(label)] || ""}
                              onChange={(e) =>
                                updateScript(slot, key(label), e.target.value)
                              }
                              placeholder={`Write ${label.toLowerCase()}…`}
                            />
                          </label>
                        ))}
                      </div>
                      {!["Reviewing", "Client Reviewing", "Approved"].includes(
                        script.status,
                      ) && (
                        <footer>
                          <button
                            onClick={() =>
                              send(slot, "saveVideoSlotScript", "script")
                            }
                          >
                            Save draft
                          </button>
                          <button
                            className="create-btn"
                            onClick={() =>
                              send(slot, "submitVideoSlotScript", "script")
                            }
                          >
                            Submit for Internal Review →
                          </button>
                        </footer>
                      )}
                      {script.status === "Reviewing" && tier <= 1 && (
                        <div className="slot-review-actions">
                          <button
                            className="revise"
                            onClick={() => {
                              const reviewNote = prompt(
                                "What needs to be refined?",
                              );
                              if (reviewNote)
                                send(slot, "reviewVideoSlotScript", "script", {
                                  decision: "retake",
                                  reviewNote,
                                });
                            }}
                          >
                            × Retake
                          </button>
                          <button
                            className="approve"
                            onClick={() =>
                              send(slot, "reviewVideoSlotScript", "script", {
                                decision: "approve",
                              })
                            }
                          >
                            ✓ Internal approve & create client link
                          </button>
                        </div>
                      )}
                      {script.status === "Client Reviewing" &&
                        script.externalReviewUrl && (
                          <div className="client-review-ready">
                            <b>Client review link ready</b>
                            <a
                              href={script.externalReviewUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Open review link ↗
                            </a>
                          </div>
                        )}
                      {script.status === "Retake" && script.reviewNote && (
                        <div className="retake-note">
                          <b>Review feedback</b>
                          <p>{script.reviewNote}</p>
                        </div>
                      )}
                    </section>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function CanonicalBrief({
  p,
  tier,
  act,
}: {
  p: any;
  tier: number;
  act: (id: string, b: Record<string, string>) => void;
}) {
  const frozen =
      (p.phaseRecords || []).find((x: any) => x.phaseKey === "client-brief")
        ?.status === "Approved",
    readOnly = tier >= 2 || frozen;
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    act(p.id, {
      action: "saveBrief",
      ...(Object.fromEntries(new FormData(e.currentTarget)) as any),
    });
  }
  return (
    <section className="panel canonical-phase">
      <header>
        <div>
          <p className="eyebrow">PROJECT SOURCE OF TRUTH</p>
          <h3>Client Brief</h3>
          <p>
            Temporary campaign facts stay in this Project. Stable brand facts
            belong in Client Profile.
          </p>
        </div>
        <span className="phase-status-badge">
          {frozen ? "✓" : "In Progress"}
        </span>
      </header>
      <ContextExport p={p} title="Client Brief" />
      <form onSubmit={submit} className="canonical-field-grid">
        <Input
          name="briefOwner"
          label="Prepared by / Project Manager"
          value={p.briefOwner}
        />
        <Input
          name="clientName"
          label="Client / Brand"
          value={p.clientName || p.client}
        />
        <Input
          area
          name="brandOverview"
          label="Brand / product background"
          value={p.brandOverview}
        />
        <Input
          area
          name="projectGoal"
          label="Project goal"
          value={p.projectGoal}
        />
        <Input
          area
          name="audience"
          label="Target audience"
          value={p.audience}
        />
        <Input
          area
          name="deliverables"
          label="Deliverables"
          value={p.deliverables}
        />
        <Input
          area
          name="keyMessage"
          label="Key message / offer"
          value={p.keyMessage}
        />
        <Input name="tone" label="Tone / visual direction" value={p.tone} />
        <Input
          area
          name="restrictions"
          label="Must include / must avoid"
          value={p.restrictions}
        />
        {!readOnly && (
          <footer>
            <button className="create-btn">
              Complete Brief & assign people →
            </button>
          </footer>
        )}
      </form>
      {frozen && (
        <div className="approved-change">
          <b>✓ Approved Brief v{p.briefVersion || 1}</b>
          <button
            onClick={() => {
              const requestNote = prompt("Describe the Brief change");
              if (requestNote)
                act(p.id, {
                  action: "requestChange",
                  phaseKey: "client-brief",
                  requestNote,
                });
            }}
          >
            Request Change
          </button>
        </div>
      )}
    </section>
  );
}
function ContextExport({ p, title }: { p: any; title: string }) {
  const text = [
    `PROJECT: ${p.client}`,
    `TYPE: ${p.projectType || p.type}`,
    `PURPOSE: ${p.purpose || "—"}`,
    `BRAND: ${p.brandOverview || "—"}`,
    `GOAL: ${p.projectGoal || "—"}`,
    `AUDIENCE: ${p.audience || "—"}`,
    `DELIVERABLES: ${p.deliverables || "—"}`,
    `KEY MESSAGE: ${p.keyMessage || "—"}`,
    `TONE: ${p.tone || "—"}`,
    `RESTRICTIONS: ${p.restrictions || "—"}`,
  ].join("\n");
  return (
    <div className="context-tools">
      <div>
        <b>{title} · AI Context</b>
        <small>Complete phase context for an AI or assigned handler.</small>
      </div>
      <button onClick={() => navigator.clipboard.writeText(text)}>
        Copy context
      </button>
      <button
        onClick={() => {
          const a = document.createElement("a");
          a.href = URL.createObjectURL(
            new Blob([text], { type: "text/plain" }),
          );
          a.download = `${p.id}-${title.toLowerCase().replaceAll(" ", "-")}.txt`;
          a.click();
        }}
      >
        Download .txt
      </button>
    </div>
  );
}
function Input({
  name,
  label,
  value,
  area,
}: {
  name: string;
  label: string;
  value?: string;
  area?: boolean;
}) {
  return (
    <label>
      <b>{label}</b>
      {area ? (
        <textarea name={name} defaultValue={value || ""} />
      ) : (
        <input name={name} defaultValue={value || ""} />
      )}
    </label>
  );
}
function ProjectSocialConnectionSettings({
  p,
  tier,
}: {
  p: any;
  tier: number;
}) {
  const [data, setData] = useState<any>(null),
    [message, setMessage] = useState("");
  async function load() {
    const response = await fetch(
        `/api/social-connections?projectId=${encodeURIComponent(p.id)}`,
      ),
      result = await response.json();
    if (response.ok) setData(result);
    else setMessage(result.error);
  }
  useEffect(() => {
    load();
  }, [p.id]);
  async function action(
    platform: string,
    type: string,
    socialConnectionId?: string,
  ) {
    const response = await fetch("/api/social-connections", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId: p.id,
          platform,
          action: type,
          socialConnectionId,
        }),
      }),
      result = await response.json();
    setMessage(
      response.ok
        ? `${platform} ${type.replaceAll("_", " ")} complete.`
        : result.error,
    );
    if (response.ok) await load();
  }
  if (!data)
    return (
      <section className="panel canonical-phase">
        <p>{message || "Loading Project Social Connections…"}</p>
      </section>
    );
  const connectedProfiles = data.connections
    .flatMap((row: any) => row.profiles || [])
    .filter((profile: any) => profile.status === "Connected");
  return (
    <section className="panel canonical-phase project-social-settings">
      <header>
        <div>
          <p className="eyebrow">PROJECT SETTINGS · PUBLISHING</p>
          <h3>Social Connections</h3>
          <p>
            Connector availability, Project connection and Batch usage are
            separate. These Profiles belong only to {p.client}.
          </p>
        </div>
        <span className="phase-status-badge">
          {connectedProfiles.length} profile
          {connectedProfiles.length === 1 ? "" : "s"} connected
        </span>
      </header>
      <div className="project-social-setting-grid">
        {data.connections.map((row: any) => {
          const profiles = row.profiles || [],
            connectPath = row.platform.toLowerCase().replace(" page", "");
          return (
            <article key={row.platform} className="social-platform-card">
              <header>
                <div>
                  <b>{row.platform}</b>
                  <small>{row.availability}</small>
                </div>
                <span>
                  {row.configured
                    ? "Connector ready"
                    : "Connector not configured"}
                </span>
              </header>
              <div className="social-profile-list">
                {profiles.map((profile: any) => (
                  <div
                    className="social-profile-row"
                    key={profile.socialConnectionId}
                  >
                    <div>
                      <b>{profile.handle}</b>
                      <small>
                        {profile.accountType || "Creator"} · {profile.status}
                        {profile.isDefault ? " · Project default" : ""}
                      </small>
                    </div>
                    {tier <= 1 && (
                      <div>
                        {!profile.isDefault &&
                          profile.status === "Connected" && (
                            <button
                              onClick={() =>
                                action(
                                  row.platform,
                                  "set_default",
                                  profile.socialConnectionId,
                                )
                              }
                            >
                              Make default
                            </button>
                          )}
                        <a
                          href={
                            row.configured
                              ? `/api/${connectPath}/connect?projectId=${encodeURIComponent(p.id)}&connectionId=${encodeURIComponent(profile.socialConnectionId)}`
                              : undefined
                          }
                          aria-disabled={!row.configured}
                        >
                          Reconnect
                        </a>
                        <button
                          onClick={() =>
                            action(
                              row.platform,
                              "check",
                              profile.socialConnectionId,
                            )
                          }
                        >
                          Check
                        </button>
                        <button
                          onClick={() =>
                            action(
                              row.platform,
                              "disconnect",
                              profile.socialConnectionId,
                            )
                          }
                        >
                          Disconnect
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {!profiles.length && (
                  <small>No Project Profile connected.</small>
                )}
              </div>
              {tier <= 1 && (
                <a
                  className="social-add-profile"
                  aria-disabled={!row.configured}
                  href={
                    row.configured
                      ? `/api/${connectPath}/connect?projectId=${encodeURIComponent(p.id)}`
                      : undefined
                  }
                >
                  {profiles.length
                    ? `＋ Connect another ${row.platform} Profile`
                    : `Connect ${row.platform}`}
                </a>
              )}
            </article>
          );
        })}
      </div>
      {message && <p className="integration-message">{message}</p>}
      <div className="integration-scope">
        <b>Credential boundary</b>
        <span>
          Access Tokens, App Secrets and OAuth credentials are never displayed
          to Project handlers or Agents.
        </span>
      </div>
    </section>
  );
}
function CanonicalAssign({
  p,
  tier,
  act,
}: {
  p: any;
  tier: number;
  act: (id: string, b: Record<string, string>) => void;
}) {
  const [members, setMembers] = useState<any[]>([]),
    selected = useMemo(() => {
      try {
        return JSON.parse(p.assignmentMembers || "[]");
      } catch {
        return [];
      }
    }, [p.assignmentMembers]);
  useEffect(() => {
    fetch("/api/members")
      .then((r) => r.json())
      .then((d) => setMembers(d.members || []));
  }, []);
  if (tier > 1)
    return (
      <section className="panel canonical-phase">
        <h3>Assigned people</h3>
        <p>Only management can change assignments.</p>
      </section>
    );
  return (
    <section className="panel canonical-phase">
      <header>
        <div>
          <p className="eyebrow">INDIVIDUAL ASSIGNMENT</p>
          <h3>Assign responsible people</h3>
          <p>
            Assign only the people and Agent responsible for producing and
            reviewing task files.
          </p>
        </div>
      </header>
      <div className="individual-picker">
        {members.map((m) => (
          <label key={m.email}>
            <input
              type="checkbox"
              value={m.email}
              defaultChecked={selected.includes(m.email)}
            />
            <span className="member-avatar">
              {m.name
                .split(" ")
                .map((x: string) => x[0])
                .join("")
                .slice(0, 2)}
            </span>
            <div>
              <b>
                {m.name}
                {m.tier === 0 ? " · Me" : ""}
              </b>
              <small>
                Tier {m.tier} · {m.email}
              </small>
            </div>
          </label>
        ))}
      </div>
      <button
        className="create-btn"
        onClick={() => {
          const emails = Array.from(
            document.querySelectorAll(".individual-picker input:checked"),
          ).map((x: any) => x.value);
          act(p.id, {
            action: "assign",
            assigneeEmails: JSON.stringify(emails),
          });
        }}
      >
        Save assignment & open next phase →
      </button>
    </section>
  );
}
