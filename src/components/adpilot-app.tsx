"use client";

import {
  ArrowRight,
  BarChart3,
  Bot,
  Check,
  CheckCircle2,
  ChevronLeft,
  CircleDollarSign,
  ClipboardCheck,
  Database,
  ExternalLink,
  Gauge,
  History,
  BrainCircuit,
  LayoutDashboard,
  Link2,
  LoaderCircle,
  LockKeyhole,
  Megaphone,
  Menu,
  MoreHorizontal,
  PanelLeftClose,
  Play,
  RefreshCw,
  Rocket,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  TriangleAlert,
  Unplug,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import type { AppState, CampaignBrief, CampaignProposal, Finding, Objective, Workspace } from "@/lib/domain";
import type { LiveMetaAudit } from "@/lib/meta/live-audit";
import { CampaignBriefSchema } from "@/lib/domain";
import { approveProposal, audit, executeProposal } from "@/lib/proposal-state";
import { defaultState, readState, writeState } from "@/lib/storage";
import { IntelligenceLab } from "@/components/intelligence-lab";

type View = "overview" | "live-audit" | "intelligence" | "create" | "campaigns" | "connections" | "policies" | "audit";
type CreateStep = "brief" | "generating" | "review" | "success";

const navItems: { view: View; label: string; icon: typeof LayoutDashboard }[] = [
  { view: "overview", label: "Overview", icon: LayoutDashboard },
  { view: "connections", label: "Meta connection", icon: Link2 },
  { view: "live-audit", label: "Live audit", icon: BarChart3 },
  { view: "intelligence", label: "Live intelligence", icon: BrainCircuit },
  { view: "campaigns", label: "Live campaigns", icon: Megaphone },
  { view: "policies", label: "Policies", icon: ShieldCheck },
  { view: "audit", label: "Audit log", icon: History },
];

const emptyBrief = (workspace: Workspace): CampaignBrief => ({
  businessName: workspace.businessName,
  productName: "",
  offerDescription: "",
  objective: "SALES",
  destinationUrl: workspace.websiteUrl || "https://",
  geography: "United States",
  currency: workspace.currency,
  dailyBudget: Math.min(80, workspace.maxDailyBudget),
  durationDays: 14,
  audienceHint: "",
  brandVoice: "Clear, confident, and warm",
  extraInstructions: "",
});

export function AdPilotApp() {
  const [state, setState] = useState<AppState>(defaultState);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [liveAuditAccount, setLiveAuditAccount] = useState<MetaAccountSummary>();

  useEffect(() => {
    setState(readState());
    const requestedView = new URLSearchParams(window.location.search).get("view");
    if (requestedView && navItems.some((item) => item.view === requestedView)) setView(requestedView as View);
    try {
      const savedAccount = window.localStorage.getItem("adpilot-meta-account");
      if (savedAccount) setLiveAuditAccount(JSON.parse(savedAccount) as MetaAccountSummary);
    } catch {
      window.localStorage.removeItem("adpilot-meta-account");
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) writeState(state);
  }, [ready, state]);

  function updateState(updater: (current: AppState) => AppState) {
    setState((current) => updater(current));
  }

  function openProposal() {
    setView("campaigns");
  }

  function openLiveAudit(account: MetaAccountSummary) {
    setLiveAuditAccount(account);
    window.localStorage.setItem("adpilot-meta-account", JSON.stringify(account));
    setView("live-audit");
  }

  if (!ready) return <div className="boot"><LoaderCircle className="spin" /> Loading control center…</div>;

  return (
    <div className={`app-shell ${sidebarOpen ? "" : "sidebar-collapsed"}`}>
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="brand-row">
          <div className="brand-mark"><Sparkles size={18} /></div>
          <div className="brand-copy"><strong>AdPilot</strong><span>AI control center</span></div>
          <button className="icon-button sidebar-toggle" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar"><PanelLeftClose size={18} /></button>
        </div>
        <nav className="primary-nav">
          <span className="nav-kicker">Workspace</span>
          {navItems.map((item) => (
            <button key={item.view} className={view === item.view ? "active" : ""} onClick={() => setView(item.view)}>
              <item.icon size={18} /><span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="simulation-chip"><span className="live-dot" /> Read-only live Meta</div>
          <div className="account-card">
            <div className="avatar">{state.workspace.businessName ? state.workspace.businessName.slice(0, 2).toUpperCase() : "AP"}</div>
            <div><strong>{state.workspace.businessName || "Your workspace"}</strong><span>Prototype owner</span></div>
            <MoreHorizontal size={17} />
          </div>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <button className="icon-button menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <div className="topbar-status"><ShieldCheck size={16} /> Guardrails active</div>
          <div className="topbar-actions">
            <span className="mode-label">No real spend</span>
            <button className="avatar small">{state.workspace.businessName ? state.workspace.businessName.slice(0, 2).toUpperCase() : "AP"}</button>
          </div>
        </header>

        <main>
          {view === "overview" && <Overview account={liveAuditAccount} setView={setView} />}
          {view === "live-audit" && <LiveAuditView account={liveAuditAccount} onChooseAccount={() => setView("connections")} onNavigate={setView} />}
          {view === "intelligence" && <IntelligenceLab account={liveAuditAccount} onChooseAccount={() => setView("connections")} />}
          {view === "create" && <CreateCampaign state={state} updateState={updateState} setView={setView} openProposal={openProposal} />}
          {view === "campaigns" && <LiveCampaignsView account={liveAuditAccount} onChooseAccount={() => setView("connections")} />}
          {view === "connections" && <Connections state={state} updateState={updateState} onRunAudit={openLiveAudit} />}
          {view === "policies" && <Policies state={state} updateState={updateState} />}
          {view === "audit" && <AuditLog events={state.auditEvents} />}
        </main>
      </div>
    </div>
  );
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="page-heading"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1><p>{description}</p></div>{action}</div>;
}

function Overview({ account, setView }: { account?: MetaAccountSummary; setView: (view: View) => void }) {
  return <div className="page">
    <PageHeading eyebrow="Live Meta command center" title={account ? account.name : "Connect a Meta ad account"} description={account ? `Account ${account.id} is the source for every reporting and intelligence screen.` : "Choose the real ad account that AdPilot should read. No demo campaign data is shown."} action={<button className="button primary" onClick={() => setView(account ? "live-audit" : "connections")}>{account ? <BarChart3 size={17} /> : <Link2 size={17} />}{account ? "Run live audit" : "Connect Meta"}</button>} />

    <section className="stat-grid">
      <StatCard icon={Link2} label="Meta account" value={account ? "Connected" : "Needed"} detail={account?.name || "Select an account to continue"} tone="green" />
      <StatCard icon={Database} label="Data source" value={account ? "Live" : "None"} detail="Meta Ads MCP reporting" tone="violet" />
      <StatCard icon={History} label="Reporting window" value="60 days" detail="Refreshed from Meta on demand" tone="amber" />
      <StatCard icon={ShieldCheck} label="Access mode" value="Read only" detail="No campaigns or spend can be changed" tone="blue" />
    </section>

    <div className="overview-grid">
      <section className="panel campaign-panel">
        <div className="panel-header"><div><span className="eyebrow">Live workflow</span><h2>Inspect the selected account</h2></div><span className="live-data-badge">LIVE META DATA</span></div>
        <div className="campaign-list">
          <button className="campaign-row" onClick={() => setView("live-audit")}><div className="campaign-icon"><BarChart3 size={18} /></div><div className="campaign-main"><strong>Account audit</strong><span>Spend, opportunity score, recommendations, and delivery issues</span></div><ArrowRight size={16} className="muted-icon" /></button>
          <button className="campaign-row" onClick={() => setView("intelligence")}><div className="campaign-icon"><BrainCircuit size={18} /></div><div className="campaign-main"><strong>Campaign intelligence</strong><span>Real campaign outcomes, deterministic tiers, and winner evidence</span></div><ArrowRight size={16} className="muted-icon" /></button>
          <button className="campaign-row" onClick={() => setView("campaigns")}><div className="campaign-icon"><Megaphone size={18} /></div><div className="campaign-main"><strong>All live campaigns</strong><span>Search the campaigns returned by the selected Meta account</span></div><ArrowRight size={16} className="muted-icon" /></button>
        </div>
      </section>

      <aside className="panel readiness-panel">
        <span className="eyebrow">Data trust</span><h2>What this prototype guarantees</h2>
        <div className="readiness-ring"><div><strong>{account ? "3/3" : "2/3"}</strong><span>checks ready</span></div></div>
        <ReadinessRow done={Boolean(account)} label="Selected Meta account" />
        <ReadinessRow done label="No fixture fallback" />
        <ReadinessRow done label="Read-only tool allowlist" />
        {!account && <button className="button secondary full" onClick={() => setView("connections")}>Choose account</button>}
      </aside>
    </div>
  </div>;
}

function StatCard({ icon: Icon, label, value, detail, tone }: { icon: typeof Megaphone; label: string; value: string; detail: string; tone: string }) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={19} /></div><div className="stat-top"><span>{label}</span></div><strong>{value}</strong><p>{detail}</p></div>;
}

function ReadinessRow({ done, label }: { done: boolean; label: string }) {
  return <div className="readiness-row"><span className={done ? "done" : "pending"}>{done ? <Check size={13} /> : <span />}</span><span>{label}</span><small>{done ? "Ready" : "Needed"}</small></div>;
}

type MetaAccountSummary = {
  id: string;
  name: string;
  status?: string;
  currency?: string;
  timezone?: string;
  isMcpEnabled?: boolean;
  isQueryable?: boolean;
};

type MetaConnectionStatus = {
  state: "LOADING" | "CONFIGURATION_REQUIRED" | "READY_TO_CONNECT" | "CONNECTED" | "AUTHENTICATION_EXPIRED" | "PROVIDER_UNAVAILABLE";
  appId?: string;
  redirectUri?: string;
  missing?: string[];
  accounts?: MetaAccountSummary[];
  message?: string;
};

function MetaLiveConnection({ onRunAudit }: { onRunAudit: (account: MetaAccountSummary) => void }) {
  const [status, setStatus] = useState<MetaConnectionStatus>({ state: "LOADING" });
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [disconnecting, setDisconnecting] = useState(false);
  const [showPicker, setShowPicker] = useState(true);
  const [accountSearch, setAccountSearch] = useState("");

  async function loadStatus() {
    setStatus((current) => ({ ...current, state: "LOADING" }));
    try {
      const response = await fetch("/api/meta/status", { cache: "no-store" });
      const body = (await response.json()) as MetaConnectionStatus;
      setStatus(body);
      if (body.state === "CONNECTED") {
        const saved = window.localStorage.getItem("adpilot-meta-account-id") || "";
        if (body.accounts?.some((account) => account.id === saved)) {
          setSelectedAccountId(saved);
          setShowPicker(false);
        }
      }
    } catch {
      setStatus({ state: "PROVIDER_UNAVAILABLE", message: "AdPilot could not read the local connection status." });
    }
  }

  useEffect(() => {
    void loadStatus();
  }, []);

  function selectAccount(account: MetaAccountSummary) {
    setSelectedAccountId(account.id);
    setShowPicker(false);
    window.localStorage.setItem("adpilot-meta-account-id", account.id);
    window.localStorage.setItem("adpilot-meta-account", JSON.stringify(account));
  }

  async function disconnect() {
    setDisconnecting(true);
    try {
      await fetch("/api/meta/disconnect", { method: "POST" });
      window.localStorage.removeItem("adpilot-meta-account-id");
      window.localStorage.removeItem("adpilot-meta-account");
      setSelectedAccountId("");
      await loadStatus();
    } finally {
      setDisconnecting(false);
    }
  }

  const callbackNotice = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("meta");
  const accounts = status.accounts ?? [];
  const selectedAccount = accounts.find((account) => account.id === selectedAccountId);
  const normalizedSearch = accountSearch.trim().toLowerCase();
  const filteredAccounts = accounts.filter((account) => !normalizedSearch || account.id.includes(normalizedSearch) || account.name.toLowerCase().includes(normalizedSearch));

  return <section className={`connection-card live-meta-card ${status.state === "CONNECTED" ? "connected" : ""}`}>
    <div className="meta-logo">f</div>
    <div className="connection-copy live-connection-copy">
      <div><h3>Meta Ads MCP</h3>{status.state === "CONNECTED" ? <span className="connected-label"><CheckCircle2 size={14} /> Live connection</span> : <span className="soon-label">Read-only V1</span>}</div>
      <p>First-party Meta reporting connection for account audits, opportunity score, performance trends, and delivery errors.</p>
      <div className="capability-row"><span>Live reporting</span><span>Account selector</span><span>Write tools blocked</span></div>

      {callbackNotice === "cancelled" && <div className="connection-message warning"><TriangleAlert size={15} /> Meta connection was cancelled. Nothing was saved.</div>}
      {callbackNotice === "invalid_state" && <div className="connection-message error"><TriangleAlert size={15} /> The sign-in response could not be verified. Please start again.</div>}
      {callbackNotice === "exchange_failed" && <div className="connection-message error"><TriangleAlert size={15} /> Meta did not complete the token exchange. Check the callback and app settings.</div>}

      {status.state === "LOADING" && <div className="connection-message"><LoaderCircle className="spin" size={15} /> Checking the server connection…</div>}

      {status.state === "CONFIGURATION_REQUIRED" && <div className="connection-setup-box">
        <strong>One local setting remains</strong>
        <p>Add <code>{status.missing?.join(", ")}</code> to <code>.env.local</code>, then restart the development server. Never paste the secret into the browser.</p>
        <dl><div><dt>App ID</dt><dd>{status.appId}</dd></div><div><dt>OAuth callback</dt><dd>{status.redirectUri}</dd></div></dl>
      </div>}

      {(status.state === "AUTHENTICATION_EXPIRED" || status.state === "PROVIDER_UNAVAILABLE") && <div className="connection-message error"><TriangleAlert size={15} /> {status.message || "The Meta connection is unavailable."}</div>}

      {status.state === "CONNECTED" && <div className="account-picker">
        <div className="account-picker-heading"><strong>Live audit account</strong><span>{accounts.length} available</span></div>
        {selectedAccount && !showPicker ? <div className="selected-account-card">
          <div><span className="live-data-badge">LIVE</span><strong>{selectedAccount.name}</strong><small>{selectedAccount.id}{selectedAccount.currency ? ` · ${selectedAccount.currency}` : ""}{selectedAccount.timezone ? ` · ${selectedAccount.timezone}` : ""}</small></div>
          <button className="text-button" onClick={() => setShowPicker(true)}>Change account</button>
          <button className="button primary" onClick={() => onRunAudit(selectedAccount)}>Run 60-day audit <ArrowRight size={15} /></button>
        </div> : <>
          <input className="account-search" value={accountSearch} onChange={(event) => setAccountSearch(event.target.value)} placeholder="Search account name or ID" />
          {accounts.length === 0 ? <p>Meta returned no accessible ad accounts for this login.</p> : filteredAccounts.length === 0 ? <p>No accounts match that search.</p> : <div className="account-options compact">{filteredAccounts.map((account) => <label key={account.id} className={selectedAccountId === account.id ? "selected" : ""}>
            <input type="radio" name="meta-account" checked={selectedAccountId === account.id} onChange={() => selectAccount(account)} />
            <span><strong>{account.name}</strong><small>{account.id}{account.currency ? ` · ${account.currency}` : ""}{account.isMcpEnabled === false ? " · MCP unavailable" : ""}</small></span>
          </label>)}</div>}
        </>}
      </div>}
    </div>

    <div className="connection-actions">
      {status.state === "READY_TO_CONNECT" && <a className="button primary" href="/api/meta/connect"><Link2 size={16} /> Connect Meta</a>}
      {(status.state === "AUTHENTICATION_EXPIRED" || status.state === "PROVIDER_UNAVAILABLE") && <a className="button primary" href="/api/meta/connect"><Link2 size={16} /> Reconnect</a>}
      {status.state === "CONNECTED" && <button className="button danger-ghost" disabled={disconnecting} onClick={() => void disconnect()}>{disconnecting ? <LoaderCircle className="spin" size={16} /> : <Unplug size={16} />} Disconnect</button>}
    </div>
  </section>;
}

function Connections({ state, updateState, onRunAudit }: { state: AppState; updateState: (fn: (s: AppState) => AppState) => void; onRunAudit: (account: MetaAccountSummary) => void }) {
  const [showSetup, setShowSetup] = useState(!state.workspace.businessName);
  const [form, setForm] = useState(state.workspace);

  function saveBusiness(e: FormEvent) {
    e.preventDefault();
    updateState((current) => ({ ...current, workspace: form, auditEvents: [audit("workspace.updated", "Business profile and workspace defaults updated."), ...current.auditEvents] }));
    setShowSetup(false);
  }

  return <div className="page narrow-page">
    <PageHeading eyebrow="Live data source" title="Meta connection" description="Choose the real ad account used by every reporting and intelligence screen." action={<button className="button secondary" onClick={() => setShowSetup(!showSetup)}><Settings size={16} /> Business profile</button>} />
    {showSetup && <form className="panel form-panel business-form" onSubmit={saveBusiness}>
      <div className="panel-header"><div><span className="eyebrow">Workspace context</span><h2>Tell the agent about your business</h2></div></div>
      <div className="form-grid two">
        <Field label="Business name"><input required value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} placeholder="e.g. Pizza restaurant group" /></Field>
        <Field label="Website"><input required type="url" value={form.websiteUrl} onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })} placeholder="https://example.com" /></Field>
        <Field label="Business category"><input required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Ecommerce" /></Field>
        <Field label="Account currency"><select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}><option>USD</option><option>GBP</option><option>EUR</option><option>PKR</option><option>AED</option></select></Field>
        <Field label="Timezone"><select value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}><option>Asia/Karachi</option><option>America/New_York</option><option>Europe/London</option><option>Asia/Dubai</option></select></Field>
        <Field label="Maximum daily budget"><div className="input-prefix"><span>{form.currency}</span><input required type="number" min="1" value={form.maxDailyBudget} onChange={(e) => setForm({ ...form, maxDailyBudget: Number(e.target.value) })} /></div></Field>
      </div>
      <div className="form-actions"><button className="button primary" type="submit">Save business profile</button></div>
    </form>}

    <div className="connection-intro"><h2>Advertising platforms</h2><p>Connectors expose platform capabilities to your agent through one controlled interface.</p></div>
    <MetaLiveConnection onRunAudit={onRunAudit} />
    <section className="connection-card muted-card"><div className="google-logo">G</div><div className="connection-copy"><div><h3>Google Ads</h3><span className="soon-label">Coming next</span></div><p>Search, Performance Max, and cross-platform measurement.</p></div><button className="button secondary" disabled>Not available</button></section>
    <div className="security-note"><LockKeyhole size={18} /><div><strong>Built around least privilege</strong><p>Meta tokens stay behind the server session and are unavailable to browser code and the model. The live V1 exposes reporting tools only.</p></div></div>
  </div>;
}

function LiveAuditView({ account, onChooseAccount, onNavigate }: { account?: MetaAccountSummary; onChooseAccount: () => void; onNavigate: (view: View) => void }) {
  const [audit, setAudit] = useState<LiveMetaAudit>();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  async function runAudit() {
    if (!account) return;
    setRunning(true);
    setError("");
    setAudit(undefined);
    try {
      const response = await fetch("/api/meta/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: account.id }),
      });
      const body = (await response.json()) as { audit?: LiveMetaAudit; message?: string; error?: string };
      if (!response.ok || !body.audit) throw new Error(body.message || body.error || "The live audit could not run.");
      if (body.audit.accountId !== account.id) throw new Error("Meta returned data for a different ad account. Please reconnect and try again.");
      setAudit(body.audit);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The live audit could not run.");
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    if (account) void runAudit();
  // The audit should run once when the explicitly selected account changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.id]);

  if (!account) return <div className="page narrow-page"><PageHeading eyebrow="Live Meta data" title="Choose an account first" description="Select the Meta ad account that should supply the 60-day audit." /><div className="panel empty-live-audit"><BarChart3 size={28} /><h2>No live account selected</h2><p>Connections controls exactly which account the audit may read.</p><button className="button primary" onClick={onChooseAccount}>Choose account</button></div></div>;

  if (running) return <div className="page narrow-page"><button className="back-button" onClick={onChooseAccount}><ChevronLeft size={15} /> Account selection</button><div className="live-audit-loading"><div className="agent-core"><BarChart3 size={28} /></div><span className="live-data-badge">LIVE META DATA</span><h1>Auditing {account.name}</h1><p>Reading the previous 60 days without changing campaigns or spend.</p><div className="generation-steps"><span className="active"><LoaderCircle className="spin" size={13} /> Campaigns</span><span>Opportunity score</span><span>Delivery errors</span><span>Trends</span></div></div></div>;

  if (error) return <div className="page narrow-page"><button className="back-button" onClick={onChooseAccount}><ChevronLeft size={15} /> Account selection</button><div className="panel live-audit-error"><TriangleAlert size={28} /><h2>Live audit needs attention</h2><p>{error}</p><div><button className="button primary" onClick={() => void runAudit()}>Try again</button><button className="button secondary" onClick={onChooseAccount}>Check connection</button></div></div></div>;

  if (!audit) return null;
  const allCampaigns = audit.campaigns.status === "ok" ? audit.campaigns.data : [];
  const campaigns = allCampaigns.slice(0, 5);
  const totalSpend = campaigns.reduce((sum, campaign) => sum + (campaign.spend ?? 0), 0);
  const opportunityScore = audit.opportunity.status === "ok" ? audit.opportunity.data.score : undefined;
  const deliveryErrors = audit.errors.status === "ok" ? audit.errors.data.count : undefined;

  return <div className="page live-audit-page">
    <button className="back-button" onClick={onChooseAccount}><ChevronLeft size={15} /> Change account</button>
    <PageHeading eyebrow="Live Meta audit" title={account.name} description={`Account ${account.id} · ${audit.window.since} to ${audit.window.until} · retrieved ${new Date(audit.retrievedAt).toLocaleString()}`} action={<div className="live-heading-actions"><span className="live-data-badge">LIVE META DATA</span><button className="button secondary" onClick={() => void runAudit()}>Run again</button></div>} />

    <section className="stat-grid live-stat-grid">
      <StatCard icon={Megaphone} label="Top campaigns" value={String(campaigns.length)} detail="Ranked by Meta-reported spend" tone="violet" />
      <StatCard icon={CircleDollarSign} label="Top-five spend" value={formatMoney(totalSpend, account.currency)} detail="Only returned campaigns" tone="green" />
      <StatCard icon={Gauge} label="Opportunity score" value={opportunityScore === undefined ? "N/A" : `${opportunityScore}/100`} detail={audit.opportunity.status === "ok" ? "Current Meta score" : "Unavailable for this account"} tone="amber" />
      <StatCard icon={ShieldCheck} label="Delivery issues" value={deliveryErrors === undefined ? "N/A" : String(deliveryErrors)} detail={audit.errors.status === "ok" ? "Meta-reported account issues" : "Unavailable for this account"} tone="blue" />
    </section>

    <section className="panel live-campaign-table">
      <div className="panel-header"><div><span className="eyebrow">Where the money went</span><h2>Highest-spending campaigns</h2></div><span className="source-pill">60 days · Meta MCP</span></div>
      {audit.campaigns.status === "unavailable" ? <UnavailableSection message={audit.campaigns.message} /> : campaigns.length === 0 ? <NotEnoughData /> : <div className="table-scroll"><table><thead><tr><th>Campaign</th><th>Objective</th><th>Spend</th><th>Impressions</th><th>CTR</th><th>CPC</th><th>CPM</th></tr></thead><tbody>{campaigns.map((campaign) => <tr key={campaign.id}><td><strong>{campaign.name}</strong><small>{campaign.id}</small></td><td>{campaign.objective || "Not returned"}</td><td>{formatMoney(campaign.spend, account.currency)}</td><td>{formatMetric(campaign.impressions)}</td><td>{formatPercent(campaign.ctr)}</td><td>{formatMoney(campaign.cpc, account.currency)}</td><td>{formatMoney(campaign.cpm, account.currency)}</td></tr>)}</tbody></table></div>}
    </section>

    <div className="live-audit-grid">
      <LiveEvidenceCard title="Meta recommendations" eyebrow="Opportunity score" section={audit.opportunity} emptyText="Meta returned no opportunity recommendations." />
      <LiveEvidenceCard title="Delivery issues" eyebrow="Errors" section={audit.errors} emptyText="Meta returned no delivery issues." />
    </div>
    <LiveEvidenceCard title="Recent performance movement" eyebrow="Trend signal" section={audit.trend} emptyText="Meta returned no performance trend for this account." wide />

    <section className="panel live-next-steps">
      <div><span className="eyebrow">What to inspect next</span><h2>The live account read is complete.</h2><p>Continue into live campaign scoring or inspect every campaign returned by this same Meta account. All surfaces remain read-only.</p></div>
      <div className="live-next-actions">
        <button className="button primary" onClick={() => onNavigate("intelligence")}><BrainCircuit size={16} /> Open live intelligence <span>LIVE</span></button>
        <button className="button secondary" onClick={() => onNavigate("campaigns")}><Megaphone size={16} /> View all live campaigns</button>
        <button className="text-button" onClick={onChooseAccount}>Choose another live account <ArrowRight size={15} /></button>
      </div>
    </section>

    <details className="panel raw-evidence"><summary>Developer evidence</summary><p>Provider payloads are shown for validation. Tokens and authorization headers are never included.</p><pre>{JSON.stringify({ campaigns: audit.campaigns, opportunity: audit.opportunity, errors: audit.errors, trend: audit.trend }, null, 2)}</pre></details>
  </div>;
}

function LiveCampaignsView({ account, onChooseAccount }: { account?: MetaAccountSummary; onChooseAccount: () => void }) {
  const [audit, setAudit] = useState<LiveMetaAudit>();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  async function loadCampaigns() {
    if (!account) return;
    setRunning(true);
    setError("");
    setAudit(undefined);
    try {
      const response = await fetch("/api/meta/audit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accountId: account.id }) });
      const body = await response.json() as { audit?: LiveMetaAudit; message?: string; error?: string };
      if (!response.ok || !body.audit) throw new Error(body.message || body.error || "Live campaigns are unavailable.");
      if (body.audit.accountId !== account.id) throw new Error("Meta returned data for a different ad account. Please reconnect and try again.");
      setAudit(body.audit);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Live campaigns are unavailable.");
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    if (account) void loadCampaigns();
  // Refresh when the explicitly selected account changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.id]);

  if (!account) return <div className="page"><div className="panel empty-live-audit"><Megaphone size={28} /><h2>Select a live Meta account</h2><p>Campaigns never fall back to local demo records.</p><button className="button primary" onClick={onChooseAccount}>Choose account</button></div></div>;
  if (running) return <div className="page"><div className="live-audit-loading"><LoaderCircle className="spin" size={30} /><span className="live-data-badge">LIVE META DATA</span><h1>Reading campaigns for {account.name}</h1></div></div>;
  if (error) return <div className="page"><div className="panel live-audit-error"><TriangleAlert size={28} /><h2>Live campaigns need attention</h2><p>{error}</p><button className="button primary" onClick={() => void loadCampaigns()}>Try again</button></div></div>;
  const campaigns = audit?.campaigns.status === "ok" ? audit.campaigns.data : [];
  const query = search.trim().toLowerCase();
  const visible = campaigns.filter((campaign) => !query || campaign.name.toLowerCase().includes(query) || campaign.id.includes(query));

  return <div className="page live-audit-page">
    <PageHeading eyebrow="Live Meta campaigns" title={account.name} description={`${campaigns.length} campaigns returned for the ${audit?.window.days || 60}-day reporting window.`} action={<div className="live-heading-actions"><span className="live-data-badge">LIVE META DATA</span><button className="button secondary" disabled={running} onClick={() => void loadCampaigns()}>{running ? <LoaderCircle className="spin" size={15} /> : <RefreshCw size={15} />} Refresh</button></div>} />
    <section className="panel live-campaign-table">
      <div className="panel-header"><div><span className="eyebrow">Selected account only</span><h2>All campaign performance</h2></div><input className="account-search live-campaign-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search campaign name or ID" /></div>
      {audit?.campaigns.status === "unavailable" ? <UnavailableSection message={audit.campaigns.message} /> : visible.length === 0 ? <NotEnoughData /> : <div className="table-scroll"><table><thead><tr><th>Campaign</th><th>Status</th><th>Objective</th><th>Spend</th><th>Results</th><th>ROAS</th><th>Frequency</th></tr></thead><tbody>{visible.map((campaign) => <tr key={campaign.id}><td><strong>{campaign.name}</strong><small>{campaign.id}</small></td><td>{campaign.status || "Not returned"}</td><td>{campaign.objective || "Not returned"}</td><td>{formatMoney(campaign.spend, account.currency)}</td><td>{formatMetric(campaign.purchases ?? campaign.results)}</td><td>{campaign.purchaseRoas === undefined ? "N/A" : `${campaign.purchaseRoas.toFixed(2)}×`}</td><td>{formatMetric(campaign.frequency)}</td></tr>)}</tbody></table></div>}
    </section>
  </div>;
}

function LiveEvidenceCard({ title, eyebrow, section, emptyText, wide = false }: { title: string; eyebrow: string; section: { status: "ok"; data: unknown } | { status: "unavailable"; message: string }; emptyText: string; wide?: boolean }) {
  if (section.status === "unavailable") return <section className={`panel live-evidence-card ${wide ? "wide" : ""}`}><span className="eyebrow">{eyebrow}</span><h2>{title}</h2><UnavailableSection message={section.message} /></section>;
  const items = extractEvidenceItems(section.data);
  const grouped = groupEvidenceItems(items);
  return <section className={`panel live-evidence-card ${wide ? "wide" : ""}`}><span className="eyebrow">{eyebrow}</span><h2>{title}</h2>{grouped.length === 0 ? <p className="empty-evidence">{emptyText}</p> : <div className="evidence-list">{grouped.slice(0, 6).map((item, index) => <div key={`${title}-${index}`}><strong>{item.title}{item.count > 1 ? <span className="evidence-count">{item.count} affected</span> : null}</strong><small>{item.detail}</small></div>)}</div>}</section>;
}

function groupEvidenceItems(items: unknown[]) {
  const grouped = new Map<string, { title: string; detail: string; count: number }>();
  for (const item of items) {
    const title = summarizeEvidence(item);
    const detail = detailEvidence(item);
    const key = `${title}\n${detail}`;
    const current = grouped.get(key);
    if (current) current.count += 1;
    else grouped.set(key, { title, detail, count: 1 });
  }
  return [...grouped.values()];
}

function UnavailableSection({ message }: { message: string }) {
  return <div className="unavailable-section"><TriangleAlert size={17} /><div><strong>Unavailable</strong><p>{message}</p></div></div>;
}

function NotEnoughData() {
  return <div className="not-enough-data"><BarChart3 size={22} /><strong>Not enough data</strong><p>Meta returned no campaign rows for this 60-day window.</p></div>;
}

function extractEvidenceItems(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return value === undefined ? [] : [value];
  const record = value as Record<string, unknown>;
  for (const key of ["recommendations", "items", "errors", "data", "results", "trends", "series"]) if (Array.isArray(record[key])) return record[key] as unknown[];
  return Object.keys(record).length ? [record] : [];
}

function summarizeEvidence(value: unknown) {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (!value || typeof value !== "object") return "Meta evidence";
  const record = value as Record<string, unknown>;
  if (typeof record.error_message === "string") return "Delivery issue";
  if (typeof record.type === "string") {
    const labels: Record<string, string> = {
      partnership_ads: "Partnership ads",
      reels_pc_recommendation: "Use Reels-ready creative",
      capi_event_coverage: "Improve Conversions API coverage",
    };
    if (labels[record.type]) return labels[record.type];
  }
  for (const key of ["title", "name", "recommendation", "message", "result", "metric", "type"]) {
    const candidate = record[key];
    if (typeof candidate === "string" || typeof candidate === "number") return humanizeEvidenceLabel(String(candidate));
  }
  return "Meta evidence";
}

function detailEvidence(value: unknown) {
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  if (typeof record.error_message === "string") return normalizeMetaError(record.error_message);
  const recommendation = record.recommendation_content;
  if (recommendation && typeof recommendation === "object") {
    const content = recommendation as Record<string, unknown>;
    const body = typeof content.body === "string" ? content.body : "";
    const lift = typeof content.lift_estimate === "string" ? content.lift_estimate : "";
    const points = typeof content.opportunity_score_lift === "string" || typeof content.opportunity_score_lift === "number" ? String(content.opportunity_score_lift) : "";
    const normalized = normalizeMetaRecommendation(String(record.type || ""), body, lift);
    return [normalized, points ? `Opportunity score: +${points} points` : ""].filter(Boolean).join(" · ");
  }
  for (const key of ["description", "detail", "reason", "status", "value", "score"]) {
    const candidate = record[key];
    if (typeof candidate === "string" || typeof candidate === "number") return String(candidate);
  }
  return JSON.stringify(value).slice(0, 180);
}

function normalizeMetaRecommendation(type: string, body: string, lift: string) {
  const percent = extractPercent(lift);
  const impact = percent ? ` Meta estimates up to ${percent}% lower cost per result.` : "";
  if (type === "reels_pc_recommendation") return `Use full-screen vertical 9:16 video with audio in Reels placements.${impact}`;
  if (type === "capi_event_coverage") return `Send a larger share of Purchase events through the Conversions API to improve measurement and optimization.${impact}`;
  if (type === "partnership_ads") return `Test an eligible partnership ad that combines signals from the advertiser and creator or partner.${impact}`;
  if (containsUrdu(body) || containsUrdu(lift)) return "Meta returned localized guidance. The exact provider wording is available under Developer evidence.";
  return [body, lift ? `Estimated benefit: ${lift}` : ""].filter(Boolean).join(" · ");
}

function normalizeMetaError(message: string) {
  if (message.includes("191x100") && message.includes("100x100")) return "An image ad uses the deprecated 191x100 crop. Replace it with the recommended 100x100 crop before the next Marketing API version.";
  if (/owned by a different page/i.test(message)) return "The ad references a post owned by a different Facebook Page. Correct the Post/Page ID before republishing.";
  if (message.includes("2446429") || /Instagram.*format/i.test(message)) return "Instagram placement validation failed for this creative format. Review the creative and republish after correcting the format.";
  if (message.includes("ڈیلیور نہیں ہو رہا")) return "The ad is not delivering. Review the affected ad set's settings and create a corrected version before republishing.";
  if (message.includes("پراسیسنگ") || message.includes("پراسس")) return "Meta could not process the ad. Try republishing it; contact Meta support if the problem continues.";
  if (message.includes("نا مکمل") || /missing fields/i.test(message)) return "The ad is incomplete because one or more required fields are missing.";
  if (message.includes("حد پوری") || /ad limit/i.test(message)) return "The Facebook Page has reached its ad limit. Reduce the number of running ads before activating another one.";
  if (containsUrdu(message)) return "Meta returned this delivery issue in the account language. Open Developer evidence for the exact provider wording.";
  return message;
}

function extractPercent(value: string) {
  const match = value.match(/(\d+(?:\.\d+)?)\s*%|%(\d+(?:\.\d+)?)/);
  return match?.[1] || match?.[2];
}

function containsUrdu(value: string) {
  return /[\u0600-\u06ff]/.test(value);
}

function humanizeEvidenceLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatMoney(value?: number, currency = "USD") {
  if (value === undefined) return "N/A";
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value); } catch { return `${currency} ${value.toFixed(2)}`; }
}

function formatMetric(value?: number) {
  return value === undefined ? "N/A" : new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function formatPercent(value?: number) {
  return value === undefined ? "N/A" : `${value.toFixed(2)}%`;
}

async function requestProposal(action: "generate" | "validate", brief: CampaignBrief, workspace: Workspace) {
  const response = await fetch("/api/simulator/proposal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, brief, workspace }) });
  const body = await response.json() as { proposal?: CampaignProposal; findings?: Finding[]; message?: string };
  if (!response.ok) throw new Error(body.message || "The campaign planner is unavailable.");
  return body;
}

function Policies({ state, updateState }: { state: AppState; updateState: (fn: (s: AppState) => AppState) => void }) {
  const [limit, setLimit] = useState(state.workspace.maxDailyBudget);
  const [saved, setSaved] = useState(false);
  async function save(e: FormEvent) {
    e.preventDefault();
    const workspace = { ...state.workspace, maxDailyBudget: limit };
    const proposals = await Promise.all(state.proposals.map(async (proposal) => ({ ...proposal, findings: (await requestProposal("validate", proposal.brief, workspace)).findings ?? proposal.findings })));
    updateState((current) => ({ ...current, workspace, proposals, auditEvents: [audit("policy.updated", `Maximum daily budget changed to ${current.workspace.currency} ${limit}.`), ...current.auditEvents] }));
    setSaved(true); setTimeout(() => setSaved(false), 2500);
  }
  return <div className="page narrow-page"><PageHeading eyebrow="Guardrails" title="Policies" description="Hard rules are enforced in code. The agent cannot override them." />
    <form className="panel policy-card" onSubmit={save}>
      <div className="policy-header"><div className="stat-icon green"><CircleDollarSign size={20} /></div><div><h2>Spend controls</h2><p>Caps apply to every proposal and are checked again before execution.</p></div><span className="active-pill"><span /> Active</span></div>
      <Field label="Maximum daily campaign budget" hint="Any proposal above this amount will be blocked."><div className="large-money-input"><span>{state.workspace.currency}</span><input type="number" min="1" value={limit} onChange={(e) => setLimit(Number(e.target.value))} /></div></Field>
      <div className="rule-list"><Rule label="Human approval required" detail="Every launch needs an explicit confirmation" /><Rule label="Initial campaign state" detail="Always create campaigns paused" value="PAUSED" /><Rule label="Currency enforcement" detail="Campaign currency must match account" value={state.workspace.currency} /><Rule label="Idempotent execution" detail="Retries cannot create duplicate campaigns" /></div>
      <div className="form-actions"><button className="button primary" type="submit">{saved ? <><Check size={16} /> Saved</> : "Save policy"}</button></div>
    </form>
  </div>;
}

function Rule({ label, detail, value }: { label: string; detail: string; value?: string }) {
  return <div className="rule"><span className="rule-check"><Check size={14} /></span><div><strong>{label}</strong><p>{detail}</p></div>{value ? <code>{value}</code> : <span className="toggle-on"><span /></span>}</div>;
}

function CreateCampaign({ state, updateState, setView, openProposal }: { state: AppState; updateState: (fn: (s: AppState) => AppState) => void; setView: (v: View) => void; openProposal: (id: string) => void }) {
  const [step, setStep] = useState<CreateStep>("brief");
  const [brief, setBrief] = useState<CampaignBrief>(() => emptyBrief(state.workspace));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [proposal, setProposal] = useState<CampaignProposal>();
  const [approvalOpen, setApprovalOpen] = useState(false);

  async function submitBrief(e: FormEvent) {
    e.preventDefault();
    if (!state.workspace.connected) { setErrors({ form: "Connect the Meta simulator before generating a campaign." }); return; }
    const parsed = CampaignBriefSchema.safeParse(brief);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => { next[String(issue.path[0])] = issue.message; });
      setErrors(next); return;
    }
    setErrors({}); setStep("generating");
    try {
      const nextProposal = (await requestProposal("generate", parsed.data, state.workspace)).proposal;
      if (!nextProposal) throw new Error("The campaign planner returned no proposal.");
      setProposal(nextProposal);
      updateState((current) => ({ ...current, proposals: [nextProposal, ...current.proposals], auditEvents: [audit("proposal.generated", `AI planner created revision 1 for ${nextProposal.campaignName}.`, "success", nextProposal.id), audit("proposal.validated", nextProposal.status === "VALIDATION_BLOCKED" ? "Policy validation found a hard blocker." : "Proposal passed hard policy checks.", nextProposal.status === "VALIDATION_BLOCKED" ? "warning" : "success", nextProposal.id), ...current.auditEvents] }));
      setStep("review");
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : "Campaign planning failed." });
      setStep("brief");
    }
  }

  function updateProposal(updated: CampaignProposal) {
    setProposal(updated);
    updateState((current) => ({ ...current, proposals: current.proposals.map((item) => item.id === updated.id ? updated : item) }));
  }

  function confirmApproval() {
    if (!proposal) return;
    try {
      const approved = approveProposal(proposal);
      updateProposal(approved);
      updateState((current) => ({ ...current, proposals: current.proposals.map((item) => item.id === approved.id ? approved : item), auditEvents: [audit("proposal.approved", `${approved.campaignName} approved for up to ${approved.budget.currency} ${approved.budget.lifetime}.`, "success", approved.id), ...current.auditEvents] }));
      setApprovalOpen(false);
    } catch (error) { setErrors({ form: error instanceof Error ? error.message : "Approval failed" }); }
  }

  function launch() {
    if (!proposal) return;
    const launched = executeProposal(proposal);
    updateProposal(launched);
    updateState((current) => ({ ...current, proposals: current.proposals.map((item) => item.id === launched.id ? launched : item), auditEvents: [audit("campaign.executed", `Simulator created ${launched.execution?.campaignId} in PAUSED state.`, "success", launched.id), ...current.auditEvents] }));
    setStep("success");
  }

  if (step === "generating") return <GenerationScreen brief={brief} />;
  if ((step === "review" || step === "success") && proposal) return <>
    <ProposalReview proposal={proposal} success={step === "success"} onApprove={() => setApprovalOpen(true)} onLaunch={launch} onBack={() => setStep("brief")} onViewCampaign={() => openProposal(proposal.id)} />
    <ApprovalModal open={approvalOpen} proposal={proposal} onClose={() => setApprovalOpen(false)} onConfirm={confirmApproval} />
  </>;

  return <div className="page create-page">
    <div className="create-progress"><span className="active"><b>1</b> Brief</span><i /><span><b>2</b> AI plan</span><i /><span><b>3</b> Approve</span><i /><span><b>4</b> Launch</span></div>
    <PageHeading eyebrow="New campaign" title="What are we trying to achieve?" description="Give the agent the commercial context. You’ll review every execution detail before anything is created." />
    <form onSubmit={submitBrief} className="brief-layout">
      <div className="brief-main">
        {errors.form && <div className="inline-alert error"><TriangleAlert size={18} />{errors.form}<button type="button" onClick={() => setView("connections")}>Open connections</button></div>}
        <section className="panel form-section"><div className="section-number">01</div><div className="section-content"><h2>Campaign objective</h2><p>Choose the business outcome the platform should optimize toward.</p><div className="objective-grid">
          <ObjectiveCard current={brief.objective} value="SALES" icon={CircleDollarSign} label="Drive sales" detail="Optimize for purchases" onSelect={(objective) => setBrief({ ...brief, objective })} />
          <ObjectiveCard current={brief.objective} value="LEADS" icon={Target} label="Generate leads" detail="Capture qualified interest" onSelect={(objective) => setBrief({ ...brief, objective })} />
          <ObjectiveCard current={brief.objective} value="TRAFFIC" icon={BarChart3} label="Build traffic" detail="Grow landing page visits" onSelect={(objective) => setBrief({ ...brief, objective })} />
          <ObjectiveCard current={brief.objective} value="AWARENESS" icon={Megaphone} label="Build awareness" detail="Optimize for reach" onSelect={(objective) => setBrief({ ...brief, objective })} />
        </div></div></section>
        <section className="panel form-section"><div className="section-number">02</div><div className="section-content"><h2>Offer and destination</h2><p>Describe the product honestly—the agent will turn this into positioning and copy.</p><div className="form-grid two">
          <Field label="Product or offer" error={errors.productName}><input value={brief.productName} onChange={(e) => setBrief({ ...brief, productName: e.target.value })} placeholder="e.g. Everyday Travel Pack" /></Field>
          <Field label="Destination URL" error={errors.destinationUrl}><input value={brief.destinationUrl} onChange={(e) => setBrief({ ...brief, destinationUrl: e.target.value })} placeholder="https://example.com/product" /></Field>
          <Field label="What makes this offer valuable?" error={errors.offerDescription} wide><textarea rows={4} value={brief.offerDescription} onChange={(e) => setBrief({ ...brief, offerDescription: e.target.value })} placeholder="Describe the problem, benefits, offer, and any proof the campaign can use." /></Field>
        </div></div></section>
        <section className="panel form-section"><div className="section-number">03</div><div className="section-content"><h2>Audience and investment</h2><p>Set hard parameters. The workspace policy remains the final authority.</p><div className="form-grid three">
          <Field label="Target geography" error={errors.geography}><input value={brief.geography} onChange={(e) => setBrief({ ...brief, geography: e.target.value })} /></Field>
          <Field label="Daily budget" error={errors.dailyBudget}><div className="input-prefix"><span>{brief.currency}</span><input type="number" min="1" value={brief.dailyBudget} onChange={(e) => setBrief({ ...brief, dailyBudget: Number(e.target.value) })} /></div></Field>
          <Field label="Duration"><div className="input-suffix"><input type="number" min="1" max="90" value={brief.durationDays} onChange={(e) => setBrief({ ...brief, durationDays: Number(e.target.value) })} /><span>days</span></div></Field>
          <Field label="Audience hypothesis" hint="Optional—AI will make an explicit assumption if empty" wide><textarea rows={3} value={brief.audienceHint} onChange={(e) => setBrief({ ...brief, audienceHint: e.target.value })} placeholder="e.g. Urban professionals who travel 3+ times per year" /></Field>
        </div></div></section>
        <section className="panel form-section"><div className="section-number">04</div><div className="section-content"><h2>Creative direction</h2><p>Shape the voice without constraining the agent too tightly.</p><div className="form-grid two">
          <Field label="Brand voice"><input value={brief.brandVoice} onChange={(e) => setBrief({ ...brief, brandVoice: e.target.value })} /></Field>
          <Field label="Additional instructions"><input value={brief.extraInstructions} onChange={(e) => setBrief({ ...brief, extraInstructions: e.target.value })} placeholder="Optional constraints or ideas" /></Field>
        </div></div></section>
        <div className="submit-bar"><div><Bot size={19} /><span><strong>Demo planner</strong> uses a deterministic, schema-validated campaign engine.</span></div><button className="button primary large" type="submit"><Sparkles size={17} /> Generate campaign plan</button></div>
      </div>
      <aside className="brief-aside"><div className="policy-summary"><ShieldCheck size={22} /><h3>Policy guardrails</h3><p>Checked during planning and again before launch.</p><dl><div><dt>Daily limit</dt><dd>{state.workspace.currency} {state.workspace.maxDailyBudget}</dd></div><div><dt>Initial state</dt><dd>Paused</dd></div><div><dt>Approval</dt><dd>Required</dd></div><div><dt>Platform</dt><dd>Meta simulator</dd></div></dl></div><div className="aside-tip"><Sparkles size={17} /><p><strong>Good briefs make better ads.</strong> Include the real benefit, a concrete offer, and who it is for.</p></div></aside>
    </form>
  </div>;
}

function ObjectiveCard({ current, value, icon: Icon, label, detail, onSelect }: { current: Objective; value: Objective; icon: typeof Target; label: string; detail: string; onSelect: (value: Objective) => void }) {
  return <button type="button" className={`objective-card ${current === value ? "selected" : ""}`} onClick={() => onSelect(value)}><span><Icon size={20} /></span><strong>{label}</strong><small>{detail}</small>{current === value && <i><Check size={12} /></i>}</button>;
}

function GenerationScreen({ brief }: { brief: CampaignBrief }) {
  return <div className="generation-page"><div className="generation-visual"><div className="pulse-ring ring-one" /><div className="pulse-ring ring-two" /><div className="agent-core"><Sparkles size={30} /></div></div><span className="eyebrow">Agent at work</span><h1>Building a campaign for<br />{brief.productName}</h1><p>Combining your business context with platform structure and policy constraints.</p><div className="generation-steps"><span className="done"><Check size={13} /> Brief normalized</span><span className="active"><LoaderCircle className="spin" size={13} /> Designing strategy</span><span>Structuring ads</span><span>Running guardrails</span></div></div>;
}

function ProposalReview({ proposal, success, onApprove, onLaunch, onBack, onViewCampaign }: { proposal: CampaignProposal; success: boolean; onApprove: () => void; onLaunch: () => void; onBack: () => void; onViewCampaign: () => void }) {
  const blockers = proposal.findings.filter((f) => f.severity === "blocker");
  if (success && proposal.execution) return <div className="page success-page"><div className="success-icon"><Rocket size={34} /></div><span className="eyebrow">Simulation complete</span><h1>Campaign created—safely paused.</h1><p>The full Meta-style hierarchy was created in the simulator. No real account was changed and no money can be spent.</p><div className="execution-receipt"><div><span>Status</span><StatusBadge status={proposal.status} /></div><div><span>Campaign ID</span><code>{proposal.execution.campaignId}</code></div><div><span>Ad set ID</span><code>{proposal.execution.adSetId}</code></div><div><span>Ads created</span><strong>{proposal.execution.adIds.length}</strong></div><div><span>Request ID</span><code>{proposal.execution.requestId}</code></div></div><div className="success-actions"><button className="button primary" onClick={onViewCampaign}>View campaign <ArrowRight size={16} /></button><button className="button secondary" onClick={onBack}>Create another</button></div></div>;

  return <div className="page review-page">
    <div className="review-top"><button className="back-button" onClick={onBack}><ChevronLeft size={17} /> Back to brief</button><div className="create-progress compact"><span className="done"><b><Check size={12} /></b> Brief</span><i /><span className="done"><b><Check size={12} /></b> AI plan</span><i /><span className={proposal.status === "APPROVED" ? "done" : "active"}><b>{proposal.status === "APPROVED" ? <Check size={12} /> : 3}</b> Approve</span><i /><span><b>4</b> Launch</span></div></div>
    <PageHeading eyebrow="AI campaign proposal" title={proposal.campaignName} description="Review the strategy and exact execution details. The proposal is transparent by design." action={<StatusBadge status={proposal.status} />} />
    <div className="review-layout"><div className="review-main">
      <section className="panel strategy-card"><div className="strategy-label"><Sparkles size={17} /> Agent rationale</div><p>{proposal.rationale}</p><div className="strategy-facts"><div><span>Objective</span><strong>{proposal.objective}</strong></div><div><span>Daily budget</span><strong>{proposal.budget.currency} {proposal.budget.daily}</strong></div><div><span>Duration</span><strong>{proposal.schedule.durationDays} days</strong></div><div><span>Lifetime cap</span><strong>{proposal.budget.currency} {proposal.budget.lifetime.toLocaleString()}</strong></div></div></section>
      <section className="panel review-section"><div className="panel-header"><div><span className="eyebrow">Ad set 01</span><h2>Prospecting · {proposal.brief.geography}</h2></div><span className="object-pill">1 ad set</span></div><div className="audience-grid"><div><span>Audience</span><p>{proposal.audience.summary}</p></div><div><span>Optimization</span><p>{proposal.optimizationGoal}</p></div><div><span>Age range</span><p>{proposal.audience.ageRange}</p></div><div><span>Placements</span><p>Advantage+ · {proposal.placements.length} placements</p></div></div><div className="signal-row">{proposal.audience.signals.map((signal) => <span key={signal}>{signal}</span>)}</div></section>
      <section className="review-section-heading"><div><span className="eyebrow">Creative plan</span><h2>{proposal.ads.length} message variants</h2></div><span>Each variation tests a different angle</span></section>
      <div className="ad-grid">{proposal.ads.map((ad, index) => <article className="ad-card" key={ad.id}><div className={`creative-placeholder creative-${index + 1}`}><div><Sparkles size={17} /><span>Creative direction</span></div><p>{ad.creativeBrief}</p></div><div className="ad-copy"><span className="ad-number">AD {String(index + 1).padStart(2, "0")}</span><h3>{ad.headline}</h3><p>{ad.primaryText}</p><div><span>{ad.callToAction}</span><ExternalLink size={14} /></div></div></article>)}</div>
      <section className="panel measurement-card"><div className="panel-header"><div><span className="eyebrow">Measurement</span><h2>How success will be judged</h2></div><Gauge size={22} /></div><div className="measurement-grid"><div><span>Primary metric</span><strong>{proposal.measurement.primaryMetric}</strong></div><div><span>Secondary signals</span><p>{proposal.measurement.secondaryMetrics.join(" · ")}</p></div></div><div className="tracking-list">{proposal.measurement.trackingRequirements.map((item) => <span key={item}><CheckCircle2 size={15} />{item}</span>)}</div></section>
    </div><aside className="review-aside">
      <section className="panel findings-card"><div className="panel-header"><div><span className="eyebrow">Policy check</span><h2>{blockers.length ? `${blockers.length} blocker` : "Ready for approval"}</h2></div>{blockers.length ? <TriangleAlert className="danger" /> : <ShieldCheck className="success" />}</div>{proposal.findings.map((finding) => <FindingRow key={finding.code} finding={finding} />)}</section>
      <section className="panel assumptions-card"><h3>Agent assumptions</h3>{proposal.assumptions.map((assumption) => <p key={assumption}><span />{assumption}</p>)}</section>
      <section className="sticky-action"><div><span>Maximum authorized spend</span><strong>{proposal.budget.currency} {proposal.budget.lifetime.toLocaleString()}</strong></div>{proposal.status === "APPROVED" ? <button className="button primary large full" onClick={onLaunch}><Play size={16} /> Launch paused campaign</button> : <button className="button primary large full" onClick={onApprove} disabled={blockers.length > 0}><ClipboardCheck size={16} /> Approve proposal</button>}<small><LockKeyhole size={13} /> Creates paused objects in the simulator only</small></section>
    </aside></div>
  </div>;
}

function ApprovalModal({ open, proposal, onClose, onConfirm }: { open: boolean; proposal: CampaignProposal; onClose: () => void; onConfirm: () => void }) {
  if (!open) return null;
  return <div className="modal-backdrop"><div className="modal"><button className="modal-close" onClick={onClose}><X size={18} /></button><div className="modal-icon"><ClipboardCheck size={24} /></div><h2>Approve this campaign?</h2><p>You are authorizing a simulated campaign with a maximum lifetime budget of <strong>{proposal.budget.currency} {proposal.budget.lifetime.toLocaleString()}</strong>.</p><div className="modal-summary"><span><Check size={14} /> Meta simulator account</span><span><Check size={14} /> Initial state: PAUSED</span><span><Check size={14} /> {proposal.ads.length} ads in 1 ad set</span></div><div className="modal-actions"><button className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" onClick={onConfirm}>Confirm approval</button></div></div></div>;
}

function FindingRow({ finding }: { finding: Finding }) {
  const Icon = finding.severity === "blocker" ? TriangleAlert : finding.severity === "warning" ? TriangleAlert : CheckCircle2;
  return <div className={`finding ${finding.severity}`}><Icon size={16} /><div><strong>{finding.title}</strong><p>{finding.message}</p></div></div>;
}

function AuditLog({ events }: { events: AppState["auditEvents"] }) {
  return <div className="page narrow-page"><PageHeading eyebrow="Trust & control" title="Audit log" description="An append-only history of agent, user, policy, and execution events." /><section className="panel audit-panel">{events.length ? <EventList events={events} /> : <div className="empty-small"><History size={24} /><h3>No events yet</h3><p>Workspace changes and campaign actions will appear here.</p></div>}</section></div>;
}

function EventList({ events }: { events: AppState["auditEvents"] }) {
  if (!events.length) return <div className="empty-small"><History size={22} /><p>No events for this campaign yet.</p></div>;
  return <div className="event-list">{events.map((event) => <div className="event-row" key={event.id}><span className={`event-dot ${event.status}`} /><div><strong>{humanize(event.action)}</strong><p>{event.detail}</p><small>{formatDateTime(event.createdAt)} · Prototype owner</small></div><code>{event.id.slice(-8)}</code></div>)}</div>;
}

function StatusBadge({ status }: { status: CampaignProposal["status"] }) {
  const labels: Record<CampaignProposal["status"], string> = { PROPOSED: "Proposed", READY_FOR_APPROVAL: "Ready to approve", VALIDATION_BLOCKED: "Blocked", APPROVED: "Approved", LAUNCHED_PAUSED: "Launched · Paused" };
  return <span className={`status-badge ${status.toLowerCase()}`}><span />{labels[status]}</span>;
}

function Field({ label, hint, error, wide, children }: { label: string; hint?: string; error?: string; wide?: boolean; children: React.ReactNode }) {
  return <label className={`field ${wide ? "wide" : ""}`}><span>{label}{hint && <small>{hint}</small>}</span>{children}{error && <em>{error}</em>}</label>;
}

function humanize(value: string) { return value.split(".").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" · "); }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value)); }
