import { useState } from "react";
import { allIssues } from "../../core/inspect";
import { RULES, ruleInfo } from "../../core/checks";
import type { Report } from "../../core/types";

/** All findings with a rule filter; clicking a row selects that sample. */
export function IssueTable({ report, onSelect }: { report: Report; onSelect: (line: number) => void }) {
  const [rule, setRule] = useState("");
  const issues = allIssues(report).filter((i) => !rule || i.rule === rule);
  const present = RULES.filter((r) => report.summary.ruleCounts[r.id]);
  return (
    <section className="panel">
      <h2>문제 표</h2>
      <label>
        규칙 필터{" "}
        <select value={rule} onChange={(e) => setRule(e.target.value)} aria-label="규칙 필터">
          <option value="">전체 ({allIssues(report).length})</option>
          {present.map((r) => (
            <option key={r.id} value={r.id}>
              {r.id} {r.ko} ({report.summary.ruleCounts[r.id]})
            </option>
          ))}
        </select>
      </label>
      {issues.length === 0 ? (
        <p className="muted">문제가 없습니다.</p>
      ) : (
        <table className="issues">
          <thead>
            <tr><th>규칙</th><th>줄</th><th>설명</th></tr>
          </thead>
          <tbody>
            {issues.map((i, idx) => (
              <tr key={idx} className={i.severity} onClick={() => i.line !== null && onSelect(i.line)} style={{ cursor: i.line === null ? "default" : "pointer" }}>
                <td><span className={`badge ${i.severity}`}>{i.rule}</span> {ruleInfo(i.rule)?.ko}</td>
                <td>{i.line ?? "템플릿"}</td>
                <td>{i.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
