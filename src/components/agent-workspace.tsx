"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, Bot, Check, LoaderCircle, Minus, Send, Sparkles, TriangleAlert, X } from "lucide-react";
import { AgentReport, AgentResponse } from "./agent-response";
import type { AgentPresentation } from "@/lib/agent/adpilot-agent";
import type { AuditJobSnapshot } from "@/lib/audit/job-store";

type Message = { role: "user" | "assistant"; content: string; tools?: string[]; presentation?: AgentPresentation };

const suggestions = [
  "Audit this account and tell me the three most important things to do next.",
  "Which campaigns are actually working for their own objectives?",
  "Compare performance patterns by objective, region, and product.",
  "Build a campaign playbook from the strongest relevant winners.",
];

export function AgentWorkspace({ account, onChooseAccount }: { account: { id: string; name: string; currency?: string }; onChooseAccount: () => void }) {
  const [conversationId] = useState(() => crypto.randomUUID().replaceAll("-", "").slice(0, 20));
  const [messages, setMessages] = useState<Message[]>([]);
  const [prompt, setPrompt] = useState("");
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");
  const [auditJob, setAuditJob] = useState<AuditJobSnapshot>();

  async function pollAudit(jobId: string) {
    for (;;) {
      const response = await fetch(`/api/agent/status?jobId=${encodeURIComponent(jobId)}`, { cache: "no-store" });
      const job = await response.json() as AuditJobSnapshot & { message?: string; error?: string };
      if (!response.ok) throw new Error(job.message || job.error || "The audit job could not be recovered.");
      setAuditJob(job);
      if (job.status !== "running") return job;
      await new Promise((resolve) => window.setTimeout(resolve, 1_000));
    }
  }

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    const request = prompt.trim();
    if (!request || asking) return;
    const history = messages.slice(-20);
    setMessages((current) => [...current, { role: "user", content: request }]);
    setPrompt("");
    setAsking(true);
    setError("");
    try {
      const response = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: account.id, prompt: request, history, conversationId }),
      });
      const body = await response.json() as { jobId?: string; answer?: string; message?: string; error?: string; toolTrace?: Array<{ tool: string; status: "ok" | "error" }>; presentation?: AgentPresentation };
      if (response.status === 202 && body.jobId) {
        const job = await pollAudit(body.jobId);
        if (job.status !== "complete" || !job.report.answer) throw new Error("The staged audit finished without an assembled report.");
        setMessages((current) => [...current, { role: "assistant", content: job.report.answer!, presentation: job.report.presentation }]);
        return;
      }
      if (!response.ok || !body.answer) throw new Error(body.message || body.error || "AdPilot could not complete that request.");
      const tools = [...new Set((body.toolTrace ?? []).filter((item) => item.status === "ok").map((item) => item.tool))];
      setMessages((current) => [...current, { role: "assistant", content: body.answer!, tools, presentation: body.presentation }]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "AdPilot could not complete that request.");
    } finally {
      setAsking(false);
      setAuditJob(undefined);
    }
  }

  return <div className="page agent-workspace">
    <header className="agent-workspace-head">
      <div><span className="eyebrow">AdPilot · Live Meta agent</span><h1>Ask anything about your ads.</h1><p>AdPilot reads the connected account and uses the right tools automatically. You do not need to choose an audit or understand the scoring system.</p></div>
      <button className="agent-account-pill" onClick={onChooseAccount}><span className="live-dot" /><span><strong>{account.name}</strong><small>{account.id} · {account.currency || "Meta account"}</small></span><ArrowRight size={15} /></button>
    </header>

    <section className="agent-chat panel">
      <div className="agent-thread">
        {messages.length === 0 ? <div className="agent-welcome"><div className="agent-welcome-icon"><Sparkles size={24} /></div><h2>What would you like AdPilot to do?</h2><p>Start with an audit, ask about a campaign, compare regions, or request a campaign plan.</p><div className="agent-suggestions">{suggestions.map((suggestion) => <button key={suggestion} onClick={() => setPrompt(suggestion)}>{suggestion}<ArrowRight size={13} /></button>)}</div></div> : messages.map((message, index) => <article key={`${message.role}-${index}`} className={`chat-message ${message.role}`}><div>{message.role === "assistant" ? <Bot size={17} /> : "You"}</div><section>{message.presentation ? <AgentReport report={message.presentation} /> : null}{message.role === "assistant" ? <AgentResponse content={message.content} /> : <p>{message.content}</p>}{message.tools?.length ? <details className="agent-tools-used"><summary>{message.tools.length} live tools used</summary><span>{message.tools.join(" · ")}</span></details> : null}</section></article>)}
        {asking && <article className="chat-message assistant"><div><Bot size={17} /></div><section>{auditJob ? <AuditProgress job={auditJob} /> : <p className="agent-thinking"><LoaderCircle className="spin" size={15} /> Starting the live audit…</p>}</section></article>}
      </div>
      {error && <div className="agent-inline-error"><TriangleAlert size={16} /><span>{error}</span></div>}
      <form className="agent-composer" onSubmit={(event) => void submit(event)}>
        <textarea autoFocus aria-label="Message AdPilot" value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submit(); } }} placeholder="Ask AdPilot about this account…" />
        <button type="submit" aria-label="Send" disabled={asking || prompt.trim().length < 3}>{asking ? <LoaderCircle className="spin" size={18} /> : <Send size={18} />}</button>
      </form>
      <p className="agent-safety-note">Read-only: AdPilot can analyze and draft plans, but cannot change campaigns or spend.</p>
    </section>
  </div>;
}

function AuditProgress({ job }: { job: AuditJobSnapshot }) {
  const report = job.report;
  return <div className="audit-progress">
    <div className="audit-progress-head"><div><span className="eyebrow">Live investigation</span><h3>Building your audit</h3></div><span>{job.stages.filter((stage) => stage.status === "done").length}/{job.stages.length}</span></div>
    <div className="audit-stage-list">{job.stages.map((stage) => <div key={stage.stage} className={`audit-stage ${stage.status}`}>
      <i>{stage.status === "running" ? <LoaderCircle className="spin" size={13} /> : stage.status === "done" ? <Check size={13} /> : stage.status === "error" ? <X size={13} /> : <Minus size={13} />}</i>
      <span>{stage.label}</span>{stage.error && <small>{stage.error}</small>}
    </div>)}</div>
    {report.summary && <div className="audit-partial-stats"><span><strong>{report.summary.campaigns}</strong> campaigns</span><span><strong>{report.summary.working}</strong> working</span><span><strong>{report.summary.significant}</strong> scored</span></div>}
    {report.winners?.length ? <div className="audit-partial"><strong>Working evidence</strong>{report.winners.slice(0, 3).map((row) => <span key={row.campaignId}>{row.name}<b>{row.verdict.label}</b></span>)}</div> : null}
    {report.creatives === undefined && job.stages.find((stage) => stage.stage === "creatives")?.status === "pending" ? <p className="audit-coming">Creative assets resolving…</p> : null}
  </div>;
}
