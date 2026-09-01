"use client";

import { Fragment, useMemo, useState, type ReactNode } from "react";
import type { AgentPresentation } from "@/lib/agent/adpilot-agent";

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={index}>{part.slice(2, -2)}</strong> : <Fragment key={index}>{part.replaceAll("\\|", "|")}</Fragment>
  );
}

function cells(line: string) {
  const placeholder = "\u0000";
  return line.trim().replace(/^\||\|$/g, "").replaceAll("\\|", placeholder).split("|").map((cell) => cell.trim().replaceAll(placeholder, "|"));
}

export function AgentResponse({ content }: { content: string }) {
  const lines = content.split("\n");
  const nodes: ReactNode[] = [];
  for (let index = 0; index < lines.length;) {
    const line = lines[index].trim();
    if (!line) { index += 1; continue; }
    if (line.includes("|") && /^\s*\|?\s*:?-{3,}/.test(lines[index + 1] ?? "")) {
      const headers = cells(line); index += 2; const rows: string[][] = [];
      while (index < lines.length && lines[index].includes("|")) { rows.push(cells(lines[index])); index += 1; }
      nodes.push(<div className="agent-table-wrap" key={`table-${index}`}><table className="agent-response-table"><thead><tr>{headers.map((header, cell) => <th key={cell}>{inline(header)}</th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((value, cell) => <td key={cell}>{inline(value)}</td>)}</tr>)}</tbody></table></div>);
      continue;
    }
    if (/^#{1,3}\s/.test(line)) { const level = line.match(/^#+/)?.[0].length ?? 2; const copy = line.replace(/^#{1,3}\s+/, ""); nodes.push(level === 1 ? <h2 key={index}>{inline(copy)}</h2> : <h3 key={index}>{inline(copy)}</h3>); index += 1; continue; }
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = []; while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) { items.push(lines[index].replace(/^\s*[-*]\s+/, "")); index += 1; }
      nodes.push(<ul key={`list-${index}`}>{items.map((item, itemIndex) => <li key={itemIndex}>{inline(item)}</li>)}</ul>); continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = []; while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) { items.push(lines[index].replace(/^\s*\d+\.\s+/, "")); index += 1; }
      nodes.push(<ol key={`list-${index}`}>{items.map((item, itemIndex) => <li key={itemIndex}>{inline(item)}</li>)}</ol>); continue;
    }
    nodes.push(<p key={index}>{inline(line)}</p>); index += 1;
  }
  return <div className="agent-response">{nodes}</div>;
}

export function AgentReport({ report }: { report: AgentPresentation }) {
  const maxScore = Math.max(...report.leaders.map((item) => item.score), 1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState("spend");
  const campaigns = useMemo(() => report.campaigns
    .filter((campaign) => statusFilter === "all" || campaign.deliveryStatus.toLowerCase() === statusFilter)
    .sort((left, right) => sort === "score" ? (right.score ?? -1) - (left.score ?? -1) : right.spend - left.spend), [report.campaigns, sort, statusFilter]);
  const money = (value: number) => `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  const metric = (value: number | null) => value === null ? "—" : value.toFixed(2);
  return <div className="agent-report">
    <div className="agent-metric-grid">{report.metrics.map((metric) => <div key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.detail}</small></div>)}</div>
    {report.leaders.length > 0 && <section className="agent-chart"><h3>Strongest evidence by objective</h3>{report.leaders.map((item) => <div className="agent-chart-row" key={`${item.objective}-${item.name}`}><span title={item.name}>{item.name}</span><i><b style={{ width: `${Math.max(4, item.score / maxScore * 100)}%` }} /></i><strong>{Math.round(item.score * 100)} score</strong></div>)}</section>}
    {report.creatives.length > 0 && <section className="agent-creative-strip"><h3>Creative intelligence</h3><div>{report.creatives.map((creative) => <article key={creative.id}>{creative.assetUrl || creative.thumbnailUrl ? <img src={creative.assetUrl || creative.thumbnailUrl} alt={creative.name} /> : <span className="agent-creative-placeholder">Asset not returned</span>}<strong title={creative.name}>{creative.name}</strong><small>{creative.conversions} outcomes · {creative.ctr === null ? "CTR unavailable" : `${(creative.ctr * 100).toFixed(2)}% CTR`} · ${creative.spend.toFixed(0)} spend</small>{creative.headline && <small>{creative.headline}</small>}{creative.callToAction && <small>CTA: {creative.callToAction}</small>}<em>{creative.assetUrl ? "Full asset returned by Meta" : creative.thumbnailUrl ? "Thumbnail returned by Meta" : "Creative asset not returned by Meta"}</em></article>)}</div></section>}
    {report.campaigns.length > 0 && <section className="agent-evidence-explorer"><div className="agent-section-heading"><div><h3>Complete campaign evidence</h3><p>Every campaign returned for this audit. Spend rank is separate from performance rank.</p></div><div className="agent-table-controls"><label>Delivery <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All</option><option value="active">Active</option><option value="paused">Paused</option></select></label><label>Sort <select value={sort} onChange={(event) => setSort(event.target.value)}><option value="spend">Spend</option><option value="score">Score</option></select></label></div></div><div className="agent-table-wrap"><table className="agent-response-table agent-campaign-table"><thead><tr>{["Campaign","Objective","Delivery","Spend","ROAS","CPA","Freq.","Score","Tier","Verdict"].map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{campaigns.map((campaign) => <tr key={campaign.id}><td title={campaign.id}><strong>{campaign.name}</strong><small>{campaign.id}</small></td><td>{campaign.objective}</td><td>{campaign.deliveryStatus}</td><td>{money(campaign.spend)}</td><td>{metric(campaign.roas)}</td><td>{metric(campaign.cpa)}</td><td>{metric(campaign.frequency)}</td><td>{campaign.score === null ? "—" : `${Math.round(campaign.score * 100)}`}</td><td>{campaign.tier.replaceAll("_", " ")}</td><td>{campaign.verdict}</td></tr>)}</tbody></table></div><p className="agent-evidence-count">Showing {campaigns.length} of {report.campaigns.length} campaigns.</p></section>}
    {(report.adSets.length > 0 || report.ads.length > 0) && <section className="agent-hierarchy"><h3>Ad-set and ad evidence</h3><p>Meta returned hierarchy detail for the enriched campaigns. Expand a level to inspect delivery and outcomes.</p>{report.adSets.length > 0 && <details open><summary>Ad sets ({report.adSets.length})</summary><div className="agent-table-wrap"><table className="agent-response-table"><thead><tr><th>Ad set</th><th>Campaign ID</th><th>Spend</th><th>Outcomes</th><th>CTR</th><th>Frequency</th><th>Delivery</th></tr></thead><tbody>{report.adSets.map((row) => <tr key={row.id}><td>{row.name}<small>{row.id}</small></td><td>{row.campaignId || "—"}</td><td>{money(row.spend)}</td><td>{row.outcomes}</td><td>{row.ctr === null ? "—" : `${(row.ctr * 100).toFixed(2)}%`}</td><td>{metric(row.frequency)}</td><td>{row.deliveryStatus}</td></tr>)}</tbody></table></div></details>}{report.ads.length > 0 && <details><summary>Ads and creatives ({report.ads.length})</summary><div className="agent-table-wrap"><table className="agent-response-table"><thead><tr><th>Creative</th><th>Spend</th><th>Outcomes</th><th>CTR</th><th>Frequency</th><th>Asset</th></tr></thead><tbody>{report.ads.map((row) => <tr key={row.id}><td>{row.assetUrl || row.thumbnailUrl ? <img className="agent-table-thumb" src={row.assetUrl || row.thumbnailUrl} alt="" /> : null}<strong>{row.name}</strong><small>{row.id}</small></td><td>{money(row.spend)}</td><td>{row.outcomes}</td><td>{row.ctr === null ? "—" : `${(row.ctr * 100).toFixed(2)}%`}</td><td>{metric(row.frequency)}</td><td>{row.assetUrl || row.thumbnailUrl ? "Returned" : "Not returned"}</td></tr>)}</tbody></table></div></details>}</section>}
  </div>;
}
