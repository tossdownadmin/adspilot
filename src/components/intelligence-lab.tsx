"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BarChart3, BrainCircuit, CheckCircle2, ChevronLeft, Clipboard, Database, FileJson, Filter, Info, LoaderCircle, RefreshCw, Search, ShieldCheck, Sparkles, Target, TriangleAlert, Trophy, XCircle } from "lucide-react";
import type { AuditResult, IntelligenceObjective, IntelligencePlaybook, Jtd, NewCampaignBrief, PerformanceTier, ReferenceSelection } from "@/lib/intelligence-domain";
import type { LiveMetaAudit } from "@/lib/meta/live-audit";

const tierMeta: Record<PerformanceTier, { label: string; icon: typeof Trophy }> = {
  winner: { label: "Winner", icon: Trophy }, contender: { label: "Contender", icon: Target },
  underperformer: { label: "Underperformer", icon: TriangleAlert }, kill_candidate: { label: "Kill candidate", icon: XCircle },
  insufficient_data: { label: "Insufficient data", icon: Info },
};

export function IntelligenceLab({ account, onChooseAccount }: { account?: { id: string; name: string; currency?: string }; onChooseAccount: () => void }) {
  const [audit, setAudit] = useState<LiveMetaAudit>();
  const [results, setResults] = useState<AuditResult[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const counts = useMemo(() => results.reduce<Record<string, number>>((value, result) => ({ ...value, [result.tier]: (value[result.tier] ?? 0) + 1 }), {}), [results]);
  const [tab, setTab] = useState<"audit" | "brief" | "playbook">("audit");
  const [selected, setSelected] = useState<AuditResult>();
  const [filter, setFilter] = useState<PerformanceTier | "all">("all");
  const [dimension, setDimension] = useState<"all" | "region" | "product" | "format">("all");

  async function loadLiveIntelligence() {
    if (!account) return;
    setRunning(true);
    setError("");
    setSelected(undefined);
    try {
      const response = await fetch("/api/meta/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: account.id }),
      });
      const body = await response.json() as { audit?: LiveMetaAudit; intelligenceResults?: AuditResult[]; message?: string; error?: string };
      if (!response.ok || !body.audit) throw new Error(body.message || body.error || "Meta intelligence data is unavailable.");
      setAudit(body.audit);
      setResults(body.intelligenceResults ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Meta intelligence data is unavailable.");
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    if (account) void loadLiveIntelligence();
  // Run once for each explicitly selected account.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.id]);

  if (!account) return <div className="page intelligence-page"><div className="panel empty-live-audit"><BrainCircuit size={28} /><h2>Select a live Meta account</h2><p>Intelligence does not use demo data. Choose the account whose campaigns should be scored.</p><button className="button primary" onClick={onChooseAccount}>Choose account</button></div></div>;

  if (running && !audit) return <div className="page intelligence-page"><div className="live-audit-loading"><LoaderCircle className="spin" size={30} /><span className="live-data-badge">LIVE META DATA</span><h1>Building intelligence for {account.name}</h1><p>Reading campaign outcomes and applying deterministic scoring rules.</p></div></div>;

  if (error && !audit) return <div className="page intelligence-page"><div className="panel live-audit-error"><TriangleAlert size={28} /><h2>Live intelligence needs attention</h2><p>{error}</p><div><button className="button primary" onClick={() => void loadLiveIntelligence()}>Try again</button><button className="button secondary" onClick={onChooseAccount}>Check account</button></div></div></div>;

  return <div className="page intelligence-page">
    <div className="intel-hero">
      <div><span className="eyebrow">Campaign Intelligence · Live Meta data</span><h1>Find the patterns worth repeating.</h1><p>Score the selected account&apos;s real historical performance, then build a playbook from evidence that Meta returned.</p></div>
      <div className="demo-source"><span className="live-dot" /><div><strong>{account.name}</strong><small>{account.id} · {account.currency || "Currency not returned"}</small></div><button className="icon-button" aria-label="Refresh live intelligence" disabled={running} onClick={() => void loadLiveIntelligence()}>{running ? <LoaderCircle className="spin" size={15} /> : <RefreshCw size={15} />}</button></div>
    </div>
    <div className="intel-tabs"><button className={tab === "audit" ? "active" : ""} onClick={() => setTab("audit")}><BarChart3 size={16} /> 1. Account audit</button><button className={tab === "brief" ? "active" : ""} onClick={() => setTab("brief")}><Target size={16} /> 2. Define campaign job</button><button className={tab === "playbook" ? "active" : ""} disabled={tab !== "playbook"}><BrainCircuit size={16} /> 3. Review playbook</button></div>
    {audit?.campaigns.status === "unavailable" ? <div className="panel live-audit-error"><TriangleAlert size={24} /><h2>Campaign reporting unavailable</h2><p>{audit.campaigns.message}</p></div> : results.length === 0 ? <div className="panel empty-live-audit"><Info size={26} /><h2>Not enough data</h2><p>Meta returned no delivered campaigns for this 60-day window. No fixture data was substituted.</p></div> : tab === "audit" ? selected ? <CampaignEvidence result={selected} onBack={() => setSelected(undefined)} /> : <AuditDashboard results={results} counts={counts} filter={filter} setFilter={setFilter} dimension={dimension} setDimension={setDimension} select={setSelected} onBuild={() => setTab("brief")} currency={account.currency || "USD"} /> : <PlaybookBuilder accountId={account.id} results={results} currency={account.currency || "USD"} onBack={() => setTab("audit")} onGenerated={() => setTab("playbook")} />}
  </div>;
}

function AuditDashboard({ results, counts, filter, setFilter, dimension, setDimension, select, onBuild, currency }: { results: AuditResult[]; counts: Record<string, number>; filter: PerformanceTier | "all"; setFilter: (v: PerformanceTier | "all") => void; dimension: "all" | "region" | "product" | "format"; setDimension: (v: "all" | "region" | "product" | "format") => void; select: (r: AuditResult) => void; onBuild: () => void; currency: string }) {
  const visible = filter === "all" ? results : results.filter((result) => result.tier === filter);
  const provenWinners = results.filter((result) => result.eligibleReference).sort((left, right) => (right.score ?? 0) - (left.score ?? 0));
  const topSpend = [...results].sort((left, right) => right.campaign.spend - left.campaign.spend).slice(0, 3);
  const dimensionGroups = rankDimensionGroups(results, dimension).slice(0, 4);
  return <>
    <div className="audit-summary panel"><div className="audit-source"><Database size={20} /><div><strong>60-day live account audit complete</strong><span>{results.length} campaigns · {currency} · Campaign grain</span></div></div><div className="audit-pipeline"><span><CheckCircle2 /> Meta metrics normalized</span><span><CheckCircle2 /> JTBDs inferred</span><span><CheckCircle2 /> Cohorts scored</span></div><button className="button primary" onClick={onBuild}><ArrowRight size={16} /> Define next campaign</button></div>
    <section className="winner-explorer">
      <div className="winner-explorer-heading"><div><span className="eyebrow">Start here</span><h2>What is working in this account?</h2><p>Spend and scoring are separate: a high-spend campaign is not automatically a winner.</p></div><label className="field compact-field"><span>Explore by</span><select value={dimension} onChange={(event) => setDimension(event.target.value as typeof dimension)}><option value="all">All campaign evidence</option><option value="region">Region</option><option value="product">Product / offer</option><option value="format">Creative format</option></select></label></div>
      <div className="winner-explorer-grid">
        <EvidenceList title="Proven winners" subtitle={provenWinners.length ? "Passed evidence and reference rules" : "No campaign has enough comparable evidence yet"} results={provenWinners.slice(0, 3)} currency={currency} select={select} empty="Use the full table to inspect contenders and data gaps." />
        <EvidenceList title="Highest spend" subtitle="Where Meta reports the budget went" results={topSpend} currency={currency} select={select} empty="Not enough spend data returned." />
        <DimensionList dimension={dimension} groups={dimensionGroups} currency={currency} />
      </div>
    </section>
    <section className="tier-grid">{(Object.keys(tierMeta) as PerformanceTier[]).map((tier) => { const meta = tierMeta[tier]; return <button key={tier} className={`tier-card ${tier} ${filter === tier ? "selected" : ""}`} onClick={() => setFilter(filter === tier ? "all" : tier)}><meta.icon size={18} /><span>{meta.label}</span><strong>{counts[tier] ?? 0}</strong><small>{tier === "winner" ? "Eligible patterns" : tier === "insufficient_data" ? "Excluded from scoring" : "Review cohort"}</small></button>; })}</section>
    <section className="panel audit-table-panel">
      <div className="panel-header intel-table-header"><div><span className="eyebrow">Glass-box results · Live Meta data</span><h2>{filter === "all" ? "All historical campaigns" : tierMeta[filter].label}</h2></div><div className="table-tools"><span><Search size={13} /> {visible.length} results</span><button><Filter size={14} /> 60 days</button></div></div>
      <div className="intel-table-head"><span>Campaign</span><span>JTD / cohort</span><span>Spend</span><span>ROAS / CPA</span><span>Score</span><span>Tier</span><span /></div>
      <div className="intel-table-body">{visible.map((result) => <button className="intel-table-row" key={result.campaign.campaignId} onClick={() => select(result)}>
        <div><span className="meta-mini">f</span><span><strong>{result.campaign.name}</strong><small>{result.campaign.campaignId} · {result.campaign.region}</small></span></div>
        <div><strong>{jtdLabel(result.campaign.jtd)}</strong><small>{result.campaign.objective} · n={result.cohortSize}</small></div>
        <span>${result.campaign.spend.toLocaleString()}</span>
        <span>{result.campaign.objective === "sales" ? `${result.metrics.roas?.toFixed(2)}× ROAS` : `$${result.metrics.cpa?.toFixed(2) ?? "—"} CPA`}<small>{result.campaign.conversions} outcomes</small></span>
        <span className="score-cell">{result.score === null ? "—" : result.score.toFixed(2)}<i><b style={{width: `${(result.score ?? 0) * 100}%`}} /></i></span>
        <TierBadge tier={result.tier} />
        <ArrowRight size={14} />
      </button>)}</div>
    </section>
  </>;
}

function EvidenceList({ title, subtitle, results, currency, select, empty }: { title: string; subtitle: string; results: AuditResult[]; currency: string; select: (result: AuditResult) => void; empty: string }) {
  return <section className="panel evidence-list"><div><span className="eyebrow">{title}</span><p>{subtitle}</p></div>{results.length ? results.map((result) => <button key={result.campaign.campaignId} onClick={() => select(result)}><span><strong>{result.campaign.name}</strong><small>{winnerMetric(result)} · {result.campaign.objective}</small></span><b>{formatCurrency(result.campaign.spend, currency)}</b><ArrowRight size={14} /></button>) : <small className="empty-evidence">{empty}</small>}</section>;
}

function DimensionList({ dimension, groups, currency }: { dimension: "all" | "region" | "product" | "format"; groups: DimensionGroup[]; currency: string }) {
  const label = dimension === "region" ? "Regions" : dimension === "product" ? "Products / offers" : dimension === "format" ? "Creative formats" : "Evidence coverage";
  const description = dimension === "format" ? "Confirmed only when Meta returns creative metadata." : "Grouped from live account evidence; inferred values are labelled.";
  return <section className="panel evidence-list dimension-list"><div><span className="eyebrow">{label}</span><p>{description}</p></div>{groups.length ? groups.map((group) => <div className="dimension-row" key={`${group.label}-${group.source}`}><span><strong>{group.label}</strong><small>{dimensionSourceLabel(group.source)} · {group.campaigns} campaigns</small></span><b>{formatCurrency(group.spend, currency)}</b></div>) : <small className="empty-evidence">Not enough data returned for this view.</small>}</section>;
}

type DimensionGroup = { label: string; source: "meta_returned" | "inferred_from_campaign_name" | "not_enough_data"; campaigns: number; spend: number };

function rankDimensionGroups(results: AuditResult[], dimension: "all" | "region" | "product" | "format"): DimensionGroup[] {
  const key = dimension === "region" ? "region" : dimension === "product" ? "product" : "creativeFormat";
  const sourceKey = dimension === "region" ? "regionSource" : dimension === "product" ? "productSource" : "creativeFormatSource";
  const groups = new Map<string, DimensionGroup>();
  for (const result of results) {
    const label = dimension === "all" ? result.campaign.objective : result.campaign[key] || "Not enough data";
    const source = dimension === "all" ? "meta_returned" : result.campaign[sourceKey] || "not_enough_data";
    const current = groups.get(`${label}-${source}`) || { label, source, campaigns: 0, spend: 0 };
    current.campaigns += 1;
    current.spend += result.campaign.spend;
    groups.set(`${label}-${source}`, current);
  }
  return [...groups.values()].sort((left, right) => right.spend - left.spend);
}

function winnerMetric(result: AuditResult) {
  if (result.campaign.objective === "sales") return result.metrics.roas === null ? "ROAS not returned" : `${result.metrics.roas.toFixed(2)}× ROAS`;
  if (result.campaign.objective === "awareness") return result.metrics.costPerThousandReached === null ? "CPM not returned" : `${result.metrics.costPerThousandReached.toFixed(2)} cost / 1k reached`;
  return result.metrics.cpa === null ? "Cost per result not returned" : `${result.metrics.cpa.toFixed(2)} CPA`;
}

function dimensionSourceLabel(source: DimensionGroup["source"]) {
  return source === "meta_returned" ? "Meta returned" : source === "inferred_from_campaign_name" ? "Inferred from campaign name" : "Not enough data";
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

function TierBadge({ tier }: { tier: PerformanceTier }) { const meta = tierMeta[tier]; return <span className={`intel-tier ${tier}`}><meta.icon size={11} />{meta.label}</span>; }

function CampaignEvidence({ result, onBack }: { result: AuditResult; onBack: () => void }) {
  return <div className="evidence-page"><button className="back-button" onClick={onBack}><ChevronLeft size={16} /> Back to audit</button><div className="evidence-heading"><div><span className="eyebrow">Campaign evidence</span><h2>{result.campaign.name}</h2><p>{result.campaign.campaignId} · {result.campaign.region} · {result.campaign.product}</p></div><TierBadge tier={result.tier} /></div>
    <div className="evidence-grid"><section className="panel score-explain"><div className="score-orb"><strong>{result.score === null ? "—" : result.score.toFixed(2)}</strong><span>composite score</span></div><div><span className="eyebrow">Deterministic result</span><h3>{result.significant ? `Compared within ${jtdLabel(result.campaign.jtd)}` : "Not enough evidence to classify"}</h3><p>{result.rationale}</p><div className="evidence-tags"><span>Objective: {result.campaign.objective}</span><span>Cohort size: {result.cohortSize}</span><span>JTD confidence: {Math.round(result.campaign.jtdConfidence * 100)}%</span></div></div></section>
      <section className="panel metric-contributions"><div className="panel-header"><div><span className="eyebrow">Score anatomy</span><h2>Metric contributions</h2></div><ShieldCheck size={20} /></div>{result.contributions.length ? result.contributions.map((metric) => <div className="contribution" key={metric.metric}><span>{metric.metric}</span><strong>{metric.rawValue.toFixed(metric.rawValue < 1 ? 3 : 2)}</strong><i><b style={{width: `${metric.normalizedScore * 100}%`}} /></i><small>× {metric.weight.toFixed(2)} = {metric.contribution.toFixed(3)}</small></div>) : <div className="gate-failures"><TriangleAlert size={20} /><strong>Significance gates failed</strong>{result.gateFailures.map((failure) => <span key={failure}>{failure.replaceAll("_", " ")}</span>)}</div>}</section>
      <section className="panel evidence-metrics"><div><span>Spend</span><strong>${result.campaign.spend.toLocaleString()}</strong></div><div><span>Outcomes</span><strong>{result.campaign.conversions}</strong></div><div><span>CTR</span><strong>{((result.metrics.ctr ?? 0) * 100).toFixed(2)}%</strong></div><div><span>CPA</span><strong>{result.metrics.cpa ? `$${result.metrics.cpa.toFixed(2)}` : "—"}</strong></div><div><span>ROAS</span><strong>{result.metrics.roas ? `${result.metrics.roas.toFixed(2)}×` : "—"}</strong></div><div><span>Frequency</span><strong>{result.metrics.frequency?.toFixed(2) ?? "—"}</strong></div></section>
      <section className="panel glassbox-note"><BrainCircuit size={20} /><div><strong>What the AI can say</strong><p>The LLM may explain this result and add supported nuance. It cannot change the score or tier, and every claim must cite this evidence package.</p></div>{result.nuanceFlags.length > 0 && <div className="nuance-list">{result.nuanceFlags.map((flag) => <span key={flag}>{flag.replaceAll("_", " ")}</span>)}</div>}</section>
    </div>
  </div>;
}

function PlaybookBuilder({ accountId, results, currency, onBack, onGenerated }: { accountId: string; results: AuditResult[]; currency: string; onBack: () => void; onGenerated: () => void }) {
  const regions = [...new Set(results.map((result) => result.campaign.region).filter((value) => value !== "Not enough data"))];
  const products = [...new Set(results.map((result) => result.campaign.product).filter((value) => value !== "Not enough data"))];
  const [brief, setBrief] = useState<NewCampaignBrief>({ region: "", product: "", objective: "" as IntelligenceObjective, jtd: "unknown", dailyBudget: 0, offer: "" });
  const [generated, setGenerated] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [playbook, setPlaybook] = useState<IntelligencePlaybook>();
  const isComplete = Boolean(brief.region.trim() && brief.product.trim() && brief.objective && brief.jtd !== "unknown" && brief.dailyBudget > 0);
  const closest = playbook?.references.closestBest;
  const overall = playbook?.references.overallBest;
  const inferredRegion = regions.length ? `Suggestions from live naming: ${regions.slice(0, 4).join(", ")}.` : "Meta did not return a usable region at campaign level.";
  const inferredProduct = products.length ? `Suggestions from live naming: ${products.slice(0, 4).join(", ")}.` : "Meta did not return a usable product or offer at campaign level.";

  async function generatePlaybook() {
    if (!isComplete) return;
    setGenerating(true);
    setGenerationError("");
    try {
      const response = await fetch("/api/intelligence/playbook", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accountId, brief }) });
      const body = await response.json() as { playbook?: IntelligencePlaybook; message?: string };
      if (!response.ok || !body.playbook) throw new Error(body.message || "The playbook could not be generated.");
      setPlaybook(body.playbook);
      setGenerated(true);
      onGenerated();
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : "The playbook could not be generated.");
    } finally {
      setGenerating(false);
    }
  }

  if (!generated || !playbook) return <div className="playbook-setup"><div className="playbook-form panel"><button className="back-button" onClick={onBack}><ChevronLeft size={16} /> Back to account audit</button><span className="eyebrow">Step 2 · Define the new campaign job</span><h2>What should this next campaign achieve?</h2><p>Your brief is the source of truth. Live campaign names can suggest values, but AdPilot will not invent your region, product, offer, or JTBD.</p><div className="form-grid two">
    <label className="field"><span>Job To Be Done</span><select value={brief.jtd} onChange={(e) => setBrief({...brief, jtd:e.target.value as Jtd})}><option value="unknown" disabled>Choose the campaign job</option>{(["acquire_new","first_order","reactivate_lapsed","promote_lto","drive_catering","lift_aov","new_location_awareness","loyalty_signup"] as Jtd[]).map((job) => <option key={job} value={job}>{jtdLabel(job)}</option>)}</select></label>
    <label className="field"><span>Objective</span><select value={brief.objective} onChange={(e) => setBrief({...brief, objective:e.target.value as IntelligenceObjective})}><option value="" disabled>Choose objective</option>{(["sales","leads","traffic","awareness"] as IntelligenceObjective[]).map((objective) => <option key={objective} value={objective}>{objective[0].toUpperCase() + objective.slice(1)}</option>)}</select></label>
    <label className="field"><span>Target region</span><input list="live-regions" value={brief.region} onChange={(e) => setBrief({...brief, region:e.target.value})} placeholder="Enter target region" /><small>{inferredRegion}</small><datalist id="live-regions">{regions.map((region) => <option key={region} value={region} />)}</datalist></label>
    <label className="field"><span>Product or offer</span><input list="live-products" value={brief.product} onChange={(e) => setBrief({...brief, product:e.target.value})} placeholder="Enter product or offer" /><small>{inferredProduct}</small><datalist id="live-products">{products.map((product) => <option key={product} value={product} />)}</datalist></label>
    <label className="field"><span>Daily budget ({currency})</span><input type="number" min="1" value={brief.dailyBudget || ""} onChange={(e) => setBrief({...brief, dailyBudget:Number(e.target.value)})} placeholder="Enter approved daily budget" /></label>
    <label className="field"><span>Current offer details (optional)</span><input value={brief.offer} onChange={(e) => setBrief({...brief, offer:e.target.value})} placeholder="Describe the actual offer or constraint" /></label>
  </div><button className="button primary large full" onClick={() => void generatePlaybook()} disabled={!isComplete || generating}>{generating ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />}{generating ? "Refreshing evidence…" : "Find matching evidence"}</button>{!isComplete && <p className="form-hint"><Info size={14} /> Complete JTBD, objective, region, product/offer, and daily budget to continue.</p>}{generationError && <p className="agent-error"><TriangleAlert size={14} /> {generationError}</p>}</div><aside className="playbook-preview panel"><Target size={24} /><span className="eyebrow">What happens next</span><h3>AdPilot will compare two references</h3><p>It will refresh the selected account, find the closest eligible campaign matching your brief, then find the strongest eligible campaign for the same JTBD and objective.</p><dl><div><dt>Eligible references in current audit</dt><dd>{results.filter((r) => r.eligibleReference).length}</dd></div><div><dt>Historical data source</dt><dd>Live Meta</dd></div><div><dt>Campaign changes</dt><dd>None</dd></div></dl></aside></div>;
  const json = JSON.stringify({ schema_version: playbook.schemaVersion, playbook_id: playbook.playbookId, recommendation_mode: playbook.recommendationMode, brief: playbook.brief, references: { closest_best: closest ? { campaign_id: closest.result.campaign.campaignId, matched_rung: closest.matchedRung, score: closest.result.score } : null, overall_best: overall ? { campaign_id: overall.result.campaign.campaignId, score: overall.result.score } : null, references_are_same: playbook.references.referencesAreSame }, config: playbook.config, provenance: playbook.provenance, evidence: playbook.evidence, confidence: playbook.confidence, warnings: playbook.warnings, review_required: playbook.reviewRequired }, null, 2);
  return <div className="playbook-result"><button className="back-button" onClick={() => { setGenerated(false); onBack(); }}><ChevronLeft size={16} /> Edit campaign job</button><div className="playbook-result-head"><div><span className="eyebrow">Step 3 · Reviewable playbook · {playbook.recommendationMode.replaceAll("_"," ")}</span><h2>{brief.region} · {brief.product} · {jtdLabel(brief.jtd)}</h2><p>Every recommendation below is linked to user intent, deterministic rules, or historical evidence.</p></div><div className="confidence-box"><span>Confidence</span><strong>{Math.round(playbook.confidence * 100)}%</strong><small>Human review required</small></div></div>
    <div className="reference-grid"><ReferenceCard role="Closest best" reference={closest ?? null} /><ReferenceCard role="Overall best" reference={overall ?? null} /></div>
    {playbook.warnings.map((warning) => <div className="intel-warning" key={warning}><TriangleAlert size={16} />{warning}</div>)}
    <div className="playbook-output-grid"><section className="panel config-card"><div className="panel-header"><div><span className="eyebrow">Recommended config</span><h2>Campaign playbook</h2></div><span className="paused-chip">PAUSED</span></div><div className="config-rows"><ConfigRow label="Objective" value={playbook.config.objective} source="User brief" /><ConfigRow label="Optimization" value={playbook.config.optimizationGoal} source="Objective rule" /><ConfigRow label="Daily budget" value={`${currency} ${playbook.config.dailyBudget}`} source="Policy checked" /><ConfigRow label="Audience" value={`${playbook.config.audience.geo} · ${playbook.config.audience.pattern}`} source={closest ? "Closest best" : "Cold start"} /><ConfigRow label="Creative angle" value={playbook.config.creativeAngle} source={overall ? "Overall best" : "Cold start"} /><ConfigRow label="Offer guidance" value={playbook.config.offerGuidance} source="User brief" /></div><div className="copy-guidance"><span>Primary text guidance</span><p>{playbook.config.primaryTextGuidance}</p></div></section><section className="panel json-card"><div className="panel-header"><div><span className="eyebrow">Execution handoff</span><h2>Validated JSON</h2></div><button onClick={() => navigator.clipboard.writeText(json)}><Clipboard size={14} /> Copy</button></div><pre>{json}</pre></section></div>
    <div className="review-strip"><ShieldCheck size={19} /><div><strong>Glass-box review required</strong><p>Verify offer accuracy, tracking readiness, budget authorization, and reference relevance before any future execution.</p></div><span><FileJson size={14} /> Schema 1.0</span></div>
  </div>;
}

function ReferenceCard({ role, reference }: { role: string; reference: ReferenceSelection | null }) {
  if (!reference) return <div className="reference-card empty"><Info size={19} /><div><span>{role}</span><strong>No eligible reference</strong><p>This brief does not have a proven historical match. Review before using any cold-start guidance.</p></div></div>;
  const r = reference.result;
  return <div className="reference-card"><div className="reference-icon"><Trophy size={18} /></div><div><span>{role}</span><strong>{r.campaign.name}</strong><p>{r.campaign.campaignId} · {reference.matchedRung.join(" + ")}</p><div><b>{r.score?.toFixed(2)} score</b><b>{r.metrics.roas ? `${r.metrics.roas.toFixed(2)}× ROAS` : `$${r.metrics.cpa?.toFixed(2)} CPA`}</b></div></div></div>;
}

function ConfigRow({ label, value, source }: { label: string; value: string; source: string }) { return <div className="config-row"><span>{label}</span><strong>{value}</strong><small>{source}</small></div>; }

function jtdLabel(jtd: Jtd) {
  const labels: Record<Jtd, string> = { acquire_new: "Acquire New", first_order: "First Order", reactivate_lapsed: "Reactivate Lapsed", promote_lto: "Promote LTO", drive_catering: "Drive Catering", lift_aov: "Lift AOV", new_location_awareness: "New Location Awareness", loyalty_signup: "Loyalty Signup", unknown: "Unknown" };
  return labels[jtd];
}
