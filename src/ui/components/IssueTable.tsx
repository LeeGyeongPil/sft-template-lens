import { useState } from "react";
import { allIssues } from "../../core/inspect";
import { RULES, ruleInfo } from "../../core/checks";
import type { Report } from "../../core/types";
import { ruleLabel } from "../../i18n";
import { useLang } from "../lang";

/** All findings with a rule filter; clicking a row selects that sample. */
export function IssueTable({ report, onSelect }: { report: Report; onSelect: (line: number) => void }) {
  const { lang, m } = useLang();
  const [rule, setRule] = useState("");
  const issues = allIssues(report).filter((i) => !rule || i.rule === rule);
  const present = RULES.filter((r) => report.summary.ruleCounts[r.id]);
  return (
    <section className="panel">
      <h2>{m.issuesTitle}</h2>
      <label>
        {m.ruleFilter}{" "}
        <select value={rule} onChange={(e) => setRule(e.target.value)} aria-label={m.ruleFilter}>
          <option value="">{m.filterAll(allIssues(report).length)}</option>
          {present.map((r) => (
            <option key={r.id} value={r.id}>
              {r.id} {ruleLabel(r, lang)} ({report.summary.ruleCounts[r.id]})
            </option>
          ))}
        </select>
      </label>
      {issues.length === 0 ? (
        <p className="muted">{m.noIssues}</p>
      ) : (
        <table className="issues">
          <thead>
            <tr><th>{m.thRule}</th><th>{m.thLine}</th><th>{m.thDesc}</th></tr>
          </thead>
          <tbody>
            {issues.map((i, idx) => (
              <tr key={idx} className={i.severity} onClick={() => i.line !== null && onSelect(i.line)} style={{ cursor: i.line === null ? "default" : "pointer" }}>
                <td><span className={`badge ${i.severity}`}>{i.rule}</span> {ruleInfo(i.rule) && ruleLabel(ruleInfo(i.rule)!, lang)}</td>
                <td>{i.line ?? m.templateWord}</td>
                <td>{i.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
