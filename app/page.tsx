"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { productionAssetPrompt } from "./production-prompts";
import { StageTrack } from "./stage-track";
import MVMusicWorkflow from "./mv-music-workflow";
import FilmSeriesScript from "./film-series-script";
import ProjectPhaseBar from "./project-phase-bar";
import MVVisualScript from "./mv-visual-script";
import { ReadOnlyScript, ScriptTextExport } from "./script-export";
import WorkspacePhaseTabs from "./workspace-phase-tabs";
import DriveConnection from "./drive-connection";
import CanonicalProjectWorkspace from "./canonical-project-workspace";
import IntegrationSettings from "./integration-settings";
import LanguageSwitch from "./language-switch";
import { selectSocialBatchLifecycle } from "./social-batch-lifecycle";
import { operationalState } from "./operational-status";
import { ACTIVE_PROJECT_TYPES } from "./business-rules";
type P = Record<string, any> & {
  id: string;
  client: string;
  type: string;
  projectType?: string;
  projectMode?: string;
  purpose?: string;
  projectStatus?: string;
  phaseStatus?: string;
  status: string;
  stage: string;
  progress: number;
};
type Member = { email: string; name: string; tier: number; status: string };
const tierNames = [
  "Management",
  "Project Manager",
  "Contributor",
  "Reviewer",
  "AI Agent",
];
const tierDetails = [
  "Management: all projects, Drive editing, approvals, members and deletion",
  "Project Manager: only projects they created or were assigned",
  "Assigned projects; brief and assignments are review-only; research is editable",
  "Assigned projects; brief and assignments are review-only; research is editable",
  "Assigned project context only; drafts and submits work but cannot approve, upload final media or publish",
];
const fallback: P[] = [];
const isActiveProject = (project: P) =>
  ACTIVE_PROJECT_TYPES.some(
    (type) => type === (project.projectType || project.type),
  );
const nav = [
    "Overview",
    "Projects",
    "My Tasks",
    "Approvals",
    "Workload",
    "Assets",
    "Project Calendar",
    "Members",
  ],
  icons = ["⌂", "◇", "✓", "◎", "◷", "▣", "▦", "♙"];
function phaseKeyFor(p: any) {
  const stage = String(p.assignmentStage || p.stage || "").toLowerCase(),
    available = (p.phaseRecords || []).filter(
      (x: any) => x.status !== "Locked",
    );
  return (
    available.find((x: any) =>
      stage.includes(String(x.label || "").toLowerCase()),
    )?.phaseKey ||
    available.find((x: any) => x.status !== "Approved")?.phaseKey ||
    available.at(-1)?.phaseKey
  );
}
function slotPhases(p: any, statuses: string[]) {
  return (p.videoSlots || []).flatMap((slot: any) =>
    Object.entries(slot.data?.phases || {})
      .filter(([, phase]: any) => statuses.includes(phase?.status))
      .map(([key, phase]: any) => ({ slot, key, phase })),
  );
}
function canonicalPhases(p: any, statuses: string[]) {
  return (p.phaseRecords || []).filter((phase: any) =>
    statuses.includes(phase.status),
  );
}
export default function Home() {
  const [ps, setPs] = useState<P[]>(fallback),
    [active, setActive] = useState("Overview"),
    [selected, setSelected] = useState<P | null>(null),
    [createOpen, setCreateOpen] = useState(false),
    [searchOpen, setSearchOpen] = useState(false),
    [createType, setCreateType] = useState(ACTIVE_PROJECT_TYPES[0]),
    [createMode, setCreateMode] = useState("continuous"),
    [notice, setNotice] = useState(""),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(""),
    [member, setMember] = useState<Member | null>(null),
    [editNotifications, setEditNotifications] = useState<any[]>([]),
    [creating, setCreating] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const refresh = async (id?: string, openPhase?: string) => {
    setLoadError("");
    try {
      const r = await fetch("/api/projects"),
        d = await r
          .json()
          .catch(() => ({ error: "Project list could not be loaded." }));
      if (!r.ok)
        throw new Error(d.error || `Project list failed (${r.status})`);
      const visibleProjects = (d.projects || []).filter(isActiveProject);
      setPs(visibleProjects);
      setMember(d.member || member);
      setEditNotifications(d.editNotifications || []);
      if (id) {
        const project = visibleProjects.find((x: P) => x.id === id) || null;
        setSelected(
          project && openPhase
            ? { ...project, _openPhase: openPhase }
            : project,
        );
      }
    } catch (error: any) {
      setLoadError(error?.message || "Project list could not be loaded.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    const params = new URLSearchParams(window.location.search),
      projectId = params.get("projectId") || undefined,
      phase = params.get("phase") || undefined,
      tiktok = params.get("tiktok");
    refresh(projectId, phase);
    if (tiktok) {
      setNotice(
        tiktok === "connected"
          ? "TikTok Profile connected to this Project · Login Kit only"
          : "TikTok OAuth could not complete · " + tiktok.replaceAll("-", " "),
      );
      window.history.replaceState({}, "", window.location.pathname);
    }
    const handler = (event: Event) =>
      refresh((event as CustomEvent).detail?.projectId);
    window.addEventListener("frameflow:refresh", handler);
    return () => window.removeEventListener("frameflow:refresh", handler);
  }, []);
  const realOwner = member?.tier === 0,
    effectiveTier = member?.tier ?? 4,
    management = effectiveTier <= 1,
    memberEmail = (member?.email || "").toLowerCase(),
    viewPs = ps,
    approvals = useMemo(
      () =>
        management
          ? viewPs.filter(
              (p) =>
                p.marketStatus === "Submitted" ||
                p.trendStatus === "Submitted" ||
                p.scriptStatus === "Submitted" ||
                Boolean(p.approvalTitle) ||
                slotPhases(p, ["Reviewing"]).length > 0 ||
                canonicalPhases(p, ["Reviewing"]).length > 0,
            )
          : [],
      [viewPs, management],
    ),
    slotApprovalCount = management
      ? viewPs.reduce((n, p) => n + slotPhases(p, ["Reviewing"]).length, 0)
      : 0,
    canonicalApprovalCount = management
      ? viewPs.reduce((n, p) => n + canonicalPhases(p, ["Reviewing"]).length, 0)
      : 0,
    legacyApprovalCount = approvals.filter(
      (p) =>
        p.marketStatus === "Submitted" ||
        p.trendStatus === "Submitted" ||
        p.scriptStatus === "Submitted" ||
        Boolean(p.approvalTitle),
    ).length,
    approvalNoticeCount =
      legacyApprovalCount +
      slotApprovalCount +
      canonicalApprovalCount +
      editNotifications.length,
    taskReviewCount = viewPs.reduce(
      (n, p) =>
        n +
        slotPhases(p, ["Retake", "Reopened", "In Progress"]).length +
        canonicalPhases(p, ["Retake", "Reopened"]).length +
        (p.assignmentStatus === "Revision Requested" ? 1 : 0),
      0,
    ),
    owner = effectiveTier === 0,
    canCreate = management;
  useMemo(() => {
    for (const project of viewPs) {
      const reviews = slotPhases(project, ["Reviewing"]),
        retakes = slotPhases(project, ["Retake", "Reopened"]);
      if (reviews.length) {
        project.assignmentStatus = "Awaiting Approval";
        project.assignmentStage = `Slot ${reviews[0].slot.slotNumber} · ${reviews[0].key}`;
        project.stage = `${project.assignmentStage} · Reviewing`;
      } else if (retakes.length) {
        project.assignmentStatus = "Revision Requested";
        project.assignmentStage = `Slot ${retakes[0].slot.slotNumber} · ${retakes[0].key}`;
        project.stage = `${project.assignmentStage} · Retake`;
      }
    }
    return null;
  }, [viewPs]);
  useEffect(() => {
    for (const button of Array.from(
      document.querySelectorAll(".nav-list button"),
    )) {
      const label = button.textContent || "";
      if (label.includes("My Tasks") && taskReviewCount)
        button.setAttribute("data-review-count", String(taskReviewCount));
      else if (label.includes("My Tasks"))
        button.removeAttribute("data-review-count");
    }
  }, [taskReviewCount, active]);
  useEffect(() => {
    const logo = document.querySelector(".brand") as HTMLElement | null,
      navList = document.querySelector(".nav-list");
    if (!logo || !realOwner) return;
    let timer: number | null = null;
    const cancel = () => {
        if (timer !== null) {
          window.clearTimeout(timer);
          timer = null;
        }
      },
      open = () => {
        cancel();
        timer = window.setTimeout(() => {
          document.body.classList.add("system-connections-open");
          setSelected(null);
          setActive("Members");
          setNotice("Tier 0 System Connections opened");
          timer = null;
        }, 1100);
      },
      blockMenu = (event: Event) => {
        event.preventDefault();
        cancel();
      },
      close = () => document.body.classList.remove("system-connections-open");
    logo.addEventListener("pointerdown", open);
    logo.addEventListener("pointerup", cancel);
    logo.addEventListener("pointerleave", cancel);
    logo.addEventListener("pointercancel", cancel);
    logo.addEventListener("contextmenu", blockMenu);
    navList?.addEventListener("click", close);
    return () => {
      cancel();
      close();
      logo.removeEventListener("pointerdown", open);
      logo.removeEventListener("pointerup", cancel);
      logo.removeEventListener("pointerleave", cancel);
      logo.removeEventListener("pointercancel", cancel);
      logo.removeEventListener("contextmenu", blockMenu);
      navList?.removeEventListener("click", close);
    };
  }, [realOwner]);
  useEffect(() => {
    const openSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", openSearch);
    return () => window.removeEventListener("keydown", openSearch);
  }, []);
  useEffect(() => {
    setSidebarCollapsed(
      window.localStorage.getItem("frameflow:sidebar-collapsed") === "true",
    );
  }, []);
  useEffect(() => {
    window.localStorage.setItem(
      "frameflow:sidebar-collapsed",
      String(sidebarCollapsed),
    );
  }, [sidebarCollapsed]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 6500);
    return () => window.clearTimeout(timer);
  }, [notice]);
  async function act(id: string, payload: Record<string, string>) {
    const r = await fetch("/api/projects", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, ...payload }),
    });
    const d = await r.json();
    if (!r.ok) {
      setNotice(d.error || "Permission denied");
      return;
    }
    setNotice("Saved successfully");
    await refresh(id);
    setTimeout(() => setNotice(""), 3000);
  }
  async function deleteProject(p: P) {
    if (!realOwner) return;
    const first = confirm(
      `Delete ${p.id} · ${p.client}?\n\nFrameFlow records will be removed. The linked Google Drive folder is preserved.`,
    );
    if (!first) return;
    const typed = prompt(`Type ${p.id} to confirm permanent project deletion.`);
    if (typed !== p.id) {
      setNotice("Project deletion cancelled");
      return;
    }
    const r = await fetch("/api/projects", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: p.id }),
      }),
      d = await r.json();
    if (!r.ok) {
      setNotice(d.error || "Project could not be deleted");
      return;
    }
    setSelected(null);
    setActive("Projects");
    await refresh();
    setNotice(`${p.id} deleted · linked Drive folder preserved`);
  }
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    setNotice("Creating project…");
    try {
      const f = new FormData(e.currentTarget),
        quotas = {
          reel: Number(f.get("quotaReel")) || 0,
          carousel: Number(f.get("quotaCarousel")) || 0,
          photo: Number(f.get("quotaPhoto")) || 0,
          threads: Number(f.get("quotaThreads")) || 0,
        },
        r = await fetch("/api/projects", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            client: f.get("client"),
            projectType: f.get("projectType"),
            projectMode: f.get("projectMode"),
            purpose: createMode === "package" ? null : f.get("purpose"),
            mvEntry: f.get("mvEntry"),
            projectDuration: f.get("projectDuration"),
            frequencyCount: f.get("frequencyCount"),
            frequencyUnit: f.get("frequencyUnit"),
            contentQuantity: f.get("contentQuantity"),
            projectStartDate: f.get("projectStartDate"),
            projectEndDate:
              createMode === "package" ? null : f.get("projectEndDate"),
            slotCount: f.get("slotCount"),
            authorizedPlatforms: "[]",
            quotas: JSON.stringify(quotas),
            labSource: f.get("labSource"),
          }),
        }),
        raw = await r.text();
      let d: any = {};
      try {
        d = JSON.parse(raw);
      } catch {}
      if (!r.ok) {
        setNotice(d.error || `Project could not be created (${r.status})`);
        return;
      }
      await refresh(d.id);
      setCreateOpen(false);
      setActive("Projects");
      setNotice(`${d.id} created · Production workspace is ready`);
    } catch (error: any) {
      setNotice(error?.message || "Project creation failed. Please retry.");
    } finally {
      setCreating(false);
    }
  }
  const myEmail = memberEmail,
    hasPersonalTask = viewPs.some((p) => {
      try {
        return (
          JSON.parse(p.assignmentMembers || "[]").includes(myEmail) &&
          !["Completed", "Awaiting Approval"].includes(p.assignmentStatus)
        );
      } catch {
        return false;
      }
    }),
    visibleNav = nav
      .filter((n) => n !== "Members" || owner)
      .filter(
        (n) => !["Approvals", "Workload", "Assets"].includes(n) || management,
      )
      .filter((n) => n !== "My Tasks" || !management || hasPersonalTask)
      .filter(
        (n) =>
          effectiveTier < 4 ||
          ["Overview", "Projects", "My Tasks", "Project Calendar"].includes(n),
      );
  const noticeIsError =
    /not found|error|failed|could not|denied|incomplete|invalid|expired|cancelled|attention/i.test(
      notice,
    );
  return (
    <main
      className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}
    >
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">F</span>
          <div>
            <b>FrameFlow</b>
            <small>Creative Production</small>
          </div>
        </div>
        <button
          className="sidebar-toggle"
          type="button"
          aria-label={
            sidebarCollapsed ? "Expand navigation" : "Collapse navigation"
          }
          aria-expanded={!sidebarCollapsed}
          onClick={() => setSidebarCollapsed((value) => !value)}
        >
          {sidebarCollapsed ? "›" : "‹"}
        </button>
        <nav className="nav-list">
          {visibleNav.map((n) => {
            const i = nav.indexOf(n);
            return (
              <button
                key={n}
                title={sidebarCollapsed ? n : undefined}
                aria-label={n}
                className={active === n && !selected ? "active" : ""}
                onClick={() => {
                  setActive(n);
                  setSelected(null);
                }}
              >
                <span className="nav-icon">{icons[i]}</span>
                {n}
                {n === "Approvals" &&
                  approvals.length + editNotifications.length > 0 && (
                    <em>{approvals.length + editNotifications.length}</em>
                  )}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <DriveConnection owner={owner} />
          <div className="user">
            <span>
              {member?.name
                ?.split(" ")
                .map((x) => x[0])
                .join("")
                .slice(0, 2) || "—"}
            </span>
            <div>
              <b>{member?.name || "Loading member"}</b>
              <small>
                Tier {effectiveTier} · {tierNames[effectiveTier]}
              </small>
            </div>
          </div>
        </div>
      </aside>
      <section className="workspace">
        <header className="topbar">
          <div>
            <p>PRODUCTION WORKSPACE</p>
            <h1 data-i18n-ignore={selected ? "true" : undefined}>
              {selected ? selected.client : active}
            </h1>
          </div>
          <div className="top-actions">
            <LanguageSwitch />
            <button className="search" onClick={() => setSearchOpen(true)}>
              ⌕ <span>Search projects, Batches, files</span>
              <kbd>⌘K</kbd>
            </button>
            {management && (
              <button
                className="bell"
                onClick={() => {
                  setSelected(null);
                  setActive("Approvals");
                }}
              >
                ♢{approvals.length + editNotifications.length > 0 && <i />}
              </button>
            )}
          </div>
        </header>
        <div className="content">
          {loading ? (
            <div className="loading">Loading your permitted workspace…</div>
          ) : loadError ? (
            <div className="project-load-error">
              <b>Projects could not load</b>
              <span>{loadError}</span>
              <button
                onClick={() => {
                  setLoading(true);
                  refresh();
                }}
              >
                Retry Project List
              </button>
            </div>
          ) : selected ? (
            <CanonicalProjectWorkspace
              p={selected}
              tier={effectiveTier}
              owner={owner}
              back={() => setSelected(null)}
              act={act}
              deleteProject={deleteProject}
            />
          ) : active === "Overview" ? (
            <Overview
              ps={viewPs}
              approvals={approvals}
              open={setSelected}
              go={(s) =>
                setActive(
                  !management && ["Approvals", "Assets"].includes(s)
                    ? "Projects"
                    : s,
                )
              }
            />
          ) : active === "Projects" ? (
            <ProjectList ps={viewPs} open={setSelected} />
          ) : active === "Approvals" && management ? (
            <ApprovalQueue
              ps={approvals}
              edits={editNotifications}
              open={setSelected}
              act={act}
            />
          ) : active === "My Tasks" ? (
            <TaskList ps={viewPs} email={memberEmail} open={setSelected} />
          ) : active === "Workload" && management ? (
            <Workload ps={ps} />
          ) : active === "Assets" && management ? (
            <Assets ps={viewPs} owner={owner} />
          ) : active === "Members" && owner ? (
            <Members ps={ps} />
          ) : (
            <Calendar ps={viewPs} open={setSelected} />
          )}
        </div>
      </section>
      {searchOpen && (
        <GlobalSearch
          projects={viewPs}
          close={() => setSearchOpen(false)}
          open={(project) => {
            setSelected(project);
            setSearchOpen(false);
          }}
        />
      )}
      {canCreate && (
        <button className="fab" onClick={() => setCreateOpen(true)}>
          <span>＋</span> New Project
        </button>
      )}
      {notice && (
        <div
          className={`toast ${noticeIsError ? "error" : "success"}`}
          role={noticeIsError ? "alert" : "status"}
          aria-live="polite"
        >
          <span aria-hidden="true">{noticeIsError ? "!" : "✓"}</span>
          <p>{notice}</p>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            ×
          </button>
        </div>
      )}
      {createOpen && (
        <Modal close={() => setCreateOpen(false)}>
          <p className="eyebrow">NEW PROJECT</p>
          <h2>Create project</h2>
          <p className="modal-copy">
            Choose the content rhythm. Platform selection and publishing stay
            outside this production workflow.
          </p>
          <form onSubmit={create}>
            <label>
              Project / Client name
              <input
                name="client"
                required
                autoFocus
                placeholder="e.g. Autumn Campaign"
              />
            </label>
            <div className="form-grid">
              <label>
                Project type
                <select
                  name="projectType"
                  value={createType}
                  onChange={(e) => {
                    const t = e.target.value;
                    setCreateType(t);
                    setCreateMode("continuous");
                  }}
                >
                  {ACTIVE_PROJECT_TYPES.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </label>
              <label>
                Mode
                <select
                  name="projectMode"
                  key={createType}
                  value={createMode}
                  onChange={(e) => setCreateMode(e.target.value)}
                >
                  <option value="continuous">Continuous</option>
                </select>
              </label>
            </div>
            {createType === "AI Video" && createMode !== "package" && (
              <label>
                Purpose
                <select name="purpose">
                  <option>Commercial Video</option>
                  <option>Brand Film</option>
                  <option>Product Intro</option>
                  <option>Other</option>
                </select>
              </label>
            )}
            {createType === "MV" && (
              <label>
                MV starting point
                <select name="mvEntry">
                  <option value="no_song">
                    No finished song · Create song first
                  </option>
                  <option value="finished_song">
                    Client already has finished song
                  </option>
                </select>
              </label>
            )}
            {createType === "AI Reels" && createMode === "one_off" && (
              <label>
                Fixed Reel quantity
                <input
                  name="contentQuantity"
                  type="number"
                  min="1"
                  placeholder="e.g. 15"
                />
                <small>One-off Reels uses a fixed quantity and deadline.</small>
              </label>
            )}
            {createType === "Client Social Account" && (
              <>
                <fieldset className="project-config-field">
                  <legend>Monthly content quota</legend>
                  <div className="form-grid quota-grid">
                    <label>
                      Reels
                      <input
                        name="quotaReel"
                        type="number"
                        min="0"
                        defaultValue="4"
                      />
                    </label>
                    <label>
                      Carousels
                      <input
                        name="quotaCarousel"
                        type="number"
                        min="0"
                        defaultValue="4"
                      />
                    </label>
                    <label>
                      Images
                      <input
                        name="quotaPhoto"
                        type="number"
                        min="0"
                        defaultValue="4"
                      />
                    </label>
                    <label>
                      Text Only
                      <input
                        name="quotaThreads"
                        type="number"
                        min="0"
                        defaultValue="0"
                      />
                    </label>
                  </div>
                </fieldset>
              </>
            )}
            {createType === "Internal R&D / Lab" && (
              <label>
                Start from
                <select name="labSource">
                  <option>Blank</option>
                  <option>Copied Asset</option>
                  <option>Prompt</option>
                  <option>Project</option>
                  <option>Workflow</option>
                </select>
              </label>
            )}
            {createType === "AI Video" && createMode === "package" && (
              <label className="slot-count-field">
                Package video slots
                <input
                  name="slotCount"
                  type="number"
                  min="2"
                  max="100"
                  defaultValue="5"
                />
                <small>
                  Slots are created locked and become Available only after
                  payment confirmation.
                </small>
              </label>
            )}
            {["AI Video", "MV"].includes(createType) &&
              createMode !== "package" && (
                <label className="one-off-duration-field">
                  Video duration / seconds
                  <input
                    name="projectDuration"
                    placeholder="e.g. 15, 30, 60 or 180"
                  />
                  <small>
                    Recorded once and reused by later production phases.
                  </small>
                </label>
              )}
            {createMode === "recurring" && (
              <div className="schedule-builder">
                <label>
                  Frequency
                  <input
                    name="frequencyCount"
                    type="number"
                    min="1"
                    defaultValue="1"
                  />
                </label>
                <label>
                  Period
                  <select name="frequencyUnit">
                    <option value="week">Videos / Reels per week</option>
                    <option value="month">Videos / Reels per month</option>
                  </select>
                </label>
                <small>
                  Recurring production is planned in 2-week batches.
                </small>
              </div>
            )}
            <div className="form-grid project-dates">
              <label>
                Project start date
                <input name="projectStartDate" type="date" required />
              </label>
              {createMode !== "package" && (
                <label>
                  Project end date
                  <input name="projectEndDate" type="date" />
                </label>
              )}
            </div>
            <button className="create-btn" disabled={creating}>
              {creating ? "Creating Project…" : "Create project →"}
            </button>
          </form>
        </Modal>
      )}
    </main>
  );
}
function GlobalSearch({
  projects,
  close,
  open,
}: {
  projects: P[];
  close: () => void;
  open: (p: P) => void;
}) {
  const [query, setQuery] = useState(""),
    [files, setFiles] = useState<any[]>([]),
    needle = query.trim().toLowerCase();
  useEffect(() => {
    let active = true;
    fetch("/api/assets-library", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active)
          setFiles(
            (data?.outputs || []).filter(
              (item: any) =>
                item.outputKind !== "post" &&
                ACTIVE_PROJECT_TYPES.some(
                  (type) => type === item.projectType,
                ),
            ),
          );
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const projectMatches = needle
      ? projects
          .filter((p) =>
            [p.id, p.client, p.projectType, p.type, p.stage].some((value) =>
              String(value || "")
                .toLowerCase()
                .includes(needle),
            ),
          )
          .slice(0, 6)
      : projects.slice(0, 4),
    batchMatches = needle
      ? projects
          .flatMap((project) =>
            (project.batches || [])
              .filter((batch: any) => batch.status !== "Locked")
              .map((batch: any) => ({ project, batch })),
          )
          .filter(({ project, batch }) =>
            `batch ${batch.batchNumber} ${batch.status} ${project.client} ${project.id}`
              .toLowerCase()
              .includes(needle),
          )
          .slice(0, 6)
      : [],
    fileMatches = needle
      ? files
          .filter((item) =>
            [item.title, item.projectName, item.projectId, item.fileName].some(
              (value: any) =>
                String(value || "")
                  .toLowerCase()
                  .includes(needle),
            ),
          )
          .slice(0, 6)
      : [];
  return (
    <div
      className="global-search-backdrop"
      role="presentation"
      onMouseDown={close}
    >
      <section
        className="global-search"
        role="dialog"
        aria-modal="true"
        aria-label="Search FrameFlow"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <label>
            ⌕
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search project, Batch or task file…"
            />
          </label>
          <button onClick={close} aria-label="Close search">
            Esc
          </button>
        </header>
        <div className="global-search-results">
          <SearchGroup title="Projects" empty="No matching Project">
            {projectMatches.map((project) => {
              const op = operationalState(project);
              return (
                <button key={project.id} onClick={() => open(project)}>
                  <span className="search-kind">PROJECT</span>
                  <div>
                    <b>{project.client}</b>
                    <small>
                      {project.id} · {op.status} · {op.phase}
                    </small>
                  </div>
                  <strong>→</strong>
                </button>
              );
            })}
          </SearchGroup>
          {batchMatches.length > 0 && (
            <SearchGroup title="Batches" empty="No matching Batch">
              {batchMatches.map(({ project, batch }) => (
                <button
                  key={`${project.id}-${batch.id}`}
                  onClick={() =>
                    open({ ...project, _selectedBatchId: batch.id })
                  }
                >
                  <span className="search-kind batch">BATCH</span>
                  <div>
                    <b>
                      {project.client} · Batch{" "}
                      {String(batch.batchNumber).padStart(2, "0")}
                    </b>
                    <small>
                      {batch.status} · {batch.startsAt} → {batch.endsAt}
                    </small>
                  </div>
                  <strong>→</strong>
                </button>
              ))}
            </SearchGroup>
          )}
          {fileMatches.length > 0 && (
            <SearchGroup title="Task Files" empty="No matching file">
              {fileMatches.map((item) => {
                const project = projects.find((p) => p.id === item.projectId);
                return (
                  <button
                    key={item.id}
                    disabled={!project}
                    onClick={() =>
                      project && open({ ...project, _openPhase: "publishing" })
                    }
                  >
                    <span className="search-kind file">FILE</span>
                    <div>
                      <b>{item.title || item.fileName}</b>
                      <small>
                        {item.projectName} · v{item.version || 1}
                      </small>
                    </div>
                    <strong>→</strong>
                  </button>
                );
              })}
            </SearchGroup>
          )}
        </div>
        <footer>
          <span>
            <kbd>↑↓</kbd> browse
          </span>
          <span>
            <kbd>Esc</kbd> close
          </span>
          <span>Only records you can access are shown.</span>
        </footer>
      </section>
    </div>
  );
}
function SearchGroup({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: any;
}) {
  const count = Array.isArray(children) ? children.length : children ? 1 : 0;
  return (
    <section className="global-search-group">
      <h3>
        {title}
        <span>{count}</span>
      </h3>
      {count ? children : <p>{empty}</p>}
    </section>
  );
}
function Overview({
  ps,
  approvals,
  open,
  go,
}: {
  ps: P[];
  approvals: P[];
  open: (p: P) => void;
  go: (s: string) => void;
}) {
  const attention = ps.filter(
      (p) => operationalState(p).status === "Needs Attention",
    ),
    readyProjects = ps.filter(
      (p) =>
        operationalState(p).status === "Active" &&
        /ready|start/i.test(operationalState(p).nextAction),
    ),
    waiting = approvals.length,
    average = ps.length
      ? Math.round(
          ps.reduce((n, p) => n + Number(p.progress || 0), 0) / ps.length,
        )
      : 0,
    actionLabel = (p: P) => operationalState(p).reason;
  return (
    <>
      <section className="welcome">
        <div>
          <p className="eyebrow">LIVE PRODUCTION CONTROL</p>
          <h2>See what needs attention now.</h2>
          <p>
            {ps.length} active project{ps.length === 1 ? "" : "s"} · every alert
            below opens the exact project that needs attention.
          </p>
        </div>
        <div className="system-health">
          <span className="pulse" />
          <div>
            <small>AVERAGE PROJECT PROGRESS</small>
            <b>{average}% complete</b>
          </div>
        </div>
      </section>
      <section className="stats-grid">
        <button className="stat-card orange" onClick={() => go("Projects")}>
          <div>
            <span>Active Projects</span>
            <b>{ps.length}</b>
          </div>
          <small>View status and progress</small>
        </button>
        <button
          className="stat-card blue"
          onClick={() =>
            document
              .getElementById("attention-list")
              ?.scrollIntoView({ behavior: "smooth" })
          }
        >
          <div>
            <span>Action Required</span>
            <b>{attention.length}</b>
          </div>
          <small>Only human intervention required</small>
        </button>
        <button
          className="stat-card violet"
          onClick={() => go(approvals.length ? "Approvals" : "Projects")}
        >
          <div>
            <span>Waiting Approval</span>
            <b>{waiting}</b>
          </div>
          <small>
            {approvals.length
              ? `${approvals.length} ready for your review`
              : "Submitted and waiting for management"}
          </small>
        </button>
        <button
          className="stat-card green"
          onClick={() =>
            document
              .getElementById("ready-list")
              ?.scrollIntoView({ behavior: "smooth" })
          }
        >
          <div>
            <span>New Phase Ready</span>
            <b>{readyProjects.length}</b>
          </div>
          <small>See which project can continue</small>
        </button>
      </section>
      <section className="overview-attention-grid">
        <div className="panel attention-panel" id="attention-list">
          <div className="panel-head">
            <div>
              <h3>Action required</h3>
              <p>Only Projects that need a human decision or correction</p>
            </div>
            <span className="count">{attention.length}</span>
          </div>
          {attention.length ? (
            attention.map((p) => (
              <button
                className="attention-item"
                key={p.id}
                onClick={() => open(p)}
              >
                <span className="attention-dot" />
                <div>
                  <b>{p.client}</b>
                  <small>
                    {p.id} · {actionLabel(p)}
                  </small>
                </div>
                <strong>{operationalState(p).nextAction} →</strong>
              </button>
            ))
          ) : (
            <div className="mini-empty">No project needs action right now.</div>
          )}
        </div>
        <div className="panel attention-panel" id="ready-list">
          <div className="panel-head">
            <div>
              <h3>New phase ready</h3>
              <p>Approved work ready to continue</p>
            </div>
            <span className="count">{readyProjects.length}</span>
          </div>
          {readyProjects.length ? (
            readyProjects.map((p) => (
              <button
                className="attention-item ready"
                key={p.id}
                onClick={() => open(p)}
              >
                <span className="attention-dot" />
                <div>
                  <b>{p.client}</b>
                  <small>
                    {p.id} · {operationalState(p).reason}
                  </small>
                </div>
                <strong>{operationalState(p).nextAction} →</strong>
              </button>
            ))
          ) : (
            <div className="mini-empty">No newly unlocked phase.</div>
          )}
        </div>
      </section>
      <section className="panel">
        <div className="panel-head">
          <div>
            <h3>Live project progress</h3>
            <p>
              Current stage, completion bar and next action for every visible
              project
            </p>
          </div>
        </div>
        {ps.map((p) => (
          <Row key={p.id} p={p} open={open} />
        ))}
      </section>
    </>
  );
}
function Row({
  p,
  open,
  expandSlots = false,
}: {
  p: P;
  open: (p: P) => void;
  expandSlots?: boolean;
}) {
  const [expanded, setExpanded] = useState(false),
    op = operationalState(p),
    hasSlots =
      expandSlots && p.projectMode === "package" && p.videoSlots?.length > 0;
  return (
    <article className={`project-row-shell ${expanded ? "expanded" : ""}`}>
      <div className="project-row">
        <div className="project-avatar violet">
          {String(p.client || p.id)
            .split(" ")
            .map((x: string) => x[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()}
        </div>
        <button className="project-main project-open" onClick={() => open(p)}>
          <div className="project-title">
            <h4>{p.client}</h4>
            <span>{p.projectType || p.type}</span>
            {p.recurring && <span className="repeat">↻ {p.recurring}</span>}
          </div>
          <p>
            {p.id} · {op.phase}
          </p>
          <span className={`operational-pill ${op.tone}`}>{op.status}</span>
          <small className="operational-reason">{op.reason}</small>
          <StageTrack project={p} />
        </button>
        <div className="stage-badges">
          <State label="Brief" value={p.briefStatus} />
          <State label="Market" value={p.marketStatus} />
          <State label="Trend" value={p.trendStatus} />
        </div>
        {hasSlots ? (
          <button
            className="slot-expand-arrow"
            aria-label="Show video slot status"
            onClick={() => setExpanded(!expanded)}
          >
            <span>{expanded ? "Close slots" : "Video slots"}</span>
            <i>{expanded ? "⌃" : "⌄"}</i>
          </button>
        ) : (
          <button className="row-arrow" onClick={() => open(p)}>
            ›
          </button>
        )}
      </div>
      {expanded && (
        <div className="project-slot-preview">
          {p.videoSlots.map((slot: any) => {
            const phase = slot.data?.phases?.creativeDirection;
            return (
              <button key={slot.id} onClick={() => open(p)}>
                <b>Slot {String(slot.slotNumber).padStart(2, "0")}</b>
                <span>{slot.purpose || "Purpose not selected"}</span>
                <em>{phase?.status || slot.status}</em>
                <small>
                  {slot.data?.currentPhase || "Awaiting activation"}
                </small>
              </button>
            );
          })}
        </div>
      )}
    </article>
  );
}
function State({ label, value }: { label: string; value: string }) {
  return (
    <span
      className={`stage-chip ${String(value).toLowerCase().replace(" ", "-")}`}
    >
      {`${label}: ${value || "Draft"}`}
    </span>
  );
}
function ProjectList({ ps, open }: { ps: P[]; open: (p: P) => void }) {
  return (
    <section className="panel page-panel">
      <div className="panel-head">
        <div>
          <h3>Projects</h3>
          <p>
            Tap the project name to open it. Package projects can expand to show
            every Video Slot.
          </p>
        </div>
      </div>
      {ps.map((p) => (
        <Row key={p.id} p={p} open={open} expandSlots />
      ))}
    </section>
  );
}
const workflowStages = [
  "Client Brief",
  "Market Research",
  "Trend Research",
  "Creative Direction",
  "Script",
  "Storyboard + Visual Generation",
  "Video Generation",
  "Editing",
  "Client Review",
  "Final Delivery",
  "Project Review",
];
function projectStep(p: P) {
  const stage = String(p.stage || p.assignmentStage || "").toLowerCase();
  if (stage.includes("client brief")) return "brief";
  if (stage.includes("assign")) return "assign";
  if (
    p.marketStatus !== "Approved" ||
    p.trendStatus !== "Approved" ||
    stage.includes("research")
  )
    return "research";
  if (p.type === "MV" && p.foundationStatus !== "Approved") return "foundation";
  if (stage.includes("mv music") || stage.includes("script")) return "script";
  if (p.type === "MV" && stage.includes("visual script"))
    return "visual-script";
  if (
    stage.includes("storyboard") ||
    stage.includes("production design") ||
    stage.includes("visual development") ||
    stage.includes("image") ||
    stage.includes("video") ||
    p.scriptStatus === "Approved"
  )
    return "production";
  return p.type === "MV" ? "foundation" : "research";
}
function ProjectWorkspace({
  p,
  tier,
  owner,
  back,
  act,
}: {
  p: P;
  tier: number;
  owner: boolean;
  back: () => void;
  act: (id: string, b: Record<string, string>) => void;
}) {
  const foundationApproved =
      p.marketStatus === "Approved" && p.trendStatus === "Approved",
    recurring =
      p.projectNature === "recurring" ||
      (!p.projectNature && Boolean(p.recurring)),
    scriptApproved = p.scriptStatus === "Approved",
    projectStages = recurring
      ? [
          "Client Brief",
          "Market Research",
          "Trend Research",
          "Creative Direction",
          "Content Ideas",
          "Image Generation",
          "Video Generation · Reels only",
          "Client Review",
          "Final Delivery",
        ]
      : workflowStages,
    [step, setStep] = useState(projectStep(p)),
    readOnly = tier >= 2;
  useEffect(() => {
    setStep(projectStep(p));
  }, [p.stage, p.approvalTitle, p.scriptStatus, p.foundationStatus]);
  return (
    <>
      <button className="back-btn" onClick={back}>
        ← Back to projects
      </button>
      <section className="detail-hero">
        <div>
          <p className="eyebrow">
            {p.id} · {p.projectType || p.type}
          </p>
          <h2>{p.client}</h2>
          <p>{p.stage}</p>
          <div className="canonical-status">
            <span>{p.projectStatus || "Active"}</span>
            <span>{p.phaseStatus || "In Progress"}</span>
            {p.purpose && <span>{p.purpose}</span>}
          </div>
        </div>
        {owner && p.driveUrl && (
          <a
            className="open-folder prominent"
            href={p.driveUrl}
            target="_blank"
          >
            Open linked Drive folder ↗
          </a>
        )}
      </section>
      <div
        className={`drive-sync-note ${p.driveSyncStatus?.startsWith("Pending") ? "pending" : ""}`}
      >
        <b>Version records protected</b>
        <span>
          Brief v{p.briefVersion || 0} · Foundation v{p.researchVersion || 0} ·
          Drive: {p.driveSyncStatus || "Not connected"}
        </span>
      </div>
      {readOnly && (
        <div className="readonly-banner">
          <b>Assigned project access</b>
          <span>
            Work assigned to you remains editable until it is submitted for
            approval.
          </span>
        </div>
      )}
      <ProjectPhaseBar p={p} recurring={recurring} />
      <WorkspacePhaseTabs
        p={p}
        recurring={recurring}
        step={step}
        onSelect={setStep}
        onAssign={() => setStep("assign")}
      />
      {step === "brief" ? (
        <>
          <ContextExport p={p} phase="brief" />
          {readOnly ? (
            <ReadOnlyBrief p={p} />
          ) : (
            <BriefForm
              p={p}
              save={(b) => act(p.id, { action: "saveBrief", ...b })}
            />
          )}
        </>
      ) : step === "assign" ? (
        readOnly ? (
          <ReadOnlyAssign p={p} />
        ) : (
          <AssignForm
            p={p}
            save={(b) => act(p.id, { action: "assign", ...b })}
          />
        )
      ) : step === "script" ? (
        <ScriptForm
          p={p}
          save={(b) =>
            act(p.id, { action: "submitScript", scriptData: JSON.stringify(b) })
          }
        />
      ) : step === "visual-script" ? (
        <MVVisualScript
          p={p}
          save={(action, payload) =>
            act(p.id, { action, payload: JSON.stringify(payload) })
          }
        />
      ) : step === "storyboard" ? (
        <StoryboardWorkspace
          p={p}
          save={(action, payload) =>
            act(p.id, { action, payload: JSON.stringify(payload) })
          }
        />
      ) : step === "production" ? (
        <ProductionBuilder
          p={p}
          recurring={recurring}
          save={(action, payload) =>
            act(p.id, { action, payload: JSON.stringify(payload) })
          }
        />
      ) : step === "foundation" && p.type === "MV" ? (
        <MVFoundation p={p} tier={tier} act={act} />
      ) : foundationApproved ? (
        <>
          <ContextExport p={p} phase="foundation" />
          <LockedFoundation p={p} />
        </>
      ) : (
        <>
          <ContextExport p={p} phase="foundation" />
          <div
            className={
              tier <= 1 && p.marketStatus === "Submitted"
                ? "foundation-readonly"
                : ""
            }
          >
            <CombinedResearchForm
              p={p}
              save={(b) =>
                act(p.id, { action: "submitCombinedResearch", ...b })
              }
            />
          </div>
          {tier <= 1 && p.marketStatus === "Submitted" && (
            <FoundationReviewPanel p={p} act={act} />
          )}
        </>
      )}
    </>
  );
}
function MVFoundation({
  p,
  tier,
  act,
}: {
  p: P;
  tier: number;
  act: (id: string, b: Record<string, string>) => void;
}) {
  let d: any = {};
  try {
    d = JSON.parse(p.scriptData || "{}").foundation || {};
  } catch {}
  const submitted = p.foundationStatus === "Submitted",
    approved = p.foundationStatus === "Approved",
    [note, setNote] = useState("");
  return (
    <>
      <section className="panel review-card foundation-recap">
        <div className="form-card-head">
          <p className="eyebrow">04 · INDEPENDENT FOUNDATION</p>
          <h3>MV Foundation</h3>
          <p>
            This checkpoint converts the approved 01–03 research and creative
            direction into the production rules for the MV. Updating the Client
            Brief does not reopen this checkpoint automatically.
          </p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            act(p.id, {
              action: "submitFoundation",
              payload: JSON.stringify(Object.fromEntries(f)),
            });
          }}
        >
          <Field
            area
            name="directionSummary"
            label="Production direction summary"
            value={d.directionSummary}
            placeholder="Summarise the visual and narrative direction that all later phases must follow."
          />
          <Field
            area
            name="continuityRules"
            label="Character, world & continuity rules"
            value={d.continuityRules}
            placeholder="Identity, wardrobe, locations, props, palette and details that must remain consistent."
          />
          <Field
            area
            name="creativeRules"
            label="Creative execution rules"
            value={d.creativeRules}
            placeholder="What the Storyboard, Visual Script and image generation must achieve or avoid."
          />
          <Field
            area
            name="successCriteria"
            label="Approval criteria"
            value={d.successCriteria}
            placeholder="How management will judge whether later work follows the approved Foundation."
          />
          {!approved && !submitted && (
            <div className="form-actions">
              <button
                type="button"
                onClick={(e) => {
                  const form = e.currentTarget.closest(
                    "form",
                  ) as HTMLFormElement;
                  act(p.id, {
                    action: "saveFoundation",
                    payload: JSON.stringify(
                      Object.fromEntries(new FormData(form)),
                    ),
                  });
                }}
              >
                Save draft
              </button>
              <button className="create-btn">Submit 04 for approval →</button>
            </div>
          )}
        </form>
      </section>
      {submitted && tier <= 1 && (
        <section className="panel foundation-inline-review">
          <div className="form-card-head">
            <p className="eyebrow">MANAGEMENT REVIEW · 04</p>
            <h3>Foundation decision</h3>
            <p>
              Review only. The submitted Foundation cannot be edited during
              approval.
            </p>
          </div>
          <div className="foundation-decision">
            <label>
              Review comment
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Required only when returning for revision."
              />
            </label>
            <div>
              <button
                className="revise"
                disabled={!note.trim()}
                onClick={() =>
                  act(p.id, {
                    action: "reviewFoundation",
                    decision: "revise",
                    reviewNote: note,
                  })
                }
              >
                ✕ Return for revision
              </button>
              <button
                className="approve"
                onClick={() =>
                  act(p.id, { action: "reviewFoundation", decision: "approve" })
                }
              >
                ✓ Approve 04 → Lyrics & Style
              </button>
            </div>
          </div>
        </section>
      )}
      {approved && (
        <div className="readonly-banner">
          <b>✓ Foundation v{p.foundationVersion || 1} approved</b>
          <span>05A Lyrics & Style is now unlocked.</span>
        </div>
      )}
    </>
  );
}

function LockedFoundation({ p }: { p: P }) {
  const [editing, setEditing] = useState(false),
    send = async (b: Record<string, string>) => {
      await fetch("/api/projects", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: p.id,
          action: "submitCombinedResearch",
          ...b,
        }),
      });
      location.reload();
    };
  if (editing)
    return (
      <>
        <div className="amend-warning">
          <b>Amending an approved direction</b>
          <span>
            Saving changes sends the updated Foundation back to Tier 0–1 for
            review and records an edit notification.
          </span>
          <button onClick={() => setEditing(false)}>Cancel</button>
        </div>
        <CombinedResearchForm p={p} save={send} />
      </>
    );
  const rows = [
    ["Market snapshot", p.marketSnapshot],
    ["Market opportunities", p.marketOpportunities],
    ["Trend observations", p.trendObservations],
    ["Why the trends fit", p.trendFit],
    ["Creative concept", p.creativeConcept],
    ["Creative objective", p.creativeObjective],
    ["Content pillars", p.contentPillars],
    ["Visual style & art direction", p.visualStyle],
    ["Format direction", p.formatDirection],
    ["Tone, mood & pacing", p.toneMood],
  ];
  return (
    <section className="panel review-card foundation-recap">
      <div className="form-card-head">
        <p className="eyebrow">
          APPROVED DIRECTION · VERSION {p.researchVersion || 1}
        </p>
        <h3>Foundation Direction</h3>
        <p>
          Full approved Market Research, Trend Research and Creative Direction.
          Everyone assigned to this project can refer back to it.
        </p>
        <button className="amend-btn" onClick={() => setEditing(true)}>
          Edit direction & resubmit →
        </button>
      </div>
      <div className="review-grid">
        {rows.map(([k, v]) => (
          <div className="review-field" key={k}>
            <small>{k}</small>
            <p>{v || "—"}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
function ReadOnlyBrief({ p }: { p: P }) {
  const rows = [
    ["Prepared by", p.briefOwner],
    ["Client / Brand", p.clientName || p.client],
    ["Brand background", p.brandOverview],
    ["Project goal", p.projectGoal],
    ["Target audience", p.audience],
    ["Deliverables", p.deliverables],
    ["Key message", p.keyMessage],
    ["Tone", p.tone],
    ["Due date", p.dueDate],
    ["Must include / avoid", p.restrictions],
  ];
  return (
    <ReviewCard title="Client Brief" note="Read-only for this permission tier.">
      {rows.map(([k, v]) => (
        <div className="review-field" key={k}>
          <small>{k}</small>
          <p>{v || "Not provided yet"}</p>
        </div>
      ))}
    </ReviewCard>
  );
}
function ReadOnlyAssign({ p }: { p: P }) {
  return (
    <ReviewCard
      title="Individual Assignment"
      note="Only management can change assignees."
    >
      <div className="review-field">
        <small>Responsible people</small>
        <p>{p.researchAssignee || "Not assigned"}</p>
      </div>
      <div className="review-field">
        <small>Stage / deadline</small>
        <p>
          {p.assignmentStage || "Foundation 01–03"} ·{" "}
          {p.assignmentDueAt || "No deadline set"}
        </p>
      </div>
    </ReviewCard>
  );
}
function ReviewCard({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: any;
}) {
  return (
    <section className="panel review-card">
      <div className="form-card-head">
        <p className="eyebrow">REVIEW ONLY</p>
        <h3>{title}</h3>
        <p>{note}</p>
      </div>
      <div className="review-grid">{children}</div>
    </section>
  );
}
function BriefForm({
  p,
  save,
}: {
  p: P;
  save: (b: Record<string, string>) => void;
}) {
  return (
    <FormCard
      eyebrow="STEP 1 · YOUR ASSIGNED TASK"
      title="Client Brief"
      subtitle="Completed by the project creator or assigned Project Manager. This becomes the shared source of truth for everyone assigned to the project."
      onSubmit={save}
      submit={
        p.briefStatus === "Complete"
          ? "Update Client Brief"
          : "Complete Brief & unlock assignment"
      }
    >
      <div className="project-deadline-note">
        <b>Project schedule</b>
        <span>
          {p.projectStartDate || "Start date not set"} →{" "}
          {p.projectEndDate || "End date not set"}
        </span>
        <small>
          The project deadline was set when this project was created, so it does
          not need to be entered again.
        </small>
      </div>
      <div className="form-grid">
        <Field
          name="briefOwner"
          label="Prepared by / Project Manager"
          value={p.briefOwner}
        />
        <Field
          name="clientName"
          label="Client / Brand"
          value={p.clientName || p.client}
        />
      </div>
      <Field
        area
        name="brandOverview"
        label="Brand / Product background"
        value={p.brandOverview}
        placeholder="What does the client do? What are we promoting?"
      />
      <Field
        area
        name="projectGoal"
        label="Project goal"
        value={p.projectGoal}
        placeholder="What must this content achieve?"
      />
      <div className="form-grid">
        <Field
          area
          name="audience"
          label="Target audience"
          value={p.audience}
        />
        <Field
          area
          name="deliverables"
          label="Deliverables"
          value={p.deliverables}
          placeholder="e.g. 1 × 30s video, 3 × 9:16 cutdowns"
        />
      </div>
      <Field
        area
        name="keyMessage"
        label="Key message / Offer"
        value={p.keyMessage}
      />
      <Field name="tone" label="Tone / Visual direction" value={p.tone} />
      <Field
        area
        name="restrictions"
        label="Must include / Must avoid"
        value={p.restrictions}
      />
      {p.briefDocUrl && (
        <a className="doc-link" href={p.briefDocUrl} target="_blank">
          Open shared Client Brief in Google Drive ↗
        </a>
      )}
    </FormCard>
  );
}
function AssignForm({
  p,
  save,
}: {
  p: P;
  save: (b: Record<string, string>) => void;
}) {
  const [members, setMembers] = useState<any[]>([]),
    selected: string[] = (() => {
      try {
        return JSON.parse(p.assignmentMembers || "[]");
      } catch {
        return [];
      }
    })();
  useEffect(() => {
    fetch("/api/members")
      .then((r) => r.json())
      .then((d) => setMembers(d.members || []));
  }, []);
  return (
    <FormCard
      eyebrow="INDIVIDUAL ASSIGNMENT · MANAGEMENT"
      title="Assign responsible people"
      subtitle={`Select one or more people for Foundation 01–03. You can assign yourself too. The existing project deadline (${p.projectEndDate || "not set"}) is reused automatically.`}
      onSubmit={(b) => {
        const emails = Object.keys(b)
          .filter((k) => k.startsWith("member_"))
          .map((k) => b[k]);
        save({ assigneeEmails: JSON.stringify(emails) });
      }}
      submit="Assign people & open Foundation"
    >
      <div className="project-deadline-note compact">
        <b>Task deadline inherited from project</b>
        <span>{p.projectEndDate || "No project end date set"}</span>
      </div>
      <div className="individual-picker">
        {members.length ? (
          members.map((m) => (
            <label key={m.email}>
              <input
                type="checkbox"
                name={`member_${m.email}`}
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
          ))
        ) : (
          <div className="mini-empty">
            Add members before assigning this project.
          </div>
        )}
      </div>
    </FormCard>
  );
}
function CombinedResearchForm({
  p,
  save,
}: {
  p: P;
  save: (b: Record<string, string>) => void;
}) {
  let initial: any[] = [];
  try {
    initial = JSON.parse(p.marketReferences || p.trendReferences || "[]");
  } catch {}
  const [count, setCount] = useState(Math.max(1, initial.length));
  return (
    <FormCard
      eyebrow={`01–03 · ${p.marketStatus}`}
      title="Research + Creative Direction"
      subtitle={`Responsible team: ${p.researchAssignee || "Unassigned"}. Complete all three sections, then management reviews and approves them together.`}
      onSubmit={(b) => {
        const refs = Array.from({ length: count }, (_, i) => ({
          url: b[`refUrl${i}`] || "",
          note: b[`refNote${i}`] || "",
        })).filter((x) => x.url);
        const clean = { ...b };
        Object.keys(clean)
          .filter((k) => k.startsWith("ref"))
          .forEach((k) => delete clean[k]);
        save({
          ...clean,
          marketReferences: JSON.stringify(refs),
          trendReferences: JSON.stringify(refs),
        });
      }}
      submit={
        p.marketStatus === "Submitted"
          ? "Update foundation for review"
          : "Submit 01–03 for approval"
      }
    >
      <section className="research-section">
        <div className="research-number">01</div>
        <div>
          <h4>Market Research</h4>
          <p>Understand the audience, competitors and market opportunity.</p>
        </div>
      </section>
      <Field
        area
        name="marketSnapshot"
        label="Market snapshot"
        value={p.marketSnapshot}
        placeholder="3–5 concise observations about audience, category and competitors"
      />
      <Field
        area
        name="marketOpportunities"
        label="Market opportunities"
        value={p.marketOpportunities}
      />
      <section className="research-section trend">
        <div className="research-number">02</div>
        <div>
          <h4>Trend Research</h4>
          <p>Identify relevant formats, behaviours and references.</p>
        </div>
      </section>
      <Field
        area
        name="trendObservations"
        label="Trend observations"
        value={p.trendObservations}
      />
      <Field
        area
        name="trendFit"
        label="Why these trends fit this client"
        value={p.trendFit}
      />
      <div className="references">
        <div className="reference-head">
          <div>
            <b>Shared reference library</b>
            <small>
              TikTok, Instagram, YouTube, Xiaohongshu, websites or competitors
            </small>
          </div>
          <button type="button" onClick={() => setCount(count + 1)}>
            ＋ Add reference
          </button>
        </div>
        {Array.from({ length: count }, (_, i) => (
          <div className="reference-row" key={i}>
            <span>{String(i + 1).padStart(2, "0")}</span>
            <input
              name={`refUrl${i}`}
              defaultValue={initial[i]?.url || ""}
              placeholder="https://..."
            />
            <input
              name={`refNote${i}`}
              defaultValue={initial[i]?.note || ""}
              placeholder="Why is this worth referencing?"
            />
            {/^https?:\/\//i.test(initial[i]?.url || "") && (
              <a
                className="reference-open"
                href={initial[i].url}
                target="_blank"
                rel="noreferrer"
              >
                Open ↗
              </a>
            )}
          </div>
        ))}
      </div>
      <section className="research-section creative">
        <div className="research-number">03</div>
        <div>
          <h4>Creative Direction</h4>
          <p>
            Turn the approved insight into a clear creative system before
            scripting.
          </p>
        </div>
      </section>
      <div className="form-grid">
        <Field
          area
          name="creativeConcept"
          label="Core creative concept"
          value={p.creativeConcept}
          placeholder="The main idea in one clear paragraph"
        />
        <Field
          area
          name="creativeObjective"
          label="Creative objective"
          value={p.creativeObjective}
          placeholder="What should the audience think, feel or do?"
        />
      </div>
      <Field
        area
        name="contentPillars"
        label="Content pillars / recurring themes"
        value={p.contentPillars}
        placeholder="e.g. lifestyle, education, behind-the-scenes, product proof"
      />
      <div className="form-grid">
        <Field
          area
          name="visualStyle"
          label="Visual style & art direction"
          value={p.visualStyle}
        />
        <Field
          area
          name="formatDirection"
          label="Format direction"
          value={p.formatDirection}
          placeholder="Photo, carousel, Reels, 15s/30s video and why"
        />
      </div>
      <Field
        area
        name="toneMood"
        label="Tone, mood & pacing"
        value={p.toneMood}
      />
    </FormCard>
  );
}

function StoryboardWorkspace({
  p,
  save,
}: {
  p: P;
  save: (action: string, payload: any[]) => void;
}) {
  let d: any = {};
  try {
    d = JSON.parse(p.scriptData || "{}");
  } catch {}
  const approved =
    d.storyboardStatus === "approved" ||
    /Visual Development|Production Design|Image Generation|Video Generation|Editing|Client Review|Final Delivery/i.test(
      String(p.stage || ""),
    );
  if (!approved)
    return <ProductionBuilder p={p} recurring={false} save={save} />;
  const reviews = Array.isArray(d.productionReviews) ? d.productionReviews : [];
  return (
    <section className="panel production-review-page approved-storyboard-view">
      <div className="form-card-head">
        <p className="eyebrow">APPROVED STORYBOARD · READ ONLY</p>
        <h3>{d.storyboard?.length || 0} approved shots</h3>
        <p>
          The approved Storyboard remains available after the project advances.
          It cannot be changed from this view.
        </p>
      </div>
      <div className="production-review-items">
        {(d.storyboard || []).map((x: any, i: number) => (
          <article className="production-review-item approved" key={i}>
            <header>
              <span>SHOT {String(i + 1).padStart(2, "0")}</span>
              <b>
                {x.duration || "Duration TBC"} · {x.framing || "Framing TBC"}
              </b>
              {x.keyShot && (
                <strong className="key-shot-badge">★ KEY SHOT</strong>
              )}
            </header>
            <div className="readonly-production-content">
              <div className="shot-tech">
                <span>{x.camera || "Camera TBC"}</span>
                <span>{x.movement || "Movement TBC"}</span>
                <span>{x.lighting || "Lighting TBC"}</span>
              </div>
              <small>TIMELINE & VISUAL</small>
              <p>{x.description || "—"}</p>
              <small>CHARACTER MOTION</small>
              <p>{x.characterMotion || "—"}</p>
              {x.dialogue && (
                <>
                  <small>DIALOGUE / VO</small>
                  <p>{x.dialogue}</p>
                </>
              )}
              <div className="item-review-panel approved">
                <b>✓ Approved</b>
                <p>
                  {reviews[i]?.note ||
                    "This shot is locked as an approved production reference."}
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ProductionBuilder({
  p,
  recurring,
  save,
}: {
  p: P;
  recurring: boolean;
  save: (action: string, payload: any[]) => void;
}) {
  let d: any = {};
  try {
    d = JSON.parse(p.scriptData || "{}");
  } catch {}
  const visual =
      /Visual Development|Production Design & Image Generation/i.test(
        String(p.assignmentStage || p.stage || ""),
      ),
    waiting =
      p.assignmentStatus === "Awaiting Approval" && Boolean(p.approvalTitle),
    [tier, setTier] = useState<number | null>(null);
  useEffect(() => {
    fetch("/api/session")
      .then((r) => r.json())
      .then((x) => setTier(Number(x.member?.tier ?? 4)))
      .catch(() => setTier(4));
  }, []);
  if (waiting) {
    if (tier === null)
      return <div className="loading">Preparing read-only review…</div>;
    if (visual)
      return (
        <VisualPackageReview
          p={p}
          items={d.visualDevelopment || []}
          reviewer={tier <= 1}
          submit={(reviews) => save("reviewProductionItems", reviews)}
        />
      );
    return (
      <UnifiedProductionReview
        p={p}
        data={d}
        recurring={recurring}
        reviewer={tier <= 1}
        submit={(reviews) => save("reviewProductionItems", reviews)}
      />
    );
  }
  const feedback = Array.isArray(d.productionReviews)
    ? d.productionReviews
    : [];
  if (
    p.assignmentStatus === "Revision Requested" &&
    feedback.some((r: any) => r.status === "refine") &&
    !visual
  )
    return recurring ? (
      <SocialRevisionWorkspace
        p={p}
        data={d}
        save={(x) => save("saveImageGeneration", x)}
        submit={() => save("submitSavedProduction", [])}
      />
    ) : (
      <HandlerRevisionWorkspace
        data={d}
        recurring={false}
        save={(x) => save("saveStoryboard", x)}
        submit={() => save("submitSavedProduction", [])}
      />
    );
  const productionData = {
    ...d,
    foundationContext: {
      market: p.marketSnapshot,
      trends: p.trendObservations,
      creativeConcept: p.creativeConcept,
      creativeObjective: p.creativeObjective,
      visualStyle: p.visualStyle,
      toneMood: p.toneMood,
      formatDirection: p.formatDirection,
    },
  };
  return (
    <>
      {feedback.length > 0 && (
        <ProductionFeedback reviews={feedback} recurring={recurring} />
      )}{" "}
      {visual ? (
        <VisualDevelopmentBuilderV2
          p={p}
          data={productionData}
          save={(x) => save("saveVisualDevelopment", x)}
          submit={(x) => save("submitVisualDevelopment", x)}
        />
      ) : recurring ? (
        <ImageGenerationBuilder
          p={p}
          ideas={d.ideas || []}
          initial={d.imageGeneration || []}
          save={(x) => save("saveImageGeneration", x)}
        />
      ) : (
        <KeyShotStoryboardBuilder
          script={d}
          initial={d.storyboard || []}
          save={(x) => save("saveStoryboard", x)}
        />
      )}
      {!visual && (
        <section className="production-submit-bar">
          <div>
            <b>Ready for the approval checkpoint?</b>
            <span>
              Save the latest draft and upload a current image set for every
              visual item, then submit to Tier 0–1.
            </span>
          </div>
          <button onClick={() => save("submitSavedProduction", [])}>
            Submit Phase for Approval →
          </button>
        </section>
      )}
    </>
  );
}
function SocialRevisionWorkspace({
  p,
  data,
  save,
  submit,
}: {
  p: P;
  data: any;
  save: (x: any[]) => void;
  submit: () => void;
}) {
  const ideas = data.ideas || [],
    reviews = data.productionReviews || [],
    [items, setItems] = useState<any[]>(
      (data.imageGeneration || []).map((x: any, i: number) =>
        String(x.prompt || "").includes("Build one decisive visual moment")
          ? x
          : {
              ...x,
              prompt: detailedPrompt(ideas[i] || {}, i, Number(x.variant || 0)),
            },
      ),
    ),
    update = (i: number, patch: any) =>
      setItems((x) => x.map((a, j) => (j === i ? { ...a, ...patch } : a))),
    regenerate = (i: number) => {
      const variant = Number(items[i]?.variant || 0) + 1;
      update(i, {
        variant,
        prompt: detailedPrompt(ideas[i] || {}, i, variant),
      });
    };
  return (
    <section className="panel handler-revision">
      <div className="form-card-head">
        <p className="eyebrow">SOCIAL REVISION · PROMPT + MULTI-IMAGE</p>
        <h3>Revise the exact block requested</h3>
        <p>
          The professional AI formula remains available during revision. Upload
          one or several replacement images by clicking or dragging them into
          the field.
        </p>
      </div>
      <div className="handler-revision-list">
        {items.map((x: any, i: number) => {
          const r = reviews[i] || {},
            locked = r.status === "approved";
          return (
            <article
              className={`handler-revision-item ${locked ? "approved" : "refine"}`}
              key={i}
            >
              <header>
                <span>BLOCK {String(i + 1).padStart(2, "0")}</span>
                <b>{ideas[i]?.title || "Content idea"}</b>
                <strong>{locked ? "✓ APPROVED" : "✕ REVISION"}</strong>
              </header>
              <div className="source-story">
                <small>APPROVED STORY</small>
                <p>{ideas[i]?.story || "—"}</p>
              </div>
              <div className="revision-prompt-head">
                <b>Professional image prompt</b>
                {!locked && (
                  <button onClick={() => regenerate(i)}>
                    ✦ Generate a new full prompt
                  </button>
                )}
              </div>
              <label>
                <textarea
                  disabled={locked}
                  value={x.prompt || ""}
                  onChange={(e) => update(i, { prompt: e.target.value })}
                />
              </label>
              <VisualAssetUploader
                projectId={p.id}
                phase="social-image"
                itemKey={`block-${i + 1}`}
                readonly={locked}
              />
              <div className={`attached-review ${locked ? "approved" : ""}`}>
                <b>
                  {locked
                    ? "Approved by management"
                    : "Management refinement comment"}
                </b>
                <p>
                  {locked
                    ? "Prompt and approved image set remain locked."
                    : r.note || "Please refine this block."}
                </p>
              </div>
            </article>
          );
        })}
      </div>
      <footer className="builder-footer">
        <span>
          {reviews.filter((r: any) => r.status === "refine").length} block(s)
          require changes
        </span>
        <div>
          <button className="add-shot" onClick={() => save(items)}>
            Save Revised Prompt
          </button>
          <button className="save-production" onClick={submit}>
            Resubmit Prompt + Images →
          </button>
        </div>
      </footer>
    </section>
  );
}
function HandlerRevisionWorkspace({
  data,
  recurring,
  save,
  submit,
}: {
  data: any;
  recurring: boolean;
  save: (x: any[]) => void;
  submit: () => void;
}) {
  const source = recurring ? data.imageGeneration || [] : data.storyboard || [],
    ideas = data.ideas || [],
    reviews = data.productionReviews || [],
    [items, setItems] = useState<any[]>(source),
    update = (i: number, k: string, v: string) =>
      setItems((x) => x.map((a, j) => (j === i ? { ...a, [k]: v } : a)));
  return (
    <section className="panel handler-revision">
      <div className="form-card-head">
        <p className="eyebrow">REVISION TASK · INLINE FEEDBACK</p>
        <h3>Address only the red items</h3>
        <p>
          Management comments stay attached to their exact{" "}
          {recurring ? "content block" : "shot"}. Green items were approved and
          are locked to prevent accidental changes.
        </p>
      </div>
      <div className="handler-revision-list">
        {items.map((x: any, i: number) => {
          const r = reviews[i] || {},
            locked = r.status === "approved";
          return (
            <article
              className={`handler-revision-item ${locked ? "approved" : "refine"}`}
              key={i}
            >
              <header>
                <span>
                  {recurring ? "BLOCK" : "SHOT"}{" "}
                  {String(i + 1).padStart(2, "0")}
                </span>
                <b>
                  {recurring
                    ? ideas[i]?.title || "Content idea"
                    : `${x.duration || "Duration TBC"} · ${x.framing || "Shot"}`}
                </b>
                <strong>{locked ? "✓ APPROVED" : "✕ REVISION"}</strong>
              </header>
              {recurring ? (
                <label>
                  Image generation prompt
                  <textarea
                    disabled={locked}
                    value={x.prompt || ""}
                    onChange={(e) => update(i, "prompt", e.target.value)}
                  />
                </label>
              ) : (
                <>
                  <div className="revision-fields">
                    <label>
                      Duration
                      <input
                        disabled={locked}
                        value={x.duration || ""}
                        onChange={(e) => update(i, "duration", e.target.value)}
                      />
                    </label>
                    <label>
                      Framing
                      <input
                        disabled={locked}
                        value={x.framing || ""}
                        onChange={(e) => update(i, "framing", e.target.value)}
                      />
                    </label>
                    <label>
                      Camera
                      <input
                        disabled={locked}
                        value={x.camera || ""}
                        onChange={(e) => update(i, "camera", e.target.value)}
                      />
                    </label>
                    <label>
                      Movement
                      <input
                        disabled={locked}
                        value={x.movement || ""}
                        onChange={(e) => update(i, "movement", e.target.value)}
                      />
                    </label>
                    <label>
                      Lighting
                      <input
                        disabled={locked}
                        value={x.lighting || ""}
                        onChange={(e) => update(i, "lighting", e.target.value)}
                      />
                    </label>
                  </div>
                  <label>
                    Timeline & visual
                    <textarea
                      disabled={locked}
                      value={x.description || ""}
                      onChange={(e) => update(i, "description", e.target.value)}
                    />
                  </label>
                  <div className="revision-fields two">
                    <label>
                      Character motion
                      <textarea
                        disabled={locked}
                        value={x.characterMotion || ""}
                        onChange={(e) =>
                          update(i, "characterMotion", e.target.value)
                        }
                      />
                    </label>
                    <label>
                      Dialogue / VO
                      <textarea
                        disabled={locked}
                        value={x.dialogue || ""}
                        onChange={(e) => update(i, "dialogue", e.target.value)}
                      />
                    </label>
                  </div>
                </>
              )}
              <div className={`attached-review ${locked ? "approved" : ""}`}>
                <b>
                  {locked
                    ? "Approved by management"
                    : "Management refinement comment"}
                </b>
                <p>
                  {locked
                    ? "Keep this item unchanged."
                    : r.note || "Please revise this item."}
                </p>
              </div>
            </article>
          );
        })}
      </div>
      <footer className="builder-footer">
        <span>
          {reviews.filter((r: any) => r.status === "refine").length} item(s)
          require changes
        </span>
        <div>
          <button className="add-shot" onClick={() => save(items)}>
            Save Revised Draft
          </button>
          <button className="save-production" onClick={submit}>
            Resubmit for Approval →
          </button>
        </div>
      </footer>
    </section>
  );
}
function ProductionFeedback({
  reviews,
  recurring,
}: {
  reviews: any[];
  recurring: boolean;
}) {
  return (
    <section className="production-feedback">
      <b>Latest management review</b>
      <span>
        Green items are approved. Only revise the red items before resubmitting.
      </span>
      <div>
        {reviews.map((r: any, i: number) => (
          <article
            className={r.status === "approved" ? "approved" : "refine"}
            key={i}
          >
            <strong>
              {recurring ? "Block" : "Shot"} {String(i + 1).padStart(2, "0")}
            </strong>
            <p>
              {r.status === "approved"
                ? "Approved — keep this item unchanged."
                : r.note || "Refinement requested."}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
function ProductionItemReview({
  p,
  data,
  recurring,
  reviewer,
  submit,
}: {
  p: P;
  data: any;
  recurring: boolean;
  reviewer: boolean;
  submit: (x: any[]) => void;
}) {
  const items = recurring ? data.imageGeneration || [] : data.storyboard || [],
    ideas = data.ideas || [],
    stored = Array.isArray(data.productionReviews)
      ? data.productionReviews
      : [],
    [reviews, setReviews] = useState<any[]>(
      items.map((_: any, i: number) => stored[i] || { status: "", note: "" }),
    ),
    update = (i: number, k: string, v: string) =>
      setReviews((x) => x.map((r, j) => (j === i ? { ...r, [k]: v } : r))),
    approveAll = () =>
      setReviews(
        items.map((_: any, i: number) => ({
          ...reviews[i],
          status: "approved",
          note: "",
        })),
      ),
    ready =
      reviews.length === items.length &&
      reviews.every(
        (r) => r.status && (r.status !== "refine" || r.note?.trim()),
      );
  return (
    <section className="panel production-review-page">
      <div className="form-card-head">
        <p className="eyebrow">READ-ONLY MANAGEMENT REVIEW</p>
        <h3>{p.approvalTitle}</h3>
        <p>
          Submitted content is locked during review. Decide on every{" "}
          {recurring ? "post / reel" : "shot"} below; management cannot alter
          the handler's work.
        </p>
      </div>
      <div className="production-review-items">
        {items.map((x: any, i: number) => (
          <article
            className={`production-review-item ${reviews[i]?.status || "pending"}`}
            key={i}
          >
            <header>
              <span>
                {recurring ? "BLOCK" : "SHOT"} {String(i + 1).padStart(2, "0")}
              </span>
              <b>
                {recurring
                  ? ideas[i]?.title || `Content idea ${i + 1}`
                  : `${x.duration || "Duration TBC"} · ${x.framing || "Framing TBC"}`}
              </b>
            </header>
            <div className="readonly-production-content">
              {recurring ? (
                <>
                  <small>APPROVED IDEA</small>
                  <p>{ideas[i]?.story || "—"}</p>
                  <small>IMAGE GENERATION PROMPT</small>
                  <p>{x.prompt || "—"}</p>
                </>
              ) : (
                <>
                  <div className="shot-tech">
                    <span>{x.camera}</span>
                    <span>{x.movement}</span>
                    <span>{x.lighting}</span>
                  </div>
                  <small>TIMELINE & VISUAL</small>
                  <p>{x.description || "—"}</p>
                  <small>CHARACTER MOTION</small>
                  <p>{x.characterMotion || "—"}</p>
                  {x.dialogue && (
                    <>
                      <small>DIALOGUE / VO</small>
                      <p>{x.dialogue}</p>
                    </>
                  )}
                </>
              )}
            </div>
            <div
              className={`item-review-panel ${reviews[i]?.status === "approved" ? "approved" : ""}`}
            >
              <b>{reviewer ? "Your decision" : "Management review"}</b>
              {reviewer ? (
                <>
                  <div className="review-choice">
                    <button
                      className={
                        reviews[i]?.status === "approved"
                          ? "selected approve"
                          : ""
                      }
                      onClick={() => update(i, "status", "approved")}
                    >
                      ✓ Approve this {recurring ? "block" : "shot"}
                    </button>
                    <button
                      className={
                        reviews[i]?.status === "refine" ? "selected refine" : ""
                      }
                      onClick={() => update(i, "status", "refine")}
                    >
                      ✕ Return for revision
                    </button>
                  </div>
                  {reviews[i]?.status === "refine" && (
                    <textarea
                      value={reviews[i]?.note || ""}
                      onChange={(e) => update(i, "note", e.target.value)}
                      placeholder={`Write the exact change needed for ${recurring ? "this content block" : "this shot"}…`}
                    />
                  )}
                </>
              ) : (
                <p>
                  {reviews[i]?.status === "approved"
                    ? "Approved"
                    : reviews[i]?.note || "Waiting for management decision."}
                </p>
              )}
            </div>
          </article>
        ))}
      </div>
      {reviewer && (
        <footer className="production-review-footer">
          <button className="approve-all" onClick={approveAll}>
            ✓ Approve All
          </button>
          <span>
            {reviews.filter((r) => r.status === "approved").length} approved ·{" "}
            {reviews.filter((r) => r.status === "refine").length} need
            refinement
          </span>
          <button
            className="send-review"
            disabled={!ready}
            onClick={() => submit(reviews)}
          >
            Complete Review →
          </button>
        </footer>
      )}
    </section>
  );
}
function UnifiedProductionReview({
  p,
  data,
  recurring,
  reviewer,
  submit,
}: {
  p: P;
  data: any;
  recurring: boolean;
  reviewer: boolean;
  submit: (x: any[]) => void;
}) {
  const items = recurring ? data.imageGeneration || [] : data.storyboard || [],
    ideas = data.ideas || [],
    [reviews, setReviews] = useState<any[]>(
      items.map(
        (_: any, i: number) =>
          data.productionReviews?.[i] || { status: "", note: "" },
      ),
    ),
    update = (i: number, patch: any) =>
      setReviews((x) => x.map((r, j) => (j === i ? { ...r, ...patch } : r))),
    ready =
      items.length > 0 &&
      reviews.every(
        (r) => r.status && (r.status !== "refine" || r.note.trim()),
      );
  return (
    <section className="panel production-review-page">
      <div className="form-card-head">
        <p className="eyebrow">READ-ONLY ITEM REVIEW</p>
        <h3>{p.approvalTitle}</h3>
        <p>
          {recurring
            ? "Review every social prompt together with its latest uploaded image."
            : "Review every storyboard shot; Key Shots feed the next Visual Development stage."}
        </p>
      </div>
      <div className="production-review-items">
        {items.map((x: any, i: number) => (
          <article
            className={`production-review-item ${reviews[i]?.status || "pending"}`}
            key={i}
          >
            <header>
              <span>{recurring ? `BLOCK ${i + 1}` : `SHOT ${i + 1}`}</span>
              <b>
                {recurring
                  ? ideas[i]?.title || "Content idea"
                  : `${x.duration || "Duration TBC"} · ${x.framing || "Framing TBC"}`}
              </b>
              {!recurring && x.keyShot && (
                <strong className="key-shot-badge">★ KEY SHOT</strong>
              )}
            </header>
            <div className="readonly-production-content">
              {recurring ? (
                <>
                  <small>APPROVED STORY</small>
                  <p>{ideas[i]?.story || "—"}</p>
                  <small>PROFESSIONAL IMAGE PROMPT</small>
                  <p>{x.prompt || "—"}</p>
                  <VisualAssetUploader
                    projectId={p.id}
                    phase="social-image"
                    itemKey={`block-${i + 1}`}
                    readonly
                  />
                </>
              ) : (
                <>
                  <div className="shot-tech">
                    <span>{x.camera}</span>
                    <span>{x.movement}</span>
                    <span>{x.lighting}</span>
                  </div>
                  <small>TIMELINE & VISUAL</small>
                  <p>{x.description || "—"}</p>
                  <small>CHARACTER MOTION</small>
                  <p>{x.characterMotion || "—"}</p>
                  {x.dialogue && (
                    <>
                      <small>DIALOGUE / VO</small>
                      <p>{x.dialogue}</p>
                    </>
                  )}
                </>
              )}
            </div>
            <div
              className={`item-review-panel ${reviews[i]?.status === "approved" ? "approved" : ""}`}
            >
              <b>{reviewer ? "Your decision" : "Management review"}</b>
              {reviewer && (
                <>
                  <div className="review-choice">
                    <button
                      onClick={() =>
                        update(i, { status: "approved", note: "" })
                      }
                    >
                      ✓ Approve {recurring ? "prompt + image" : "shot"}
                    </button>
                    <button onClick={() => update(i, { status: "refine" })}>
                      ✕ Return for revision
                    </button>
                  </div>
                  {reviews[i]?.status === "refine" && (
                    <textarea
                      value={reviews[i]?.note || ""}
                      onChange={(e) => update(i, { note: e.target.value })}
                      placeholder="Write the exact change needed for this item…"
                    />
                  )}
                </>
              )}
            </div>
          </article>
        ))}
      </div>
      {reviewer && (
        <footer className="production-review-footer">
          <button
            className="approve-all"
            onClick={() =>
              setReviews(items.map(() => ({ status: "approved", note: "" })))
            }
          >
            ✓ Approve All
          </button>
          <span>
            {reviews.filter((r) => r.status === "approved").length} approved ·{" "}
            {reviews.filter((r) => r.status === "refine").length} refine
          </span>
          <button
            className="send-review"
            disabled={!ready}
            onClick={() => submit(reviews)}
          >
            Complete Review →
          </button>
        </footer>
      )}
    </section>
  );
}
const shotDefaults = {
  duration: "",
  framing: "Medium Shot",
  camera: "35mm Cinema Camera",
  movement: "Static / Locked-off",
  lighting: "Soft Natural Light",
  description: "",
  characterMotion: "",
  dialogue: "",
  keyShot: false,
};
function storyboardDraft(s: any) {
  const theme = s.theme || "Approved commercial story",
    flow =
      s.storyFlow ||
      "The visual world develops from the opening situation toward the final brand payoff.",
    ending = s.ending || "Resolve on a clear brand close.";
  return [
    {
      ...shotDefaults,
      duration: "0–3s",
      framing: "Extreme Close-up",
      camera: "50mm Natural Lens",
      movement: "Slow Push-in",
      lighting: "Low-key Cinematic",
      description: `OPENING HOOK — Introduce “${theme}” with one immediately intriguing visual detail. Withhold the full context so the audience wants to understand what happens next.`,
      characterMotion:
        "A precise micro-expression or purposeful hand action starts the story; eyeline directs attention toward the next reveal.",
      dialogue: "Optional opening line / sound hook",
    },
    {
      ...shotDefaults,
      duration: "3–7s",
      framing: "Wide Shot",
      camera: "24mm Wide Lens",
      movement: "Dolly / Tracking",
      lighting: "Soft Natural Light",
      description: `SETUP — Reveal the character, environment and central situation. Establish the visual rules and the problem described in the premise: ${s.storyPremise || theme}`,
      characterMotion:
        "Character enters or settles into the environment naturally, then reacts to the first story trigger.",
      dialogue: "Optional setup dialogue",
    },
    {
      ...shotDefaults,
      duration: "7–12s",
      framing: "Medium Shot",
      camera: "35mm Cinema Camera",
      movement: "Orbit / Arc",
      lighting: "High-key Commercial",
      description: `DEVELOPMENT — Begin the main transformation or action. ${flow}`,
      characterMotion:
        "Movement becomes more confident and active; hands, posture and gaze clearly motivate the visual change.",
      dialogue: "Optional narration describing the idea",
    },
    {
      ...shotDefaults,
      duration: "12–18s",
      framing: "Insert / Detail Shot",
      camera: "100mm Macro Lens",
      movement: "Rack Focus Only",
      lighting: "Studio Three-point",
      description:
        "PROOF / DETAIL — Show a tactile close detail that makes the production transformation believable: material, interface, product, wardrobe or branded environmental cue.",
      characterMotion:
        "Controlled interaction with the featured detail; motion is slow enough to read clearly.",
      dialogue: "",
    },
    {
      ...shotDefaults,
      duration: "18–24s",
      framing: "Medium Wide Shot",
      camera: "Anamorphic Cinema Lens",
      movement: "Crane Up / Down",
      lighting: "Volumetric / Atmospheric",
      description: `CLIMAX — Complete the largest visual payoff and connect all earlier story beats. Reinforce the meaning: ${s.meaning || "creative control turns an ambitious idea into a finished world."}`,
      characterMotion:
        "Character holds confident control while the final environment resolves around them.",
      dialogue: "Optional key message / campaign line",
    },
    {
      ...shotDefaults,
      duration: "24–30s",
      framing: "Medium Close-up",
      camera: "85mm Portrait Lens",
      movement: "Static / Locked-off",
      lighting: "High-key Commercial",
      description: `ENDING & BRAND CLOSE — ${ending}`,
      characterMotion:
        "Character lands on a calm final expression and holds long enough for the message and brand to register.",
      dialogue: "Final CTA / brand line",
    },
  ];
}
function StoryboardBuilder({
  script,
  initial,
  save,
}: {
  script: any;
  initial: any[];
  save: (x: any[]) => void;
}) {
  const [shots, setShots] = useState<any[]>(
      initial.length ? initial : storyboardDraft(script),
    ),
    update = (i: number, k: string, v: string) =>
      setShots((s) => s.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  return (
    <section className="panel production-builder">
      <div className="form-card-head">
        <p className="eyebrow">05 · AI FIRST-DRAFT STORYBOARD</p>
        <h3>Storyboard & Detailed Timeline</h3>
        <p>
          The opening hook, development, climax and ending below were drafted
          from the approved script. Every technical choice and description
          remains editable.
        </p>
        <div className="approved-script-recap">
          <b>{script.theme || "Approved Script"}</b>
          <p>{script.storyPremise}</p>
          <p>{script.storyFlow}</p>
          <small>
            Meaning: {script.meaning || "—"} · Ending: {script.ending || "—"}
          </small>
        </div>
        <button
          className="amend-btn"
          onClick={() => setShots(storyboardDraft(script))}
        >
          ✦ Generate a new first draft from Script
        </button>
      </div>
      <div className="shot-stack">
        {shots.map((x, i) => (
          <article className="shot-card" key={i}>
            <header>
              <span>SHOT {String(i + 1).padStart(2, "0")}</span>
              <button
                disabled={shots.length === 1}
                onClick={() => setShots((s) => s.filter((_, j) => j !== i))}
              >
                Delete shot
              </button>
            </header>
            <div className="shot-options">
              <label>
                Duration
                <input
                  value={x.duration || ""}
                  onChange={(e) => update(i, "duration", e.target.value)}
                  placeholder="e.g. 2.5s"
                />
              </label>
              <label>
                Framing
                <select
                  value={x.framing}
                  onChange={(e) => update(i, "framing", e.target.value)}
                >
                  {[
                    "Extreme Wide Shot",
                    "Wide Shot",
                    "Full Shot",
                    "Medium Wide Shot",
                    "Medium Shot",
                    "Medium Close-up",
                    "Close-up",
                    "Extreme Close-up",
                    "Over-the-Shoulder",
                    "POV Shot",
                    "Insert / Detail Shot",
                  ].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label>
                Camera setting
                <select
                  value={x.camera}
                  onChange={(e) => update(i, "camera", e.target.value)}
                >
                  {[
                    "24mm Wide Lens",
                    "35mm Cinema Camera",
                    "50mm Natural Lens",
                    "85mm Portrait Lens",
                    "100mm Macro Lens",
                    "Telephoto 135mm+",
                    "Anamorphic Cinema Lens",
                    "Handheld Documentary Camera",
                    "Drone / Aerial Camera",
                  ].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label>
                Camera movement
                <select
                  value={x.movement}
                  onChange={(e) => update(i, "movement", e.target.value)}
                >
                  {[
                    "Static / Locked-off",
                    "Slow Push-in",
                    "Slow Pull-out",
                    "Pan Left",
                    "Pan Right",
                    "Tilt Up",
                    "Tilt Down",
                    "Dolly / Tracking",
                    "Orbit / Arc",
                    "Crane Up / Down",
                    "Handheld Organic",
                    "Whip Pan",
                    "Rack Focus Only",
                  ].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label>
                Lighting
                <select
                  value={x.lighting}
                  onChange={(e) => update(i, "lighting", e.target.value)}
                >
                  {[
                    "Soft Natural Light",
                    "Golden Hour",
                    "High-key Commercial",
                    "Low-key Cinematic",
                    "Hard Sunlight",
                    "Overcast Diffused",
                    "Neon Night",
                    "Practical Interior",
                    "Studio Three-point",
                    "Backlit Silhouette",
                    "Volumetric / Atmospheric",
                  ].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="wide-field">
              Timeline & visual description
              <textarea
                value={x.description || ""}
                onChange={(e) => update(i, "description", e.target.value)}
                placeholder="Describe location, subject position, action, visual transition and the exact story beat…"
              />
            </label>
            <div className="shot-text-grid">
              <label>
                Character motion
                <textarea
                  value={x.characterMotion || ""}
                  onChange={(e) => update(i, "characterMotion", e.target.value)}
                  placeholder="Body movement, facial expression, eyeline, interaction…"
                />
              </label>
              <label>
                Dialogue / Voice-over · Optional
                <textarea
                  value={x.dialogue || ""}
                  onChange={(e) => update(i, "dialogue", e.target.value)}
                  placeholder="Dialogue, VO, audio cue or leave empty…"
                />
              </label>
            </div>
          </article>
        ))}
      </div>
      <footer className="builder-footer">
        <button
          className="add-shot"
          onClick={() => setShots((s) => [...s, { ...shotDefaults }])}
        >
          ＋ Add another shot
        </button>
        <button className="save-production" onClick={() => save(shots)}>
          Save Storyboard
        </button>
      </footer>
    </section>
  );
}
function KeyShotStoryboardBuilder({
  script,
  initial,
  save,
}: {
  script: any;
  initial: any[];
  save: (x: any[]) => void;
}) {
  const [shots, setShots] = useState<any[]>(
      initial.length ? initial : storyboardDraft(script),
    ),
    update = (i: number, k: string, v: any) =>
      setShots((s) => s.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  return (
    <section className="panel production-builder">
      <div className="form-card-head">
        <p className="eyebrow">05 · STORYBOARD & KEY SHOTS</p>
        <h3>Detailed Timeline</h3>
        <p>
          Select Key Shots that must establish character, environment, props or
          visual continuity. They will automatically become storyboard-frame
          tasks in the next phase.
        </p>
      </div>
      <div className="shot-stack">
        {shots.map((x: any, i: number) => (
          <article
            className={`shot-card ${x.keyShot ? "key-shot" : ""}`}
            key={i}
          >
            <header>
              <span>SHOT {String(i + 1).padStart(2, "0")}</span>
              <label className="key-shot-toggle">
                <input
                  type="checkbox"
                  checked={Boolean(x.keyShot)}
                  onChange={(e) => update(i, "keyShot", e.target.checked)}
                />{" "}
                ★ Key Shot
              </label>
              <button
                disabled={shots.length === 1}
                onClick={() =>
                  setShots((s) => s.filter((_: any, j: number) => j !== i))
                }
              >
                Delete shot
              </button>
            </header>
            <div className="shot-options">
              <label>
                Duration
                <input
                  value={x.duration || ""}
                  onChange={(e) => update(i, "duration", e.target.value)}
                />
              </label>
              <label>
                Framing
                <select
                  value={x.framing}
                  onChange={(e) => update(i, "framing", e.target.value)}
                >
                  {[
                    "Extreme Wide Shot",
                    "Wide Shot",
                    "Full Shot",
                    "Medium Shot",
                    "Medium Close-up",
                    "Close-up",
                    "Extreme Close-up",
                    "POV Shot",
                    "Insert / Detail Shot",
                  ].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label>
                Camera
                <select
                  value={x.camera}
                  onChange={(e) => update(i, "camera", e.target.value)}
                >
                  {[
                    "24mm Wide Lens",
                    "35mm Cinema Camera",
                    "50mm Natural Lens",
                    "85mm Portrait Lens",
                    "100mm Macro Lens",
                    "Anamorphic Cinema Lens",
                  ].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label>
                Movement
                <select
                  value={x.movement}
                  onChange={(e) => update(i, "movement", e.target.value)}
                >
                  {[
                    "Static / Locked-off",
                    "Slow Push-in",
                    "Slow Pull-out",
                    "Pan Left",
                    "Pan Right",
                    "Dolly / Tracking",
                    "Orbit / Arc",
                    "Handheld Organic",
                    "Rack Focus Only",
                  ].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label>
                Lighting
                <select
                  value={x.lighting}
                  onChange={(e) => update(i, "lighting", e.target.value)}
                >
                  {[
                    "Soft Natural Light",
                    "Golden Hour",
                    "High-key Commercial",
                    "Low-key Cinematic",
                    "Neon Night",
                    "Studio Three-point",
                    "Volumetric / Atmospheric",
                  ].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="wide-field">
              Timeline & visual description
              <textarea
                value={x.description || ""}
                onChange={(e) => update(i, "description", e.target.value)}
              />
            </label>
            <div className="shot-text-grid">
              <label>
                Character motion
                <textarea
                  value={x.characterMotion || ""}
                  onChange={(e) => update(i, "characterMotion", e.target.value)}
                />
              </label>
              <label>
                Dialogue / Voice-over · Optional
                <textarea
                  value={x.dialogue || ""}
                  onChange={(e) => update(i, "dialogue", e.target.value)}
                />
              </label>
            </div>
          </article>
        ))}
      </div>
      <footer className="builder-footer">
        <button
          className="add-shot"
          onClick={() => setShots((s) => [...s, { ...shotDefaults }])}
        >
          ＋ Add shot
        </button>
        <span>
          {shots.filter((x) => x.keyShot).length} Key Shot
          {shots.filter((x) => x.keyShot).length === 1 ? "" : "s"}
        </span>
        <button className="save-production" onClick={() => save(shots)}>
          Save Storyboard
        </button>
      </footer>
    </section>
  );
}
function detailedPrompt(x: any, i: number, variant = 0) {
  const source = `${x.title || ""} ${x.story || ""}`.toLowerCase(),
    morning = /morning|window|calm|new.week/.test(source),
    reel = String(x.format || "")
      .toLowerCase()
      .includes("reel"),
    presence = String(x.subjectPresence || "Human present"),
    noHuman = /no human|environment only/i.test(presence),
    noFace = /no face/i.test(presence),
    styles = [
      "premium editorial lifestyle photography with candid human warmth",
      "cinematic social advertising photography with natural documentary realism",
      "clean luxury campaign photography with restrained art direction",
      "intimate magazine photography that feels observed rather than staged",
    ],
    cameras = [
      "eye level on a full-frame camera with a 50mm lens at f/2.8, medium framing and gentle optical separation",
      "a subtle low angle on a 35mm lens at f/4, medium-wide framing with strong foreground-to-background depth",
      "eye level on an 85mm lens at f/2.8, three-quarter framing and natural optical compression",
      "a three-quarter angle on a 35mm lens at f/2.8, environmental framing with the subject placed on a golden-ratio intersection",
    ],
    lights = [
      "soft directional window light from camera-left, a delicate warm rim from the background, realistic falloff and readable shadow detail",
      "warm early golden-hour light entering from the side, soft bounce, natural specular highlights and physically consistent shadows",
      "a large diffused key with subtle negative fill, gentle highlight roll-off and practical lights visible in the background",
      "natural available light shaped by the room, soft contrast, realistic mixed color temperature and no artificial glow",
    ],
    moods = [
      "calm, fresh, quietly confident and premium, with warm cream, soft beige and restrained amber tones",
      "cinematic, purposeful and aspirational, with rich neutral colors and protected natural skin tones",
      "clean, elegant and contemporary, with a refined low-saturation palette and subtle organic film grain",
      "intimate, believable and emotionally grounded, with soft contrast and authentic lived-in color",
    ],
    outfits = [
      "an ivory heavyweight cotton-poplin shirt with an oversized straight silhouette, structured pointed collar, concealed mother-of-pearl button placket, dropped shoulders, wide single-button cuffs and tonal topstitching; high-waisted warm-beige wool-blend trousers with double front pleats, pressed center creases and a clean wide-leg cut; small brushed-gold hoops, a slim brown leather watch, tan leather loafers and a structured caramel grained-leather top-handle handbag with minimal polished-gold hardware and no invented logo",
      "a cream silk-twill blouse with a softly draped stand collar, covered buttons, precise narrow cuffs and subtle tonal piping; high-rise cocoa tailored trousers with a tapered ankle, pressed crease and horn-look waist fastening; fine gold studs, a slim chain bracelet, dark-brown pointed flats and a compact oxblood smooth-leather shoulder bag with understated metal hardware and no invented logo",
      "a soft oatmeal fine-gauge merino knit with a clean crew neckline, slightly extended sleeves and ribbed edges; an ivory A-line midi skirt in structured cotton sateen with discreet side pockets and topstitched panels; small pearl-gold earrings, a narrow tan belt, minimal cream slingbacks and a woven cognac leather handbag with brushed-brass closure and no invented logo",
      "a pale-blue premium cotton shirt with fine white pinstripes, relaxed drop shoulders, crisp French cuffs and a curved hem; high-waisted stone-grey trousers with a sculpted waistband, single pleats and fluid straight legs; polished silver earrings, a steel watch, white leather sneakers and a structured navy pebbled-leather tote with restrained silver hardware and no invented logo",
    ],
    v = ((variant % styles.length) + styles.length) % styles.length,
    character =
      x.character ||
      "Hana, matching the supplied identity references exactly: soft oval face, large almond-shaped dark eyes, natural defined brows, refined nose, softly full lips, long dark hair and a warm healthy complexion",
    moment =
      x.scenery ||
      x.moment ||
      (morning
        ? "a quiet sunlit apartment beside a tall window at the beginning of a new week"
        : "a believable real-life location designed around the approved content idea"),
    story =
      x.story ||
      "the approved social idea expressed as one clear moment with a readable visual intention",
    outfit = x.outfit || outfits[v],
    pose =
      x.pose ||
      (morning
        ? "standing three-quarters to camera beside the window, one hand lightly holding a warm ceramic drink near waist level while the other relaxes naturally, shoulders lowered and weight shifted onto one leg"
        : "performing one specific natural action from the approved story, with asymmetrical posture, believable balance and purposeful placement"),
    expression =
      x.expression ||
      (morning
        ? "a small genuine half-smile, calm direct eyeline and the rested expression of beginning the week with quiet confidence"
        : "a restrained genuine expression clearly communicating the approved intention"),
    environment =
      x.environmentDetails ||
      (morning
        ? "sheer curtains moving slightly, a timber side table, ceramic cup, folded magazine, one indoor plant, faint city detail beyond the glass, subtle dust in the light and naturally imperfect lived-in surfaces"
        : "layered foreground, midground and background; story-relevant objects; tactile materials; slight wear; natural reflections; realistic scale; and small imperfections that make the location feel occupied"),
    aspect = reel
      ? "9:16 vertical with safe space for platform UI and motion continuation"
      : "4:5 vertical with clean social-feed cropping",
    subject = noHuman
      ? `the approved product, object or environment as the sole hero subject in ${moment}; show no person, face, mannequin or human figure`
      : noFace
        ? `a face-free human detail in ${moment}; frame only the approved hands, body detail, outfit or interaction and keep the face completely outside the composition`
        : `${character} in ${moment}`,
    humanDirection = noHuman
      ? "Build the visual story through product placement, materials, environment, light and evidence of recent human activity. Do not include clothing worn by a person."
      : noFace
        ? `Wardrobe and accessory design: ${outfit}. Show a natural purposeful interaction without revealing the face.`
        : `Wardrobe and accessory design: ${outfit}. She is ${pose}. Her expression is ${expression}. Preserve natural body weight, anatomically correct hands and a clear story-motivated eyeline.`;
  return `SECTION 1 — CONTENT IDEA\\nCreate ONE independent premium ultra-photorealistic photograph of ${subject}.\\nThe scene shows ${story}. Build one decisive visual moment rather than a generic pose. Never create a collage, contact sheet, split frame or multiple-photo layout—even when the approved format is Carousel.\\n${humanDirection}\\n\\nSECTION 2 — STYLE\\nPhotograph this as ${styles[v]}, using ${cameras[v]}. Compose for ${aspect}; keep all important subject, product, wardrobe and prop details comfortably inside the safe crop.\\nLighting is ${lights[v]}.\\nThe environment includes ${environment}. Keep spatial depth readable and every prop logically placed.\\nThe overall mood is ${moods[v]}. Use subtle organic grain, realistic lens behavior, natural depth of field and no artificial blur.\\n\\nSECTION 3 — FIXED REALISM\\nUse supplied references as the primary identity source and preserve the same recognizable person whenever a person is present. Maintain realistic skin pores, natural facial texture, individual hair strands, believable anatomy, realistic hands, fabric weave, wrinkles, seams, environmental imperfections, natural shadows and real optical depth. Avoid plastic skin, waxy texture, distorted anatomy, extra fingers, duplicated objects, fake logos, artificial blur, HDR halos and synthetic AI gloss. Output a high-resolution platform-ready image with no embedded text or watermark.`;
}
function ImageGenerationBuilder({
  p,
  ideas,
  initial,
  save,
}: {
  p: P;
  ideas: any[];
  initial: any[];
  save: (x: any[]) => void;
}) {
  const [blocks, setBlocks] = useState<any[]>(
    ideas.map((x: any, i: number) => {
      const saved = initial[i];
      return saved &&
        String(saved.prompt || "").includes("Build one decisive visual moment")
        ? saved
        : {
            ...saved,
            prompt: detailedPrompt(x, i, Number(saved?.variant || 0)),
            variant: Number(saved?.variant || 0),
            status: saved?.status || "Draft",
          };
    }),
  );
  const update = (i: number, patch: any) =>
    setBlocks((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const draft = (i: number) => {
    const variant = Number(blocks[i]?.variant || 0) + 1;
    update(i, { variant, prompt: detailedPrompt(ideas[i], i, variant) });
  };
  return (
    <section className="panel production-builder">
      <div className="form-card-head">
        <p className="eyebrow">05 · PROMPT + VISUAL PROOF</p>
        <h3>{ideas.length} Social Visual Blocks</h3>
        <p>
          Every Reels / social prompt now follows the same clean three-section
          guide.
        </p>
      </div>
      <div className="prompt-guide">
        <div>
          <b>01 · Content Idea</b>
          <span>Character · scenery · story · outfit · pose · expression</span>
        </div>
        <div>
          <b>02 · Style</b>
          <span>Style · camera · lens · lighting · environment · mood</span>
        </div>
        <div>
          <b>03 · Fixed Realism</b>
          <span>Identity, human realism and quality safeguards</span>
        </div>
      </div>
      <div className="generation-stack">
        {ideas.map((x: any, i: number) => (
          <article className="generation-card" key={i}>
            <header>
              <div>
                <span>BLOCK {String(i + 1).padStart(2, "0")}</span>
                <b>{x.title || "Untitled idea"}</b>
                <small>
                  {x.publishDate || "Date TBC"} · {x.format || "Photo Post"}
                </small>
              </div>
              <button onClick={() => draft(i)}>
                ✦ Generate another version
              </button>
            </header>
            <div className="source-story">
              <small>APPROVED SCRIPT DETAIL</small>
              <h4>{x.title}</h4>
              <p>{x.story || "—"}</p>
              <p>
                <b>Caption:</b> {x.caption || "—"}
              </p>
              <p>
                <b>Hashtags:</b> {x.hashtags || "—"}
              </p>
            </div>
            <label>
              Editable 3-section image prompt
              <textarea
                value={blocks[i]?.prompt || ""}
                onChange={(e) => update(i, { prompt: e.target.value })}
              />
            </label>
            <small className="prompt-note">
              Content Idea → Style → Fixed Realism · Version{" "}
              {Number(blocks[i]?.variant || 0) + 1}
            </small>
            <VisualAssetUploader
              projectId={p.id}
              phase="social-image"
              itemKey={`block-${i + 1}`}
            />
          </article>
        ))}
      </div>
      <footer className="builder-footer">
        <span>{blocks.length} prompt + image approval packages</span>
        <button className="save-production" onClick={() => save(blocks)}>
          Save Prompt & Visual Draft
        </button>
      </footer>
    </section>
  );
}

function VisualAssetUploader({
  projectId,
  phase,
  itemKey,
  readonly = false,
}: {
  projectId: string;
  phase: string;
  itemKey: string;
  readonly?: boolean;
}) {
  const [assets, setAssets] = useState<any[]>([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [dragging, setDragging] = useState(false),
    [preview, setPreview] = useState<any | null>(null);
  const load = () =>
    fetch(
      `/api/uploads?projectId=${encodeURIComponent(projectId)}&phase=${encodeURIComponent(phase)}&itemKey=${encodeURIComponent(itemKey)}`,
    )
      .then((r) => r.json())
      .then((d) => setAssets(d.assets || []));
  useEffect(() => {
    load();
  }, [projectId, phase, itemKey]);
  const current = assets.filter((x) => x.isCurrent),
    history = assets.filter((x) => !x.isCurrent);
  async function uploadFiles(files: File[]) {
    const valid = files.filter(
      (x) =>
        ["image/png", "image/jpeg", "image/webp"].includes(x.type) && x.size,
    );
    if (!valid.length) {
      setMessage("Please choose PNG, JPG or WEBP images.");
      return;
    }
    setBusy(true);
    const send = async (file: File, replace = false) => {
      const form = new FormData();
      form.set("file", file);
      form.set("projectId", projectId);
      form.set("phase", phase);
      form.set("itemKey", itemKey);
      if (replace) form.set("replaceSet", "1");
      const r = await fetch("/api/uploads", { method: "POST", body: form }),
        d = await r.json();
      if (!r.ok) throw new Error(d.error || "Upload failed");
    };
    try {
      await send(valid[0], true);
      await Promise.all(valid.slice(1).map((file) => send(file)));
      setMessage(
        `${valid.length} image${valid.length === 1 ? "" : "s"} uploaded as the latest set`,
      );
      await load();
    } catch (e: any) {
      setMessage(e.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className={`visual-upload ${dragging ? "dragging" : ""}`}>
        <div className="visual-upload-head">
          <div>
            <b>Generated image set</b>
            <small>
              {current.length
                ? `${current.length} current image${current.length === 1 ? "" : "s"} · ${history.length} older revision${history.length === 1 ? "" : "s"}`
                : "No image uploaded yet"}
            </small>
          </div>
          <span>{current.length ? "CURRENT SET" : "REQUIRED"}</span>
        </div>
        {current.length ? (
          <div className="visual-gallery">
            {current.map((a) => (
              <button type="button" key={a.id} onClick={() => setPreview(a)}>
                <img
                  src={`/api/uploads?file=${encodeURIComponent(a.storageKey)}`}
                  alt={`Current generated visual ${a.version} for ${itemKey}`}
                />
                <span>Click to view full size</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="visual-placeholder">
            Drop one or multiple generated photos here
          </div>
        )}
        {!readonly && (
          <label
            className="drop-zone"
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              uploadFiles(Array.from(e.dataTransfer.files));
            }}
          >
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
              multiple
              onChange={(e) => uploadFiles(Array.from(e.target.files || []))}
            />
            <b>
              {busy
                ? "Uploading images in parallel…"
                : "Drop photos here or click to choose"}
            </b>
            <small>
              PNG, JPG/JPEG or WEBP · multiple images allowed · 15 MB each
            </small>
          </label>
        )}
        {message && <small className="upload-message">{message}</small>}
        <div className="storage-truth">
          <b>Storage:</b> secured in this site's cloud storage · Google Drive
          sync is not connected yet
        </div>
        <details>
          <summary>Revision history · previous image sets kept</summary>
          {history.map((a) => (
            <div key={a.id}>
              <b>v{a.version}</b>
              <span>
                {a.fileName} · {new Date(a.createdAt).toLocaleString()}
              </span>
              <small>{a.driveSyncStatus}</small>
            </div>
          ))}
        </details>
      </section>
      {preview && (
        <div className="image-lightbox" onClick={() => setPreview(null)}>
          <button aria-label="Close full-size image">×</button>
          <img
            onClick={(e) => e.stopPropagation()}
            src={`/api/uploads?file=${encodeURIComponent(preview.storageKey)}`}
            alt={preview.fileName}
          />
          <small>{preview.fileName} · Current upload</small>
        </div>
      )}
    </>
  );
}

function StoryboardSourcePanel({ data }: { data: any }) {
  const shots = data.storyboard || [];
  return (
    <section className="panel storyboard-source">
      <div className="form-card-head">
        <p className="eyebrow">APPROVED STORY + STORYBOARD SOURCE</p>
        <h3>{data.theme || "Approved Film Story"}</h3>
        <p>
          The AI prompts below are grounded in this exact approved script and
          shot plan.
        </p>
      </div>
      <div className="approved-script-recap">
        <b>Premise</b>
        <p>{data.storyPremise || "—"}</p>
        <b>Complete story flow</b>
        <p>{data.storyFlow || "—"}</p>
        <small>
          Ending: {data.ending || "—"} · Meaning: {data.meaning || "—"}
        </small>
      </div>
      <div className="storyboard-source-grid">
        {shots.map((s: any, i: number) => (
          <article className={s.keyShot ? "key-shot" : ""} key={i}>
            <header>
              <b>SHOT {String(i + 1).padStart(2, "0")}</b>
              {s.keyShot && <span>★ KEY SHOT</span>}
              <small>{s.duration || "Timing TBC"}</small>
            </header>
            <div className="shot-tech">
              <span>{s.framing}</span>
              <span>{s.camera}</span>
              <span>{s.movement}</span>
              <span>{s.lighting}</span>
            </div>
            <p>{s.description || "—"}</p>
            <small>Character: {s.characterMotion || "—"}</small>
            {s.dialogue && <small>Dialogue / VO: {s.dialogue}</small>}
          </article>
        ))}
      </div>
      {!shots.length && (
        <div className="visual-placeholder">
          No approved storyboard shots found. Return to Storyboard and save the
          shot plan before creating visual assets.
        </div>
      )}
    </section>
  );
}
function visualPrompt(type: string, data: any, shot?: any) {
  const storyboard = (data.storyboard || [])
    .map(
      (s: any, i: number) =>
        `SHOT ${i + 1} [${s.duration || "timing TBC"}] ${s.keyShot ? "KEY SHOT · " : ""}${s.framing || ""}, ${s.camera || ""}, ${s.movement || ""}, ${s.lighting || ""}: ${s.description || ""} CHARACTER ACTION: ${s.characterMotion || ""}${s.dialogue ? ` DIALOGUE/VO: ${s.dialogue}` : ""}`,
    )
    .join("\n");
  return `Create a premium ultra-photorealistic ${type} production reference for “${data.theme || "the approved film / commercial"}”.

APPROVED SCRIPT — do not invent a different story:
Premise: ${data.storyPremise || "Use the approved project premise."}
Complete flow: ${data.storyFlow || "Follow the approved story flow."}
Ending / brand close: ${data.ending || "Preserve the approved ending."}
Meaning: ${data.meaning || "Preserve the approved storytelling meaning."}
Design reason: ${data.designReason || "Support the approved creative rationale."}

APPROVED STORYBOARD — extract and implement its exact visual logic:
${storyboard || "No detailed storyboard supplied; derive the image only from the approved script."}

CURRENT ASSET PURPOSE: ${shot ? `${shot.keyShot ? "KEY SHOT. " : ""}${shot.description || type}. Preserve its exact story beat, timing, action and continuity role.` : `Build the ${type} as a master continuity reference covering every relevant approved storyboard shot.`}

IDENTITY LOCK: use supplied character references as the primary identity source. Preserve recognizable facial proportions, face shape, eye shape and spacing, nose, lips, jawline, complexion, age, body proportions and distinctive features. Never substitute a similar model or beautify until identity changes. Define front, three-quarter, profile and expression continuity where relevant.

WARDROBE / MATERIAL LOCK: physically wearable construction, correct seams, stitching, closures, fabric weave, natural compression, wrinkles, folds, wear and gravity. Preserve exact wardrobe colors, accessories, hair, makeup and prop placement across shots.

POSE & PERFORMANCE: ${shot?.characterMotion || "derive believable body direction, shoulder and hip rotation, hand actions, head angle, eyeline and emotionally readable expression from the approved story."} Hands have five fingers, natural knuckles, nail structure, pressure and correct object interaction. Body weight, joints, posture and balance must remain anatomically plausible.

CAMERA & COMPOSITION: ${shot?.camera || "professional full-frame cinema camera"}; ${shot?.framing || "production-appropriate framing"}; camera movement reference ${shot?.movement || "static continuity frame"}. Use intentional foreground, midground and background separation, story-motivated lens height, controlled distortion, safe crop and real optical depth. Subject placement must follow the storyboard rather than default centred posing.

LIGHTING: ${shot?.lighting || "physically motivated cinematic lighting consistent with the approved visual direction"}. State visible key source, direction, fill, practicals, rim separation and time of day. Shadows, reflections, catchlights, facial highlight roll-off and background exposure must correspond to those sources.

ENVIRONMENT & PROPS: derive location, architecture, set dressing, surfaces, weather, time, hero props and spatial relationships from the approved Script and Storyboard. Include occupied-world imperfections—wear, dust, fingerprints, clutter, reflections, material variation and practical light sources. Maintain geography and screen direction across connected shots.

REAL HUMAN / PHYSICAL REALISM: visible pores, peach fuzz, subtle under-eye detail, natural lip texture, individual brow and hair strands, flyaways, realistic joints, skin compression, fabric contact, believable reflections and physically accurate object scale. Eyes are sharp with realistic iris fibres, waterline and catchlights.

COLOR & FINISH: premium commercial cinema grade consistent across the sequence; protect natural skin tones, keep controlled contrast, realistic highlight roll-off, subtle organic grain, gentle lens falloff and restrained optical imperfections.

ANTI-AI CONSTRAINTS: no CGI or game-render appearance, plastic/waxy/porcelain skin, beauty-filter identity drift, doll-like proportions, extra or missing fingers, duplicated limbs or accessories, warped anatomy, floating props, inconsistent logos, melted backgrounds, fake text, artificial bokeh, HDR halos, excessive sharpening or continuity changes.

OUTPUT: high-resolution production reference with professional film detail, physically plausible lighting and anatomy, exact continuity with the approved story and storyboard, no watermark and no unintended text.`;
}
function VisualPackageReview({
  p,
  items,
  reviewer,
  submit,
}: {
  p: P;
  items: any[];
  reviewer: boolean;
  submit: (x: any[]) => void;
}) {
  let saved: any = {};
  try {
    saved = JSON.parse(p.scriptData || "{}");
  } catch {}
  const stored = Array.isArray(saved.productionReviews)
      ? saved.productionReviews
      : [],
    [reviews, setReviews] = useState<any[]>(
      items.map((_: any, i: number) => stored[i] || { status: "", note: "" }),
    ),
    [open, setOpen] = useState<number | null>(null),
    update = (i: number, patch: any) =>
      setReviews((x) => x.map((r, j) => (j === i ? { ...r, ...patch } : r))),
    ready =
      items.length > 0 &&
      reviews.every(
        (r) => r.status && (r.status !== "refine" || r.note.trim()),
      );
  return (
    <section className="panel production-review-page">
      <div className="form-card-head">
        <p className="eyebrow">READ-ONLY PROMPT + IMAGE REVIEW</p>
        <h3>{p.approvalTitle}</h3>
        <p>
          Open one asset at a time. Review its exact prompt and uploaded images,
          then approve it or leave a refinement note directly below.
        </p>
      </div>
      <div className="asset-accordion-list review-accordion">
        {items.map((x: any, i: number) => {
          const status = reviews[i]?.status || "pending",
            expanded = open === i;
          return (
            <article className={`asset-accordion-item ${status}`} key={i}>
              <button
                type="button"
                className="asset-summary"
                onClick={() => setOpen(expanded ? null : i)}
              >
                <span>{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <small>{x.category}</small>
                  <b>{x.name}</b>
                </div>
                <em>
                  {status === "approved"
                    ? "✓ APPROVED"
                    : status === "refine"
                      ? "✕ REVISION"
                      : "AWAITING REVIEW"}
                </em>
                <strong>{expanded ? "−" : "＋"}</strong>
              </button>
              {expanded && (
                <div className="asset-expanded review-expanded">
                  <div className="readonly-production-content">
                    <small>HANDLER PROMPT</small>
                    <p>{x.prompt || "—"}</p>
                    <VisualAssetUploader
                      projectId={p.id}
                      phase="visual-development"
                      itemKey={`${x.category.toLowerCase().replaceAll(" ", "-")}-${i + 1}`}
                      readonly
                    />
                  </div>
                  <div
                    className={`item-review-panel ${status === "approved" ? "approved" : ""}`}
                  >
                    <b>Review description & status</b>
                    {reviewer && (
                      <>
                        <div className="review-choice">
                          <button
                            type="button"
                            className={
                              status === "approved" ? "selected approve" : ""
                            }
                            onClick={() =>
                              update(i, { status: "approved", note: "" })
                            }
                          >
                            ✓ ✓ Approve prompt + image
                          </button>
                          <button
                            type="button"
                            className={
                              status === "refine" ? "selected refine" : ""
                            }
                            onClick={() => update(i, { status: "refine" })}
                          >
                            ✕ Return for revision
                          </button>
                        </div>
                        {status === "refine" && (
                          <textarea
                            value={reviews[i]?.note || ""}
                            onChange={(e) =>
                              update(i, { note: e.target.value })
                            }
                            placeholder="Write the exact prompt or image change required for this asset…"
                          />
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
      {reviewer && (
        <footer className="production-review-footer">
          <button
            className="approve-all"
            onClick={() =>
              setReviews(items.map(() => ({ status: "approved", note: "" })))
            }
          >
            ✓ Approve All
          </button>
          <span>
            {reviews.filter((r) => r.status === "approved").length} approved ·{" "}
            {reviews.filter((r) => r.status === "refine").length} need changes
          </span>
          <button
            className="send-review"
            disabled={!ready}
            onClick={() => submit(reviews)}
          >
            Complete Review →
          </button>
        </footer>
      )}
    </section>
  );
}
function VisualDevelopmentBuilder({
  p,
  data,
  save,
}: {
  p: P;
  data: any;
  save: (x: any[]) => void;
}) {
  const keyShots = (data.storyboard || []).filter((x: any) => x.keyShot),
    defaults = [
      {
        category: "Main Character",
        name: "Lead Character",
        prompt: visualPrompt("main character design", data),
      },
      {
        category: "Supporting Character",
        name: "Supporting Character · Optional",
        prompt: visualPrompt("supporting character design", data),
      },
      {
        category: "Environment",
        name: "Hero Environment",
        prompt: visualPrompt("environment concept", data, keyShots[0]),
      },
      {
        category: "Props",
        name: "Hero Props",
        prompt: visualPrompt("prop design sheet", data, keyShots[0]),
      },
      {
        category: "Logo Reference",
        name: "Company Logo · Optional Upload",
        prompt:
          "Upload the approved company logo or brand mark. Do not generate or reinterpret a real logo.",
      },
      ...keyShots.map((s: any, i: number) => ({
        category: "Storyboard Frame",
        name: `Key Shot ${i + 1}`,
        prompt: visualPrompt("storyboard frame", data, s),
      })),
    ],
    [items, setItems] = useState<any[]>(
      data.visualDevelopment?.length ? data.visualDevelopment : defaults,
    ),
    update = (i: number, prompt: string) =>
      setItems((x) => x.map((a, j) => (j === i ? { ...a, prompt } : a)));
  return (
    <section className="panel production-builder">
      <div className="form-card-head">
        <p className="eyebrow">06 · VISUAL DEVELOPMENT & IMAGE GENERATION</p>
        <h3>Continuity Bible + Key Frames</h3>
        <p>
          Character, environment, props, logo reference and Key Shot frames are
          separated clearly. Each prompt and current image is approved together
          before Video Generation.
        </p>
      </div>
      <div className="visual-category-nav">
        {[
          "Main Character",
          "Supporting Character",
          "Environment",
          "Props",
          "Logo Reference",
          "Storyboard Frame",
        ].map((x) => (
          <span key={x}>{x}</span>
        ))}
      </div>
      <div className="generation-stack">
        {items.map((x: any, i: number) => (
          <article
            className="generation-card visual-dev-card"
            key={`${x.category}-${i}`}
          >
            <header>
              <div>
                <span>{x.category.toUpperCase()}</span>
                <b>{x.name}</b>
              </div>
            </header>
            <label>
              Auto-generated editable prompt
              <textarea
                value={x.prompt || ""}
                onChange={(e) => update(i, e.target.value)}
              />
            </label>
            <VisualAssetUploader
              projectId={p.id}
              phase="visual-development"
              itemKey={`${x.category.toLowerCase().replaceAll(" ", "-")}-${i + 1}`}
            />
          </article>
        ))}
      </div>
      <footer className="builder-footer">
        <span>
          {items.length} continuity assets · {keyShots.length} Key Shot frame
          {keyShots.length === 1 ? "" : "s"}
        </span>
        <button className="save-production" onClick={() => save(items)}>
          Save Visual Development
        </button>
      </footer>
    </section>
  );
}

function filmCharacters(data: any) {
  const count = Math.max(0, Number(data.characterCount) || 0),
    planned = Array.from({ length: count }, (_, i) => ({
      name: String(data[`characterName${i}`] || `Character ${i + 1}`),
      note: String(data[`characterNote${i}`] || ""),
    }));
  if (planned.length) return planned;
  const text = [
      data.theme,
      data.storyPremise,
      data.storyFlow,
      data.ending,
      ...(data.storyboard || []).flatMap((s: any) => [
        s.description,
        s.characterMotion,
        s.dialogue,
      ]),
    ]
      .filter(Boolean)
      .join(" "),
    stop = new Set([
      "The",
      "This",
      "That",
      "Create",
      "Opening",
      "Ending",
      "Story",
      "Character",
      "Optional",
      "Approved",
      "Commercial",
      "Video",
      "Shot",
    ]),
    names = [
      ...text.matchAll(
        /\\b([A-Z][a-z]{2,})(?=\\s+(?:enters|walks|looks|holds|turns|runs|speaks|faces|meets|fights|appears|is|the))/g,
      ),
    ]
      .map((m) => m[1])
      .filter((n) => !stop.has(n)),
    found = [...new Set(names)].map((name) => ({
      name,
      note: "Detected from approved script",
    }));
  return found.length
    ? found
    : [{ name: "Main Character", note: "Lead character" }];
}
function plannedAssets(data: any) {
  const characters = filmCharacters(data).map((x: any) => ({
      category: "Character",
      name: x.name,
      note: x.note || "",
    })),
    environmentCount = Math.max(1, Number(data.environmentCount) || 1),
    environments = Array.from({ length: environmentCount }, (_, i) => ({
      category: "Environment",
      name: String(
        data[`environmentName${i}`] ||
          (i === 0 ? "Primary Environment Design" : `Environment ${i + 1}`),
      ),
      note: String(data[`environmentNote${i}`] || ""),
    })),
    propsCount = Math.max(0, Number(data.propsCount) || 1),
    props = Array.from({ length: propsCount }, (_, i) => ({
      category: "Props",
      name: String(data[`propName${i}`] || `Prop / Product ${i + 1}`),
      note: String(data[`propNote${i}`] || ""),
    }));
  return [...characters, ...environments, ...props];
}
function legacyFocusedAssetPrompt(kind: string, data: any, item?: any) {
  const theme = data.theme || "Approved Film / Commercial",
    story = [data.storyPremise, data.storyFlow, data.ending]
      .filter(Boolean)
      .join(" → "),
    variation = Number(item?.variant || 0) + 1,
    common = `PROJECT: ${theme}. APPROVED STORY: ${story || "Follow the approved script and creative direction."} ASSET NOTES: ${item?.note || "Follow the approved production plan."} CREATIVE VARIATION ${variation}: change the visual design solution and presentation choices while preserving the approved identity, story function and continuity. Maintain exact continuity with all supplied references. Premium cinematic production quality, realistic materials, physically believable light, no watermark, no invented brand text, no malformed anatomy or fake labels.`;
  if (kind === "Character")
    return `Create a CHARACTER DESIGN TURNAROUND SHEET for ${item?.name || "the approved character"}. ${common}\\nLAYOUT: one clean presentation sheet with full-body FRONT, 3/4, SIDE and BACK views at identical scale; one large face portrait; three useful expressions; hair, wardrobe, footwear, accessories and material close-ups; color palette and height reference. Preserve identity, age and body proportions from supplied references. Define silhouette, outfit cut, exact colors, fabric, patterns, stitching, closures, footwear, jewellery, bags and story-relevant accessories. Neutral studio background only—no action scene, environment panorama or storyboard panels.`;
  if (kind === "Environment")
    return `Create an ENVIRONMENT DESIGN presentation for “${item?.name || "Approved Environment"}”. ${common}\\nLAYOUT: one large unobstructed hero location view; smaller entrance, main action zone and background-zone views; simple spatial-flow plan; practical light-source diagram; material and surface close-ups; color palette; atmosphere notes; human silhouette for scale. Establish geography, screen direction, usable camera positions, doors, windows, reflections and story-relevant set dressing. Do not turn this into a character sheet or storyboard.`;
  if (kind === "Props")
    return `Create a PROP / PRODUCT DESIGN SHEET for “${item?.name || "Approved Story Props"}”. ${common}\\nLAYOUT: isolated story-relevant objects on a neutral background; FRONT, SIDE, BACK and TOP views where useful; interaction points; size reference; construction details; exact colors; material swatches and close-ups. Include only approved props. Do not invent logos and do not create an environment panorama or storyboard.`;
  const shots = item?.shots || [];
  return `Create ONE professional STORYBOARD CONTACT SHEET for ${item?.name || "this sequence"}. ${common}\\nFORMAT RULE: the approved film delivery is 16:9, so arrange an exact 3 × 3 grid with up to nine numbered panels. Each panel must be composed natively for 16:9 with generous internal safe margins. Automatically choose the most readable framing and scale for each shot so faces, bodies, hands, important props and architectural features are fully visible and never accidentally cropped. Preserve the approved framing intention while adjusting subject placement within the frame when needed. Keep clean gutters, consistent panel borders, shot numbers and short labels. Preserve character identity, wardrobe, environments, props, lighting logic and screen direction across the sheet. Do not combine beats or invent shots.\\n${shots.map((s: any, j: number) => `PANEL ${j + 1} / SHOT ${s.number}: ${s.duration || "timing TBC"} · ${s.framing || "framing TBC"} · ${s.camera || "camera TBC"} · ${s.movement || "movement TBC"} · ${s.lighting || "lighting TBC"}. VISUAL: ${s.description || "Follow the approved shot."} PERFORMANCE: ${s.characterMotion || "Follow approved performance."}${s.dialogue ? ` DIALOGUE/VO: ${s.dialogue}` : ""}`).join("\\n")}\\nIf fewer than nine shots are supplied, keep unused grid cells clean and neutral. Never add unapproved story content.`;
}
function VisualDevelopmentBuilderV2({
  p,
  data,
  save,
  submit,
}: {
  p: P;
  data: any;
  save: (x: any[]) => void;
  submit: (x: any[]) => void;
}) {
  const shots = (
      data.storyboard?.length ? data.storyboard : storyboardDraft(data)
    ).map((x: any, i: number) => ({ ...x, number: i + 1 })),
    sheets = Array.from({ length: Math.ceil(shots.length / 9) }, (_, i) =>
      shots.slice(i * 9, i * 9 + 9),
    ),
    make = () => [
      ...plannedAssets(data).map((asset: any) => ({
        ...asset,
        variant: 0,
        prompt: productionAssetPrompt(asset.category, data, asset),
      })),
      ...sheets.map((group: any[], i: number) => {
        const item = {
          category: "Storyboard Sheet",
          name: `Storyboard Contact Sheet ${i + 1} · Shots ${i * 9 + 1}–${i * 9 + group.length}`,
          shots: group,
          variant: 0,
        };
        return {
          ...item,
          prompt: productionAssetPrompt("Storyboard Sheet", data, item),
        };
      }),
    ],
    [items, setItems] = useState<any[]>(
      data.visualDevelopment?.some(
        (x: any) => x.category === "Storyboard Sheet",
      )
        ? data.visualDevelopment.map((x: any) =>
            String(x.prompt || "").includes("CONTINUITY LOCK")
              ? x
              : { ...x, prompt: productionAssetPrompt(x.category, data, x) },
          )
        : make(),
    ),
    [open, setOpen] = useState<number | null>(null),
    reviews = Array.isArray(data.productionReviews)
      ? data.productionReviews
      : [],
    update = (i: number, patch: any) =>
      setItems((x) => x.map((a, j) => (j === i ? { ...a, ...patch } : a))),
    regenerate = (i: number) => {
      const next = { ...items[i], variant: Number(items[i].variant || 0) + 1 };
      update(i, {
        variant: next.variant,
        prompt: productionAssetPrompt(next.category, data, next),
      });
    },
    add = (category: string) => {
      const count = items.filter((x) => x.category === category).length + 1,
        name =
          category === "Character"
            ? `Character ${count}`
            : category === "Environment"
              ? `Environment ${count}`
              : `Prop / Product ${count}`,
        item = { category, name, note: "", variant: 0 };
      setItems((x) => [
        ...x,
        { ...item, prompt: productionAssetPrompt(category, data, item) },
      ]);
    };
  return (
    <>
      <section className="panel approved-production-source">
        <div className="form-card-head">
          <p className="eyebrow">APPROVED SCRIPT + STORY SOURCE</p>
          <h3>{data.theme || "Approved Film Story"}</h3>
          <p>
            Every asset below is carried forward from the approved Script plan
            and Storyboard.
          </p>
        </div>
        <div className="approved-source-grid">
          <div>
            <b>Premise</b>
            <p>{data.storyPremise || "—"}</p>
          </div>
          <div>
            <b>Story flow</b>
            <p>{data.storyFlow || "—"}</p>
          </div>
          <div>
            <b>Ending & meaning</b>
            <p>{data.ending || "—"}</p>
            <small>{data.meaning || "—"}</small>
          </div>
          <div>
            <b>Approved asset plan</b>
            <p>
              {plannedAssets(data)
                .map((x: any) => `${x.name} · ${x.category}`)
                .join("  |  ")}
            </p>
          </div>
        </div>
      </section>
      <section className="panel production-builder visual-production-board">
        <div className="form-card-head">
          <p className="eyebrow">
            {p.type === "MV" ? "08" : "05–07"} · PRODUCTION DESIGN & IMAGE
            GENERATION
          </p>
          <h3>Production Asset List</h3>
          <p>
            The list stays compact by default. Open one asset to view its
            prompt, regenerate a variation and upload images.
          </p>
          <div className="asset-builder-actions">
            <button type="button" onClick={() => add("Character")}>
              ＋ Add character
            </button>
            <button type="button" onClick={() => add("Environment")}>
              ＋ Add environment
            </button>
            <button type="button" onClick={() => add("Props")}>
              ＋ Add props
            </button>
            <button
              type="button"
              className="rebuild"
              onClick={() => {
                setItems(make());
                setOpen(null);
              }}
            >
              ✦ Rebuild from approved plan
            </button>
          </div>
        </div>
        <div className="asset-accordion-list">
          {items.map((x: any, i: number) => {
            const status = reviews[i]?.status || "pending",
              expanded = open === i;
            return (
              <article
                className={`asset-accordion-item ${status}`}
                key={`${x.category}-${i}`}
              >
                <button
                  type="button"
                  className="asset-summary"
                  onClick={() => setOpen(expanded ? null : i)}
                >
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <small>{x.category}</small>
                    <b>{x.name}</b>
                  </div>
                  <em>
                    {status === "approved"
                      ? "✓ APPROVED"
                      : status === "refine"
                        ? "✕ REVISION"
                        : "NOT SUBMITTED"}
                  </em>
                  <strong>{expanded ? "−" : "＋"}</strong>
                </button>
                {expanded && (
                  <div className="asset-expanded">
                    <div className="asset-detail-head">
                      <label>
                        Asset name
                        <input
                          value={x.name || ""}
                          onChange={(e) => update(i, { name: e.target.value })}
                        />
                      </label>
                      <button type="button" onClick={() => regenerate(i)}>
                        ✦ AI generate another prompt
                      </button>
                    </div>
                    <label className="asset-prompt-field">
                      Editable production prompt
                      <textarea
                        value={x.prompt || ""}
                        onChange={(e) => update(i, { prompt: e.target.value })}
                      />
                    </label>
                    <small className="prompt-note">
                      Variation {Number(x.variant || 0) + 1} · Prompt stays
                      grounded in the approved Script, asset plan and
                      Storyboard.
                    </small>
                    <VisualAssetUploader
                      projectId={p.id}
                      phase="visual-development"
                      itemKey={`${x.category.toLowerCase().replaceAll(" ", "-")}-${i + 1}`}
                    />
                    {reviews[i] && (
                      <div
                        className={`attached-review ${status === "approved" ? "approved" : ""}`}
                      >
                        <b>
                          {status === "approved"
                            ? "Approved by management"
                            : "Management refinement comment"}
                        </b>
                        <p>
                          {reviews[i]?.note || "Prompt and image approved."}
                        </p>
                      </div>
                    )}
                    {x.category !== "Storyboard Sheet" && (
                      <button
                        type="button"
                        className="remove-asset"
                        onClick={() => {
                          setItems((list) =>
                            list.filter((_: any, j: number) => j !== i),
                          );
                          setOpen(null);
                        }}
                      >
                        Remove this asset
                      </button>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
        <footer className="builder-footer">
          <span>
            {items.length} approval packages · every package requires at least
            one uploaded image
          </span>
          <div>
            <button className="add-shot" onClick={() => save(items)}>
              Save Draft
            </button>
            <button className="save-production" onClick={() => submit(items)}>
              Save & Submit for Approval →
            </button>
          </div>
        </footer>
      </section>
    </>
  );
}
function AssetPlanFields({ data }: { data: any }) {
  const initialCharacters = Math.max(
      1,
      Number(data.characterCount) || filmCharacters(data).length,
    ),
    initialEnvironments = Math.max(1, Number(data.environmentCount) || 1),
    initialProps = Math.max(0, Number(data.propsCount) || 1),
    [characters, setCharacters] = useState(initialCharacters),
    [environments, setEnvironments] = useState(initialEnvironments),
    [props, setProps] = useState(initialProps);
  return (
    <section className="asset-plan-fields">
      <div className="asset-plan-head">
        <div>
          <b>Production Asset Plan</b>
          <span>
            Confirm what the story needs before Script approval. These named
            assets carry forward into 05–07.
          </span>
        </div>
      </div>
      <div className="asset-count-row">
        <label>
          Characters
          <input
            name="characterCount"
            type="number"
            min="1"
            max="12"
            value={characters}
            onChange={(e) =>
              setCharacters(
                Math.max(1, Math.min(12, Number(e.target.value) || 1)),
              )
            }
          />
        </label>
        <label>
          Environments
          <input
            name="environmentCount"
            type="number"
            min="1"
            max="12"
            value={environments}
            onChange={(e) =>
              setEnvironments(
                Math.max(1, Math.min(12, Number(e.target.value) || 1)),
              )
            }
          />
        </label>
        <label>
          Props / Products
          <input
            name="propsCount"
            type="number"
            min="0"
            max="20"
            value={props}
            onChange={(e) =>
              setProps(Math.max(0, Math.min(20, Number(e.target.value) || 0)))
            }
          />
        </label>
      </div>
      <div className="asset-plan-groups">
        <div>
          <h4>Characters</h4>
          {Array.from({ length: characters }, (_, i) => (
            <div className="asset-plan-row" key={`c${i}`}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              <input
                name={`characterName${i}`}
                defaultValue={
                  data[`characterName${i}`] ||
                  filmCharacters(data)[i]?.name ||
                  ""
                }
                placeholder="Character name"
              />
              <input
                name={`characterNote${i}`}
                defaultValue={data[`characterNote${i}`] || ""}
                placeholder="Appearance, identity or story purpose"
              />
            </div>
          ))}
        </div>
        <div>
          <h4>Environments</h4>
          {Array.from({ length: environments }, (_, i) => (
            <div className="asset-plan-row" key={`e${i}`}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              <input
                name={`environmentName${i}`}
                defaultValue={
                  data[`environmentName${i}`] ||
                  (i === 0 ? "Primary Environment Design" : "")
                }
                placeholder="Environment name"
              />
              <input
                name={`environmentNote${i}`}
                defaultValue={data[`environmentNote${i}`] || ""}
                placeholder="Location purpose and important details"
              />
            </div>
          ))}
        </div>
        <div>
          <h4>Props / Products</h4>
          {Array.from({ length: props }, (_, i) => (
            <div className="asset-plan-row" key={`p${i}`}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              <input
                name={`propName${i}`}
                defaultValue={data[`propName${i}`] || ""}
                placeholder="Prop or product name"
              />
              <input
                name={`propNote${i}`}
                defaultValue={data[`propNote${i}`] || ""}
                placeholder="How it is used in the story"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
function ScriptForm({
  p,
  save,
}: {
  p: P;
  save: (b: Record<string, string>) => void;
}) {
  let d: any = {};
  try {
    d = JSON.parse(p.scriptData || "{}");
  } catch {}
  const recurring =
      p.projectNature === "recurring" ||
      (!p.projectNature && Boolean(p.recurring)),
    unit =
      p.frequencyUnit ||
      (p.recurring?.toLowerCase().includes("month") ? "month" : "week"),
    frequency =
      Number(p.frequencyCount) ||
      (p.recurring?.match(/\d+/)?.[0]
        ? Number(p.recurring.match(/\d+/)?.[0])
        : 3),
    batchCount = recurring
      ? Math.min(
          31,
          unit === "daily"
            ? 14
            : unit === "month"
              ? Math.ceil(frequency / 2)
              : frequency * 2,
        )
      : 1,
    ideas = Array.isArray(d.ideas) ? d.ideas : [];
  if (p.type === "MV") return <MVMusicWorkflow p={p} data={d} />;
  if (p.scriptStatus === "Approved")
    return (
      <>
        <ScriptTextExport p={p} />
        <ReadOnlyScript p={p} data={d} />
      </>
    );
  if (p.type === "Commercial Film Series")
    return (
      <>
        <ScriptTextExport p={p} />
        <FilmSeriesScript p={p} data={d} save={save} />
      </>
    );
  return (
    <>
      <ScriptTextExport p={p} />
      <FormCard
        eyebrow={`04 · ${p.scriptStatus || "Draft"}`}
        title={
          recurring
            ? `2-Week Content Batch · ${batchCount} Ideas`
            : "One-off Detailed Script"
        }
        subtitle={
          recurring
            ? `${frequency} ${unit === "daily" ? "daily" : `times per ${unit}`} creates ${batchCount} idea slots for the next two weeks. Recurring Social/Reels skips Storyboard.`
            : "A one-off production defines the premise, story flow and meaning. Detailed timing is completed later in Storyboard."
        }
        onSubmit={(b) => {
          if (!recurring) {
            save(b);
            return;
          }
          const next = Array.from({ length: batchCount }, (_, i) => ({
            publishDate: b[`ideaDate${i}`] || "",
            format: b[`ideaFormat${i}`] || "Photo Post",
            title: b[`ideaTitle${i}`] || "",
            story: b[`ideaStory${i}`] || "",
            caption: b[`ideaCaption${i}`] || "",
            hashtags: b[`ideaHashtags${i}`] || "",
            subjectPresence: b[`ideaSubject${i}`] || "Human present",
          }));
          save({ ideas: next } as any);
        }}
        submit="Submit Script for approval"
      >
        {recurring ? (
          <>
            <div className="planning-rule">
              <b>ROLLING 2-WEEK PRODUCTION WINDOW</b>
              <span>
                Every approved idea receives its own dated folder manifest.
                Actual Drive folder creation remains pending until Drive API
                connection is active.
              </span>
            </div>
            <div className="idea-batch">
              {Array.from({ length: batchCount }, (_, i) => {
                const x = ideas[i] || {};
                return (
                  <section className="idea-card" key={i}>
                    <header>
                      <span>{String(i + 1).padStart(2, "0")}</span>
                      <b>Post / Reel Idea</b>
                    </header>
                    <div className="form-grid">
                      <Field
                        name={`ideaDate${i}`}
                        type="date"
                        label="Publish date"
                        value={x.publishDate}
                      />
                      <label className="field">
                        Format
                        <select
                          name={`ideaFormat${i}`}
                          defaultValue={x.format || "Photo Post"}
                        >
                          <option>Photo Post</option>
                          <option>Carousel</option>
                          <option>Short Video / Reels</option>
                        </select>
                      </label>
                      <label className="field">
                        Visual subject
                        <select
                          name={`ideaSubject${i}`}
                          defaultValue={x.subjectPresence || "Human present"}
                        >
                          <option>Human present</option>
                          <option>No human · product / object only</option>
                          <option>No face · hands / body detail only</option>
                          <option>Environment only</option>
                        </select>
                      </label>
                    </div>
                    <Field
                      name={`ideaTitle${i}`}
                      label="Idea / theme"
                      value={x.title}
                    />
                    <Field
                      area
                      name={`ideaStory${i}`}
                      label="Simple story / post idea"
                      value={x.story}
                      placeholder="What happens or what the audience sees"
                    />
                    <Field
                      area
                      name={`ideaCaption${i}`}
                      label="Caption"
                      value={x.caption}
                    />
                    <Field
                      name={`ideaHashtags${i}`}
                      label="Hashtags"
                      value={x.hashtags}
                    />
                  </section>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <div className="form-grid">
              <Field
                name="theme"
                label="Theme / working title"
                value={d.theme}
              />
              {p.projectDuration ? (
                <label className="field">
                  Project duration · fixed
                  <input name="duration" value={p.projectDuration} readOnly />
                </label>
              ) : (
                <Field
                  name="duration"
                  label="Estimated duration / seconds"
                  value={d.duration}
                  placeholder="Legacy project · enter duration once"
                />
              )}
            </div>
            <Field
              area
              name="storyPremise"
              label="Story premise"
              value={d.storyPremise}
              placeholder="Who is involved, what is the situation, and what begins the story?"
            />
            <Field
              area
              name="storyFlow"
              label="Complete story flow"
              value={d.storyFlow}
              placeholder="Describe the story from beginning to development and payoff. Detailed shot timing will be created later in Storyboard."
            />
            <Field
              area
              name="ending"
              label="Ending / Brand close"
              value={d.ending}
              placeholder="How the story resolves and what the audience sees or understands at the end"
            />
            <div className="form-grid">
              <Field
                area
                name="meaning"
                label="Storytelling meaning"
                value={d.meaning}
                placeholder="What does this story mean beneath the surface?"
              />
              <Field
                area
                name="designReason"
                label="Why this story design works"
                value={d.designReason}
                placeholder="Why this premise, flow and ending fit the brand and audience"
              />
            </div>
            <AssetPlanFields data={d} />
            <div className="storyboard-note">
              <b>Timeline belongs in Storyboard</b>
              <span>
                Shot-by-shot seconds, camera details and visual timing will be
                created in the next section.
              </span>
            </div>
          </>
        )}
      </FormCard>
    </>
  );
}
function FormCard({
  eyebrow,
  title,
  subtitle,
  onSubmit,
  submit,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  onSubmit: (b: Record<string, string>) => void;
  submit: string;
  children: any;
}) {
  function go(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      b: Record<string, string> = {};
    f.forEach((v, k) => (b[k] = String(v)));
    onSubmit(b);
  }
  return (
    <section className="panel form-card">
      <div className="form-card-head">
        <p className="eyebrow">{eyebrow}</p>
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
      <form onSubmit={go}>
        {children}
        <div className="form-footer">
          <span>
            This button submits the completed phase to management approval.
            Incomplete required fields are blocked.
          </span>
          <button type="submit">{submit} →</button>
        </div>
      </form>
    </section>
  );
}
function projectContext(p: P, phase: "brief" | "foundation") {
  const line = (label: string, value: any) =>
      `${label}: ${String(value || "Not provided")}`,
    brief = [
      `PROJECT CONTEXT · ${p.id}`,
      line("Project", p.client),
      line("Type", p.type),
      line("Nature", p.projectNature),
      line(
        "Fixed duration",
        p.projectDuration ? `${p.projectDuration} seconds` : "Not set",
      ),
      line(
        "Schedule",
        `${p.projectStartDate || "TBC"} to ${p.projectEndDate || "TBC"}`,
      ),
      "",
      `00 · CLIENT BRIEF`,
      line("Prepared by", p.briefOwner),
      line("Client / Brand", p.clientName || p.client),
      line("Brand / Product background", p.brandOverview),
      line("Project goal", p.projectGoal),
      line("Target audience", p.audience),
      line("Deliverables", p.deliverables),
      line("Key message / Offer", p.keyMessage),
      line("Tone / Visual direction", p.tone),
      line("Must include / Must avoid", p.restrictions),
    ];
  if (phase === "brief") return brief.join("\n");
  return [
    ...brief,
    "",
    `01–03 · FOUNDATION`,
    line("Market snapshot", p.marketSnapshot),
    line("Market opportunities", p.marketOpportunities),
    line("Trend observations", p.trendObservations),
    line("Why these trends fit", p.trendFit),
    line("Creative concept", p.creativeConcept),
    line("Creative objective", p.creativeObjective),
    line("Content pillars", p.contentPillars),
    line("Visual style & art direction", p.visualStyle),
    line("Format direction", p.formatDirection),
    line("Tone, mood & pacing", p.toneMood),
    line("References", p.marketReferences || p.trendReferences),
  ].join("\n");
}
function ContextExport({ p, phase }: { p: P; phase: "brief" | "foundation" }) {
  const [copied, setCopied] = useState(false),
    text = projectContext(p, phase),
    name = `${p.id}_${phase}-ai-context.txt`;
  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  function download() {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  return (
    <section className="context-export">
      <div>
        <span>AI CONTEXT EXPORT</span>
        <b>
          {phase === "brief"
            ? "Complete Client Brief context"
            : "Complete Brief + Foundation context"}
        </b>
        <small>
          Send the full phase context to ChatGPT or another AI without copying
          every field one by one.
        </small>
      </div>
      <button type="button" onClick={copy}>
        {copied ? "✓ Copied" : "Copy context"}
      </button>
      <button type="button" onClick={download}>
        Download .txt
      </button>
    </section>
  );
}
function FoundationReviewPanel({
  p,
  act,
}: {
  p: P;
  act: (id: string, b: Record<string, string>) => void;
}) {
  const [note, setNote] = useState("");
  return (
    <section className="panel foundation-inline-review">
      <div className="form-card-head">
        <p className="eyebrow">MANAGEMENT REVIEW · 01–03</p>
        <h3>Foundation review decision</h3>
        <p>
          The submitted research and creative direction above are read-only
          during review. Leave one clear comment for revision, or approve the
          complete Foundation.
        </p>
      </div>
      <div className="foundation-decision">
        <label>
          Review comment
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Write the exact direction that needs refinement. Leave blank when approving."
          />
        </label>
        <div>
          <button
            className="revise"
            disabled={!note.trim()}
            onClick={() =>
              act(p.id, {
                action: "reviseCombinedResearch",
                revisionNote: note.trim(),
              })
            }
          >
            ✕ Return for revision
          </button>
          <button
            className="approve"
            onClick={() => act(p.id, { action: "approveCombinedResearch" })}
          >
            ✓ Approve 01–03 → Script
          </button>
        </div>
      </div>
    </section>
  );
}
function Field({
  name,
  label,
  value,
  placeholder,
  area,
  type,
}: {
  name: string;
  label: string;
  value?: string;
  placeholder?: string;
  area?: boolean;
  type?: string;
}) {
  const required = [
      "theme",
      "duration",
      "storyPremise",
      "storyFlow",
      "ending",
      "meaning",
      "designReason",
      "songLyrics",
      "songStyle",
    ].includes(name),
    normalizedValue =
      name === "telegramChatId" && value === "8887184200"
        ? "8009020714"
        : value;
  return (
    <label className="field">
      {label}
      {required && <em>Required before approval</em>}
      {area ? (
        <textarea
          required={required}
          name={name}
          defaultValue={normalizedValue || ""}
          placeholder={placeholder}
        />
      ) : (
        <input
          required={required}
          name={name}
          type={type || "text"}
          defaultValue={normalizedValue || ""}
          placeholder={placeholder}
        />
      )}
    </label>
  );
}
function ApprovalQueue({
  ps,
  edits,
  open,
  act,
}: {
  ps: P[];
  edits: any[];
  open: (p: P) => void;
  act: (id: string, b: Record<string, string>) => void;
}) {
  const canonicalReviews = ps.flatMap((p) =>
      canonicalPhases(p, ["Reviewing"]).map((phase: any) => ({ p, phase })),
    ),
    slotReviews = ps.flatMap((p) =>
      (p.videoSlots || []).flatMap((slot: any) =>
        Object.entries(slot.data?.phases || {})
          .filter(([, phase]: any) => phase?.status === "Reviewing")
          .map(([key]) => ({
            p,
            slot,
            key,
            label:
              key === "creativeDirection" ? "Creative Direction" : "Script",
          })),
      ),
    );
  const legacy = ps.filter(
    (p) =>
      (p.marketStatus === "Submitted" ||
        p.trendStatus === "Submitted" ||
        p.scriptStatus === "Submitted" ||
        Boolean(p.approvalTitle)) &&
      canonicalPhases(p, ["Reviewing"]).length === 0 &&
      slotPhases(p, ["Reviewing"]).length === 0,
  );
  return (
    <>
      {canonicalReviews.length > 0 && (
        <section className="panel page-panel canonical-approval-queue">
          <div className="panel-head">
            <div>
              <h3>Phases in Review</h3>
              <p>Each notification opens the exact Project and Phase.</p>
            </div>
            <span className="count">{canonicalReviews.length}</span>
          </div>
          {canonicalReviews.map(({ p, phase }: any) => (
            <button
              className="task-line approval-jump"
              key={`${p.id}-${phase.phaseKey}`}
              onClick={() => open({ ...p, _openPhase: phase.phaseKey } as any)}
            >
              <span className="pink">Reviewing</span>
              <div>
                <b>{phase.label}</b>
                <small>
                  {p.client} · {p.id}
                </small>
              </div>
              <i>Open exact review →</i>
            </button>
          ))}
        </section>
      )}
      {slotReviews.length > 0 && (
        <section className="panel page-panel">
          <div className="panel-head">
            <div>
              <h3>Video Slot Approvals</h3>
              <p>Tap a review to open the exact Slot and Phase.</p>
            </div>
            <span className="count">{slotReviews.length}</span>
          </div>
          {slotReviews.map(({ p, slot, key, label }: any) => (
            <button
              className="task-line approval-jump"
              key={`${p.id}-${slot.id}-${key}`}
              onClick={() => open({ ...p, _openSlotId: slot.id } as any)}
            >
              <span className="pink">Reviewing</span>
              <div>
                <b>
                  Slot {String(slot.slotNumber).padStart(2, "0")} · {label}
                </b>
                <small>
                  {p.client} · {slot.purpose}
                </small>
              </div>
              <i>Open exact review →</i>
            </button>
          ))}
        </section>
      )}
      <LegacyApprovalQueue ps={legacy} edits={edits} open={open} act={act} />
    </>
  );
}
function LegacyApprovalQueue({
  ps,
  edits,
  open,
  act,
}: {
  ps: P[];
  edits: any[];
  open: (p: P) => void;
  act: (id: string, b: Record<string, string>) => void;
}) {
  const [reviewing, setReviewing] = useState<P | null>(null);
  return (
    <>
      <section className="panel page-panel">
        <div className="panel-head">
          <div>
            <h3>Submitted Assignments</h3>
            <p>
              Every completed phase waits here before the project can advance
            </p>
          </div>
          <span className="count">{ps.length}</span>
        </div>
        {ps.length ? (
          ps.map((p) => {
            const production =
                String(p.approvalTitle || "").includes("Storyboard") ||
                String(p.approvalTitle || "").includes("Image Generation") ||
                String(p.approvalTitle || "").includes("MV Music Review") ||
                String(p.approvalTitle || "") === "Foundation Review",
              script = p.scriptStatus === "Submitted" && !production;
            return (
              <article className="approval-card" key={p.id}>
                <div>
                  <span>{p.id}</span>
                  <h3>{p.client}</h3>
                  <p>
                    {production
                      ? p.approvalTitle
                      : script
                        ? `04 Script · ${p.projectNature === "recurring" ? "2-week recurring batch" : "one-off detailed script"}`
                        : "01 Market · 02 Trend · 03 Creative Direction"}
                  </p>
                </div>
                <div className="approval-actions">
                  {production ? (
                    <button
                      className="review-primary"
                      onClick={() =>
                        open({ ...p, _openPhase: phaseKeyFor(p) } as any)
                      }
                    >
                      Open read-only item review →
                    </button>
                  ) : script ? (
                    <button
                      className="review-primary"
                      onClick={() => setReviewing(p)}
                    >
                      Open script review →
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() =>
                          open({ ...p, _openPhase: phaseKeyFor(p) } as any)
                        }
                      >
                        Review foundation
                      </button>
                      <button
                        className="revise"
                        onClick={() => {
                          const revisionNote = prompt(
                            "What needs to be refined?",
                          );
                          if (revisionNote)
                            act(p.id, {
                              action: "reviseCombinedResearch",
                              revisionNote,
                            });
                        }}
                      >
                        ✕ Request revision
                      </button>
                      <button
                        className="approve"
                        onClick={() =>
                          act(p.id, { action: "approveCombinedResearch" })
                        }
                      >
                        ✓ Approve → 04 Script
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })
        ) : (
          <div className="empty-state compact">
            <span>✓</span>
            <h3>Nothing waiting</h3>
            <p>Submitted work will appear here.</p>
          </div>
        )}
      </section>
      <section className="panel page-panel edit-log-panel">
        <div className="panel-head">
          <div>
            <h3>Foundation Edit Notifications</h3>
            <p>Dismiss items after review</p>
          </div>
          <div className="notification-tools">
            <span className="count">{edits.length}</span>
            {edits.length > 0 && (
              <button
                onClick={() =>
                  act(edits[0].projectId, { action: "clearEditNotifications" })
                }
              >
                Clear all
              </button>
            )}
          </div>
        </div>
        {edits.length ? (
          edits.map((e) => (
            <article className="edit-log" key={e.id}>
              <span className="edit-dot" />
              <div>
                <b>
                  {e.editorName} edited {e.researchType} Research
                </b>
                <small>
                  {e.projectId} · Tier {e.editorTier} ·{" "}
                  {new Date(e.createdAt).toLocaleString()}
                </small>
              </div>
              <p>{JSON.parse(e.changedFields || "[]").join(" · ")}</p>
              <button
                className="dismiss-notice"
                aria-label="Dismiss notification"
                onClick={() =>
                  act(e.projectId, {
                    action: "dismissEdit",
                    notificationId: String(e.id),
                  })
                }
              >
                ×
              </button>
            </article>
          ))
        ) : (
          <div className="mini-empty">No edits recorded.</div>
        )}
      </section>
      {reviewing && (
        <ScriptReviewModal
          p={reviewing}
          close={() => setReviewing(null)}
          submit={async (reviews) => {
            await act(reviewing.id, {
              action: "reviewScriptItems",
              reviews: JSON.stringify(reviews),
            });
            setReviewing(null);
          }}
        />
      )}
    </>
  );
}

function ScriptReviewModal({
  p,
  close,
  submit,
}: {
  p: P;
  close: () => void;
  submit: (reviews: any[]) => void;
}) {
  let d: any = {};
  try {
    d = JSON.parse(p.scriptData || "{}");
  } catch {}
  const series = Array.isArray(d.films),
    recurring = p.projectNature === "recurring" || Array.isArray(d.ideas),
    items = series ? d.films : recurring ? d.ideas || [] : [d],
    [reviews, setReviews] = useState<any[]>(
      items.map(
        (_: any, i: number) => d.reviews?.[i] || { status: "", note: "" },
      ),
    );
  const update = (i: number, key: string, value: string) =>
      setReviews((x) =>
        x.map((r, j) => (j === i ? { ...r, [key]: value } : r)),
      ),
    ready =
      reviews.length > 0 &&
      reviews.every(
        (r) => r.status && (r.status !== "refine" || r.note?.trim()),
      );
  return (
    <Modal close={close}>
      <ScriptTextExport p={p} compact />
      <div className="script-review-head">
        <p className="eyebrow">SCRIPT REVIEW · {p.id}</p>
        <h2>{p.client}</h2>
        <p>
          Review every script beside its story. Approve the scripts that are
          ready and leave a precise refinement note for the others.
        </p>
      </div>
      <div className="script-review-list">
        {items.map((x: any, i: number) => (
          <article className="script-review-item" key={i}>
            <header>
              <span>{String(i + 1).padStart(2, "0")}</span>
              <div>
                <b>
                  {recurring
                    ? x.title || "Untitled content idea"
                    : series
                      ? x.title || "Untitled commercial film"
                      : x.theme || "One-off detailed script"}
                </b>
                <small>
                  {recurring
                    ? `${x.publishDate || "Date TBC"} · ${x.format || "Format TBC"}`
                    : x.duration || "Duration TBC"}
                </small>
              </div>
            </header>
            <div className="script-story">
              <small>
                {recurring ? "STORY / POST IDEA" : "STORY PREMISE & FLOW"}
              </small>
              <p>
                {recurring
                  ? x.story || "No story supplied"
                  : [x.storyPremise, x.storyFlow, x.ending]
                      .filter(Boolean)
                      .join("\n\n") || "No story supplied"}
              </p>
              {recurring && (
                <>
                  <small>CAPTION & HASHTAGS</small>
                  <p>
                    {x.caption || "—"}
                    <br />
                    {x.hashtags || ""}
                  </p>
                </>
              )}
            </div>
            <div
              className={`inline-review ${reviews[i]?.status === "approved" ? "approved" : ""}`}
            >
              <b>Your review</b>
              <div className="review-choice">
                <button
                  type="button"
                  className={
                    reviews[i]?.status === "approved" ? "selected approve" : ""
                  }
                  onClick={() => update(i, "status", "approved")}
                >
                  ✓ Approve this script
                </button>
                <button
                  type="button"
                  className={
                    reviews[i]?.status === "refine" ? "selected refine" : ""
                  }
                  onClick={() => update(i, "status", "refine")}
                >
                  ✕ Return for revision
                </button>
              </div>
              {reviews[i]?.status === "refine" && (
                <textarea
                  autoFocus
                  value={reviews[i]?.note || ""}
                  onChange={(e) => update(i, "note", e.target.value)}
                  placeholder="Write exactly what needs to change for this script…"
                />
              )}
              <small>
                {reviews[i]?.status === "approved"
                  ? "This script will be marked approved."
                  : reviews[i]?.status === "refine"
                    ? "This message will appear in the assigned member's My Tasks notification."
                    : "Choose a decision for this script."}
              </small>
            </div>
          </article>
        ))}
      </div>
      <footer className="script-review-footer">
        <span>
          {reviews.filter((r) => r.status === "approved").length} approved ·{" "}
          {reviews.filter((r) => r.status === "refine").length} need refinement
        </span>
        <button disabled={!ready} onClick={() => submit(reviews)}>
          Send review to assigned people →
        </button>
      </footer>
    </Modal>
  );
}
function TaskList({
  ps,
  email,
  open,
}: {
  ps: P[];
  email: string;
  open: (p: P) => void;
}) {
  const tasks = ps.filter((p) => {
      try {
        return (
          JSON.parse(p.assignmentMembers || "[]").includes(
            email.toLowerCase(),
          ) && !["Completed", "Awaiting Approval"].includes(p.assignmentStatus)
        );
      } catch {
        return false;
      }
    }),
    revisions = tasks.filter(
      (p) => p.assignmentStatus === "Revision Requested",
    );
  return (
    <section className="panel page-panel">
      <div className="panel-head">
        <div>
          <h3>My Assigned Tasks</h3>
          <p>
            {revisions.length
              ? `${revisions.length} review feedback task${revisions.length === 1 ? "" : "s"} need attention`
              : "Only work assigned directly to you"}
          </p>
        </div>
        <span className={`count ${revisions.length ? "revision-count" : ""}`}>
          {tasks.length}
        </span>
      </div>
      {revisions.length > 0 && (
        <div className="task-alert">
          <b>Review feedback received</b>
          <span>
            Open the red task below. Every comment is attached to its exact
            block or shot.
          </span>
        </div>
      )}
      {tasks.map((p) => {
        let refineCount = 0;
        try {
          refineCount = (
            JSON.parse(p.scriptData || "{}").productionReviews || []
          ).filter((r: any) => r.status === "refine").length;
        } catch {}
        return (
          <button className="task-line" key={p.id} onClick={() => open(p)}>
            <span
              className={
                p.assignmentStatus === "Revision Requested" ? "pink" : "blue"
              }
            >
              {p.assignmentStatus}
            </span>
            <div>
              <b>
                {p.assignmentStage || p.stage}
                {refineCount
                  ? ` · ${refineCount} item${refineCount === 1 ? "" : "s"} to refine`
                  : ""}
              </b>
              <small>
                {p.client} · Due {p.assignmentDueAt || "not set"}
                {p.revisionNote ? ` · ${p.revisionNote}` : ""}
              </small>
            </div>
            <i>
              {p.assignmentStatus === "Revision Requested"
                ? "View feedback →"
                : "Open task →"}
            </i>
          </button>
        );
      })}
      {!tasks.length && (
        <div className="mini-empty">No active task is assigned to you.</div>
      )}
    </section>
  );
}
function AgentTaskQueue() {
  const [items, setItems] = useState<any[]>([]),
    [working, setWorking] = useState(""),
    [message, setMessage] = useState("");
  async function load() {
    const response = await fetch("/api/agent-runner", { cache: "no-store" });
    if (response.ok) setItems((await response.json()).assignments || []);
  }
  useEffect(() => {
    load();
    const timer = window.setInterval(load, 30000),
      refresh = () => load();
    window.addEventListener("frameflow:refresh", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("frameflow:refresh", refresh);
    };
  }, []);
  async function command(projectId: string, action: "run" | "stop" | "resume") {
    setWorking(projectId);
    setMessage("");
    const response = await fetch("/api/agent-runner", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, projectId }),
      }),
      data = await response
        .json()
        .catch(() => ({ error: "Agent command failed" }));
    setMessage(
      response.ok
        ? `${projectId} · ${data.status || data.phaseLabel || "Agent status updated"}`
        : data.error || "Agent task could not update",
    );
    await load();
    window.dispatchEvent(
      new CustomEvent("frameflow:refresh", { detail: { projectId } }),
    );
    setWorking("");
  }
  const presence = items[0],
    online = presence?.agentConnectionStatus === "ONLINE";
  return (
    <section className="panel page-panel agent-task-queue">
      <div className="panel-head">
        <div>
          <p className="eyebrow">TIER 4 AGENT WORK</p>
          <h3>Agent Work</h3>
          <p>
            The single control center for Agent connection, Project automation,
            and provider execution.
          </p>
        </div>
        <span className="count">{items.length}</span>
      </div>
      {presence && (
        <div className={`agent-presence ${online ? "online" : "offline"}`}>
          <span />
          <div>
            <b>{`Agent connection · ${online ? "Online" : "Offline"}`}</b>
            <small>
              {presence.agentConnectionLabel}
              {presence.agentLastSeenAt
                ? ` · Last heartbeat ${new Date(presence.agentLastSeenAt).toLocaleString()}`
                : ""}
            </small>
            <em>
              FrameFlow and provider jobs can continue independently when the
              Agent is offline.
            </em>
          </div>
        </div>
      )}
      {items.length ? (
        items.map((item) => {
          const paused =
              item.executionState === "paused" || item.needsAttention,
            completed = Boolean(item.scopeCompleted),
            active = ["provider", "processing"].includes(item.executionState),
            action = paused
              ? "resume"
              : item.automationEnabled
                ? "stop"
                : "run";
          return (
            <article
              className={`agent-task-card ${paused ? "paused" : completed ? "complete" : active ? "active" : "ready"}`}
              key={item.id}
            >
              <span className="member-avatar">AI</span>
              <div>
                <small>
                  Agent (IM) · {item.id} · {item.projectType}
                </small>
                <b>{item.client}</b>
                <span>{`Project phase: ${item.stage || item.phaseLabel}`}</span>
                <em>{`FrameFlow execution: ${item.executionStatus || "Ready"}`}</em>
                <small className="agent-automation-state">
                  {`Project automation: ${item.automationEnabled ? "Enabled" : "Paused"}`}
                </small>
                {item.needsAttention && item.lastError && (
                  <small className="agent-error">{item.lastError}</small>
                )}
              </div>
              <button
                disabled={working === item.id || completed}
                className={
                  item.automationEnabled && !paused ? "stop-agent" : ""
                }
                onClick={() => command(item.id, action)}
              >
                {working === item.id
                  ? "Updating…"
                  : completed
                    ? "Agent Scope Complete"
                    : paused
                      ? "Resume Project Automation"
                      : item.automationEnabled
                        ? "Pause Project Automation"
                        : "Start Project Automation"}
              </button>
            </article>
          );
        })
      ) : (
        <div className="mini-empty">
          No Agent task is ready. Assign a Tier 4 Agent to an eligible Social
          Project and open the next text phase.
        </div>
      )}
      {message && <p className="integration-message">{message}</p>}
    </section>
  );
}
function Workload({ ps }: { ps: P[] }) {
  const [members, setMembers] = useState<any[]>([]);
  useEffect(() => {
    fetch("/api/members")
      .then((r) => r.json())
      .then((d) =>
        setMembers(
          (d.members || []).filter(
            (m: any) => m.tier > 0 && m.tier < 4 && m.memberKind !== "agent",
          ),
        ),
      );
  }, []);
  const now = Date.now(),
    active = ps.filter(
      (p) => !["Completed", "Paused"].includes(operationalState(p).status),
    );
  return (
    <>
      <section className="welcome workload-intro">
        <div>
          <p className="eyebrow">MANAGEMENT WATCHLIST</p>
          <h2>Human Workload</h2>
          <p>
            See who is idle, what each person owns, and tasks ongoing for 3 days
            without submission.
          </p>
        </div>
      </section>
      <section className="panel page-panel workload-list">
        <div className="panel-head">
          <div>
            <h3>Human Members & Active Assignments</h3>
            <p>{members.length} assignable people</p>
          </div>
        </div>
        {members.map((m) => {
          const jobs = active.filter((p) => {
            try {
              return JSON.parse(p.assignmentMembers || "[]").includes(
                m.email.toLowerCase(),
              );
            } catch {
              return false;
            }
          });
          return (
            <article className={jobs.length ? "" : "idle"} key={m.email}>
              <div className="work-person">
                <span className="member-avatar">
                  {m.name
                    .split(" ")
                    .map((x: string) => x[0])
                    .join("")
                    .slice(0, 2)}
                </span>
                <div>
                  <b>{m.name}</b>
                  <small>
                    Tier {m.tier} · {m.email}
                  </small>
                </div>
              </div>
              <div className="work-jobs">
                {jobs.length ? (
                  jobs.map((p) => {
                    const op = operationalState(p),
                      days = p.assignedAt
                        ? Math.floor(
                            (now - new Date(p.assignedAt).getTime()) / 86400000,
                          )
                        : 0,
                      overdue =
                        op.status === "Needs Attention" ||
                        Boolean(
                          p.assignmentDueAt &&
                          new Date(p.assignmentDueAt).getTime() < now,
                        ),
                      stale = days >= 3 && p.assignmentStatus === "Ongoing";
                    return (
                      <div
                        className={overdue ? "risk" : stale ? "stale" : ""}
                        key={p.id}
                      >
                        <b>
                          {p.client} · {op.phase}
                        </b>
                        <small>
                          {op.status} · {op.reason} · Day {days} · Due{" "}
                          {p.assignmentDueAt || "not set"}
                        </small>
                        {overdue ? (
                          <em>OVERDUE</em>
                        ) : stale ? (
                          <em>3+ DAYS · NOT SUBMITTED</em>
                        ) : null}
                      </div>
                    );
                  })
                ) : (
                  <div className="no-work">
                    <b>No active assignment</b>
                    <small>Available for new work</small>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </section>
      <AgentTaskQueue />
    </>
  );
}
function Assets({ ps, owner }: { ps: P[]; owner: boolean }) {
  const [data, setData] = useState<any>({
      memory: {
        status: "Loading",
        activityRecords: 0,
        approvedRecords: 0,
        publishedRecords: 0,
      },
      outputs: [],
    }),
    [search, setSearch] = useState(""),
    [typeFilter, setTypeFilter] = useState("All"),
    [loading, setLoading] = useState(true);
  const load = () =>
    fetch("/api/assets-library", { cache: "no-store" })
      .then((r) => r.json())
      .then((result) => {
        if (!result.error) setData(result);
      })
      .finally(() => setLoading(false));
  useEffect(() => {
    load();
    const timer = window.setInterval(load, 30000),
      refresh = () => load();
    window.addEventListener("frameflow:refresh", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("frameflow:refresh", refresh);
    };
  }, []);
  const outputs = useMemo(() => {
      const query = search.trim().toLowerCase();
      return (data.outputs || []).filter(
        (item: any) =>
          ACTIVE_PROJECT_TYPES.some((type) => type === item.projectType) &&
          (typeFilter === "All" || item.projectType === typeFilter) &&
          (!query ||
            [
              item.projectName,
              item.projectType,
              item.title,
              item.platform,
              item.status,
            ].some((value) =>
              String(value || "")
                .toLowerCase()
                .includes(query),
            )),
      );
    }, [data.outputs, search, typeFilter]),
    types = Array.from(
      new Set(
        (data.outputs || [])
          .map((item: any) => item.projectType)
          .filter(Boolean),
      ),
    ) as string[],
    formatDate = (value: string) =>
      value
        ? new Intl.DateTimeFormat("en-MY", {
            year: "numeric",
            month: "short",
            day: "2-digit",
          }).format(new Date(value))
        : "—",
    lastUpdated = data.memory?.lastUpdated
      ? new Intl.DateTimeFormat("en-MY", {
          month: "short",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(data.memory.lastUpdated))
      : "Waiting for first record";
  const taskOutputs = outputs.filter((item: any) => item.outputKind !== "post"),
    taskTypes = Array.from(
      new Set(taskOutputs.map((item: any) => item.projectType).filter(Boolean)),
    ) as string[];
  return (
    <div className="assets-library-page">
      <section className="panel asset-memory-strip">
        <div className="memory-live">
          <span />
          <div>
            <small>TRUSTED PRODUCTION MEMORY</small>
            <b>
              {data.memory?.status || "Recording"} · Approved authority only
            </b>
          </div>
        </div>
        <div className="memory-metrics">
          <span>
            <b>{data.memory?.activityRecords || 0}</b> activity events
          </span>
          <span>
            <b>{data.memory?.approvedRecords || 0}</b> approved
          </span>
        </div>
        <small>{`Last update · ${lastUpdated}`}</small>
        <div className="memory-export-links">
          <a href="/api/production-memory" target="_blank">
            Memory Export ↓
          </a>
          <a href="/api/production-history" target="_blank">
            Activity History ↓
          </a>
        </div>
      </section>
      <details className="panel compact-project-files">
        <summary>
          <div>
            <b>Project Files</b>
            <span>
              {ps.length} linked Project folder{ps.length === 1 ? "" : "s"} ·
              compact Drive access
            </span>
          </div>
          <strong>Open list⌄</strong>
        </summary>
        <div className="asset-project-list">
          {ps.map((p) => (
            <div key={p.id}>
              <span className="asset-folder-mark">▰</span>
              <div>
                <b>{p.client}</b>
                <small>
                  {p.id} · {p.projectType || p.type}
                </small>
              </div>
              <em>{p.driveSyncStatus || "Not connected"}</em>
              {owner && p.driveUrl ? (
                <a target="_blank" href={p.driveUrl}>
                  Open Drive ↗
                </a>
              ) : (
                <span>View only</span>
              )}
            </div>
          ))}
        </div>
      </details>
      <section className="panel completed-output-library">
        <header>
          <div>
            <p className="eyebrow">APPROVED TASK FILES</p>
            <h3>Completed Outputs Library</h3>
            <span>
              Only current approved production files are shown here; draft and
              historical delivery records stay out of this view.
            </span>
          </div>
          <b>
            {taskOutputs.length}
            <small>records</small>
          </b>
        </header>
        <div className="output-library-filters task-file-filters">
          <label>
            ⌕
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Project, title or file status"
            />
          </label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option>All</option>
            {taskTypes.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
          <button onClick={load} disabled={loading}>
            {loading ? "Updating…" : "Refresh"}
          </button>
        </div>
        <div className="output-table-wrap">
          <table className="output-library-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Project Type</th>
                <th>Project</th>
                <th>Output Title</th>
                <th>Version</th>
                <th>Task File</th>
              </tr>
            </thead>
            <tbody>
              {taskOutputs.map((item: any) => (
                <tr key={item.id}>
                  <td>{formatDate(item.date)}</td>
                  <td>
                    <span className="output-type">{item.projectType}</span>
                  </td>
                  <td>
                    <b>{item.projectName}</b>
                    <small>{item.projectId}</small>
                  </td>
                  <td>
                    <b>{item.title}</b>
                    <small>{`${item.status}${item.fileCount > 1 ? ` · ${item.fileCount} files` : ""}`}</small>
                  </td>
                  <td>v{item.version || 1}</td>
                  <td>
                    {item.files?.length > 1 ? (
                      <details className="output-file-list">
                        <summary>{`Open all ${item.files.length} files⌄`}</summary>
                        {item.files.map((file: any, index: number) => (
                          <a
                            key={file.id}
                            href={file.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {String(index + 1).padStart(2, "0")} ·{" "}
                            {file.fileName} · v{file.version} ↗
                          </a>
                        ))}
                      </details>
                    ) : item.url ? (
                      <a href={item.url} target="_blank" rel="noreferrer">
                        {item.outputKind === "video"
                          ? "Open video ↗"
                          : "Open file ↗"}
                      </a>
                    ) : (
                      <span className="output-link-missing">File pending</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!taskOutputs.length && (
            <div className="output-library-empty">
              <b>
                {loading
                  ? "Updating task files…"
                  : "No approved task file matches this view"}
              </b>
              <span>
                Drafts, work in progress and historical publishing records are
                intentionally hidden.
              </span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
function calendarDate(value: string, timeZone = "Asia/Kuala_Lumpur") {
  return value
    ? new Intl.DateTimeFormat("en-MY", {
        timeZone,
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date(`${value}T12:00:00Z`))
    : "—";
}
function CalendarBatchLifecycle({ p }: { p: P }) {
  const recurring =
      ["Internal Social Account", "Client Social Account"].includes(
        p.projectType || p.type,
      ) ||
      p.projectMode === "recurring" ||
      p.projectMode === "continuous",
    { current, next } = selectSocialBatchLifecycle(
      (p.batches || []).filter((batch: any) => batch.status !== "Locked"),
    );
  if (!recurring) return null;
  const timeZone = p.projectConfig?.timezone || "Asia/Kuala_Lumpur",
    planningStart = next?.startsAt
      ? (() => {
          const value = new Date(`${next.startsAt}T12:00:00Z`);
          value.setUTCDate(value.getUTCDate() - 6);
          return value.toISOString().slice(0, 10);
        })()
      : "",
    today = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date()),
    agentStatus = !next
      ? "Next Batch not scheduled"
      : next.status === "Planning"
        ? "Planning / Production"
        : today < planningStart
          ? `Scheduled · preparation opens ${calendarDate(planningStart, timeZone)}`
          : today < next.startsAt
            ? "Planning / Production"
            : "Active";
  return (
    <div className="calendar-batch-lifecycle">
      <small className="calendar-batch-timezone">{`DATES · ${timeZone}`}</small>
      <div>
        <small>CURRENT BATCH</small>
        <b>
          {current
            ? `Batch ${String(current.batchNumber).padStart(2, "0")}`
            : "Not scheduled"}
        </b>
        <span>
          {current
            ? `${calendarDate(current.startsAt, timeZone)} → ${calendarDate(current.endsAt, timeZone)} · ${current.status}`
            : "Create the first recurring Batch to start the lifecycle."}
        </span>
      </div>
      <div>
        <small>NEXT BATCH START</small>
        <b>{next ? calendarDate(next.startsAt, timeZone) : "Not scheduled"}</b>
        <span>
          {next
            ? `${calendarDate(next.startsAt, timeZone)} → ${calendarDate(next.endsAt, timeZone)} · ${next.status}`
            : "No future Batch record exists yet."}
        </span>
      </div>
      <div>
        <small>AGENT PREPARATION</small>
        <b>
          {planningStart
            ? calendarDate(planningStart, timeZone)
            : "Waiting for next Batch"}
        </b>
        <span>{agentStatus}</span>
      </div>
    </div>
  );
}
function Calendar({ ps, open }: { ps: P[]; open: (p: P) => void }) {
  const items = ps
    .slice()
    .sort((a, b) =>
      String(a.projectStartDate || a.assignedAt || "").localeCompare(
        String(b.projectStartDate || b.assignedAt || ""),
      ),
    );
  return (
    <section className="panel page-panel project-calendar">
      <div className="panel-head">
        <div>
          <h3>Project Calendar</h3>
          <p>
            Project dates, assigned work and recurring Batch lifecycle in one
            view. Members see only Projects assigned to them.
          </p>
        </div>
        <span className="count">{items.length}</span>
      </div>
      {items.length ? (
        items.map((p) => (
          <button
            className="calendar-project"
            key={p.id}
            onClick={() => open(p)}
          >
            <div className="calendar-date">
              <small>PROJECT</small>
              <b>{p.projectStartDate || "Start TBC"}</b>
              <span>{`to ${p.projectEndDate || "End TBC"}`}</span>
            </div>
            <div className="calendar-info">
              <span>
                {p.id} · {p.projectType || p.type}
              </span>
              <h3>{p.client}</h3>
              <p>
                {p.assignmentStage || p.stage} ·{" "}
                {p.researchAssignee || "Not assigned"}
              </p>
            </div>
            <div className="calendar-task-date">
              <small>TASK ASSIGNED</small>
              <b>
                {p.assignedAt
                  ? new Date(p.assignedAt).toLocaleDateString()
                  : "Not assigned"}
              </b>
              <small>DUE</small>
              <strong>{p.assignmentDueAt || "Not set"}</strong>
            </div>
            <CalendarBatchLifecycle p={p} />
          </button>
        ))
      ) : (
        <div className="mini-empty">No Project dates are available yet.</div>
      )}
    </section>
  );
}
function Members({ ps }: { ps: P[] }) {
  const [members, setMembers] = useState<any[]>([]),
    [msg, setMsg] = useState(""),
    [telegramLogin, setTelegramLogin] = useState<any>({
      ready: false,
      status: "Not configured",
    });
  async function load() {
    const r = await fetch("/api/members");
    if (r.ok) {
      const d = await r.json();
      setMembers(d.members || []);
      setTelegramLogin(
        d.telegramLogin || { ready: false, status: "Not configured" },
      );
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function submitMember(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      r = await fetch("/api/members", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "member",
          name: f.get("name"),
          email: f.get("email"),
          tier: Number(f.get("tier")),
          telegramUsername: f.get("telegramUsername"),
        }),
      }),
      d = await r.json();
    setMsg(
      r.ok
        ? "Member added. Telegram is identity-only until later permissions are designed."
        : d.error,
    );
    if (r.ok) {
      e.currentTarget.reset();
      load();
    }
  }
  async function submitAgent(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      r = await fetch("/api/members", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "agent",
          name: f.get("name"),
          telegramUsername: f.get("telegramUsername"),
          telegramChatId: f.get("telegramChatId"),
          agentLanguage: f.get("agentLanguage"),
          agentStopPhase: f.get("agentStopPhase"),
        }),
      }),
      d = await r.json();
    setMsg(
      r.ok
        ? "Tier 4 Agent profile saved. Connect its Bot from the hidden System Connections."
        : d.error,
    );
    if (r.ok) {
      e.currentTarget.reset();
      load();
    }
  }
  async function remove(email: string) {
    if (
      !confirm(
        `Delete this ${email.startsWith("agent:") ? "Agent" : "Member"} profile?`,
      )
    )
      return;
    const r = await fetch("/api/members", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      }),
      d = await r.json();
    setMsg(r.ok ? "Profile deleted." : d.error);
    if (r.ok) load();
  }
  return (
    <>
      <section className="welcome permission-intro">
        <div>
          <p className="eyebrow">MANAGEMENT CONTROL</p>
          <h2>People & AI Agents</h2>
          <p>
            Human members use Tier 1–3. Tier 4 Agent profiles stay here;
            provider keys and system connections are hidden from normal
            navigation.
          </p>
        </div>
      </section>
      <IntegrationSettings />
      <div className="member-setup-grid">
        <section className="panel member-panel single-member-panel">
          <div className="panel-head">
            <div>
              <h3>Add Human Member</h3>
              <p>
                Email remains the member record. Telegram can be linked for
                login identity only.
              </p>
            </div>
          </div>
          <form className="member-form" onSubmit={submitMember}>
            <div className="form-grid">
              <Field name="name" label="Full name" />
              <Field name="email" label="Member email" type="email" />
              <Field
                name="telegramUsername"
                label="Telegram username"
                placeholder="@username"
              />
            </div>
            <label className="field">
              Permission tier
              <select name="tier" defaultValue="2">
                {tierNames.slice(1, 4).map((n, i) => (
                  <option value={i + 1} key={n}>
                    Tier {i + 1} · {n}
                  </option>
                ))}
              </select>
            </label>
            <button className="create-btn">Add member →</button>
          </form>
        </section>
        <section className="panel member-panel agent-member-panel">
          <div className="panel-head">
            <div>
              <h3>Tier 4 · Add AI Agent</h3>
              <p>
                Create multiple Agent profiles here. Each Agent connects its own
                Bot credential in the hidden settings.
              </p>
            </div>
          </div>
          <form className="member-form" onSubmit={submitAgent}>
            <div className="form-grid">
              <Field
                name="name"
                label="Agent name"
                placeholder="e.g. Agent(IM)"
              />
              <Field
                name="telegramUsername"
                label="Telegram bot username"
                placeholder="@agent_bot"
              />
              <Field
                name="telegramChatId"
                label="Allowed Telegram Chat ID"
                placeholder="Personal or team Chat ID"
              />
              <label className="field">
                Agent language
                <select name="agentLanguage" defaultValue="Bilingual">
                  <option>Bilingual</option>
                  <option>中文</option>
                  <option>English</option>
                </select>
              </label>
            </div>
            <label className="field">
              Current workflow ceiling
              <select
                name="agentStopPhase"
                defaultValue="reel-video-production"
              >
                <option value="reel-video-production">
                  Continue through Social image production
                </option>
              </select>
            </label>
            <button className="create-btn">Save Agent profile →</button>
          </form>
        </section>
      </div>
      {msg && <p className="member-message notice-line">{msg}</p>}
      <section className="panel page-panel">
        <div className="panel-head">
          <div>
            <h3>Members & Agents</h3>
            <p>{`${members.length} ${members.length === 1 ? "profile" : "profiles"} · Telegram Login ${telegramLogin.ready ? "configured" : "pending"}`}</p>
          </div>
        </div>
        {members.map((m) => (
          <div
            className={`member-row ${m.memberKind === "agent" ? "agent-row" : ""}`}
            key={m.email}
          >
            <span className="member-avatar">
              {m.name
                .split(" ")
                .map((x: string) => x[0])
                .join("")
                .slice(0, 2)}
            </span>
            <div>
              <b>{m.name}</b>
              <small>
                {m.memberKind === "agent"
                  ? `${m.telegramUsername || m.email} · Chat ${m.telegramChatId || "not paired"}`
                  : `${m.email}${m.expectedTelegramUsername ? ` · ${m.expectedTelegramUsername}` : ""}`}
              </small>
            </div>
            <strong>
              Tier {m.tier} · {tierNames[m.tier]}
            </strong>
            <span
              className={`access-status ${String(m.status).startsWith("Pending") ? "pending" : ""}`}
            >
              {m.status}
            </span>
            <small>
              {m.memberKind === "agent"
                ? `${m.agentLanguage || "Bilingual"} · Agent connection: ${m.telegramStatus || "Not connected"}`
                : `Telegram Login: ${m.telegramLoginStatus || "Not linked"} · identity only`}
            </small>
            {m.memberKind !== "agent" &&
              telegramLogin.ready &&
              m.expectedTelegramUsername && (
                <a
                  className="telegram-login-link"
                  href={`/api/telegram-login/start?member=${encodeURIComponent(m.email)}`}
                >
                  Link Telegram ↗
                </a>
              )}
            {m.tier !== 0 && (
              <button className="delete-member" onClick={() => remove(m.email)}>
                Delete
              </button>
            )}
          </div>
        ))}
      </section>
    </>
  );
}
function Modal({ children, close }: { children: any; close: () => void }) {
  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={close}>
          ×
        </button>
        {children}
      </div>
    </div>
  );
}
