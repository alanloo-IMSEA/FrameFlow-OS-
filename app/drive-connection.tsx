"use client";

import { useEffect, useRef, useState } from "react";

const LEGAL_SITE = "https://frameflow-legal.alanloo927.chatgpt.site";

function LegalLinks() {
  return (
    <footer className="sidebar-legal-footer">
      <a href={`${LEGAL_SITE}/terms`} target="_blank" rel="noreferrer">Terms of Service</a>
      <a href={`${LEGAL_SITE}/privacy`} target="_blank" rel="noreferrer">Privacy Policy</a>
    </footer>
  );
}

export default function DriveConnection({ owner }: { owner: boolean }) {
  const [s, setS] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [syncFailed,setSyncFailed]=useState(false);
  const autoAttempted = useRef(false);
  const load = () => fetch("/api/google-drive/status").then((r) => r.json()).then(setS).catch(() => setS({ connected: false }));

  useEffect(() => { if (owner) load(); }, [owner]);
  useEffect(() => {
    if (!owner || !s?.connected || autoAttempted.current) return;
    autoAttempted.current = true;
    sync(true);
  }, [owner, s?.connected]);

  async function sync(automatic = false) {
    setBusy(true);
    setSyncFailed(false);
    setMsg(`${automatic ? "Auto sync" : "Sync"} · folders, records, logs and pending uploads…`);
    try {
      const r = await fetch("/api/google-drive/sync-projects", { method: "POST" });
      if(!r.headers.get("content-type")?.includes("application/json"))throw new Error("The sync service did not respond. Saved files are safe; retry the remaining items.");
      const d = await r.json();
      setSyncFailed(!r.ok || d.failed > 0);
      setMsg(r.ok && d.failed === 0 ? "✓ Sync pass complete. More pending items can be synced with the button below." : d.error || `Drive sync incomplete · ${Number(d.failed || 0)} item${Number(d.failed || 0) === 1 ? "" : "s"} failed`);
    } catch (error: any) {
      setSyncFailed(true);
      setMsg(`Drive sync failed · ${error?.message || "connection error"}`);
    }
    await load();
    setBusy(false);
  }

  if (!owner) return <LegalLinks />;
  if (!s) return <><div className="connection"><span className="status-dot"/><div><b>Google Drive</b><small>Checking secure connection…</small></div></div><LegalLinks /></>;

  return <>
    <div className={`connection ${s.connected && !syncFailed ? "online" : ""}`}><span className="status-dot"/><div><b>Google Drive</b><small>{s.connected ? <>Connected · {s.email}<br/>{syncFailed?"Sync needs attention":busy?"Sync in progress":"Drive connected"} · {s.synced || 0}/{s.projects || 0} folders linked</> : s.needsReconnect ? <>Authorization expired · reconnect required<br/>Auto sync paused until reconnection</> : s.configured ? "Ready for owner authorization" : "OAuth configuration required"}</small></div></div>
    {s.connected ? <><a className="connect-btn drive-link" target="_blank" href={s.rootFolderUrl} rel="noreferrer">Open FrameFlow folder ↗</a><button className="connect-btn drive-sync-btn" disabled={busy} onClick={() => sync(false)}>{busy ? "Syncing Drive…" : "Sync records & uploads"}</button>{msg && <small className="drive-sync-message">{msg}</small>}</> : s.configured ? <><a className="connect-btn drive-link" href="/api/google-drive/connect">{s.needsReconnect ? "Reconnect Google Drive →" : "Connect Google Drive →"}</a>{s.connectionError && <small className="drive-sync-message">{s.connectionError}</small>}</> : <button className="connect-btn" disabled>Waiting for secure credentials</button>}
    <LegalLinks />
  </>;
}
