"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, Bot, LoaderCircle, Send, Sparkles, TriangleAlert } from "lucide-react";
import { AgentReport, AgentResponse } from "./agent-response";
import type { AgentPresentation } from "@/lib/agent/adpilot-agent";

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
      const body = await response.json() as { answer?: string; message?: string; error?: string; toolTrace?: Array<{ tool: string; status: "ok" | "error" }>; presentation?: AgentPresentation };
      if (!response.ok || !body.answer) throw new Error(body.message || body.error || "AdPilot could not complete that request.");
      const tools = [...new Set((body.toolTrace ?? []).filter((item) => item.status === "ok").map((item) => item.tool))];
      setMessages((current) => [...current, { role: "assistant", content: body.answer!, tools, presentation: body.presentation }]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "AdPilot could not complete that request.");
    } finally {
      setAsking(false);
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
        {asking && <article className="chat-message assistant"><div><Bot size={17} /></div><p className="agent-thinking"><LoaderCircle className="spin" size={15} /> Reading live Meta data and choosing tools…</p></article>}
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
