import { Fragment, type ReactNode } from "react";
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
  return <div className="agent-report">
    <div className="agent-metric-grid">{report.metrics.map((metric) => <div key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.detail}</small></div>)}</div>
    {report.leaders.length > 0 && <section className="agent-chart"><h3>Strongest evidence by objective</h3>{report.leaders.map((item) => <div className="agent-chart-row" key={`${item.objective}-${item.name}`}><span title={item.name}>{item.name}</span><i><b style={{ width: `${Math.max(4, item.score / maxScore * 100)}%` }} /></i><strong>{Math.round(item.score * 100)} score</strong></div>)}</section>}
  </div>;
}
