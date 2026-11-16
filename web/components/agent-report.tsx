// web/components/agent-report.tsx
"use client";

import { useCallback, useEffect, useState } from "react";

import { api, ApiError, type Subscription, type TrackerFinding, type TrackerReport } from "../lib/api";
import { SMALL_BUTTON } from "../lib/styles";
import { AlertIcon, CheckCircleIcon, CrossCircleIcon } from "./icons";

const VERDICTS = {
  good: { label: "Good", Icon: CheckCircleIcon, color: "text-good" },
  needs_work: { label: "Needs work", Icon: AlertIcon, color: "text-warning" },
  problem: { label: "Problem", Icon: CrossCircleIcon, color: "text-critical" },
} as const;

function formatHours(hours: number | null): string {
  if (hours === null) return "—";
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  return `${hours.toLocaleString(undefined, { maximumFractionDigits: 1 })} h`;
}

function weekLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function StatTile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{value}</p>
      {note ? <p className="mt-1 text-xs text-muted">{note}</p> : null}
    </div>
  );
}

// Tasks per week as bars, with the week's average score written underneath:
// two measures, one axis.
function WeeklyBars({ report }: { report: TrackerReport }) {
  const most = Math.max(1, ...report.weeks.map((week) => week.tasks));
  return (
    <figure>
      <figcaption className="text-sm font-medium text-slate-200">Tasks per week, with the average review score</figcaption>
      <div className="mt-4 grid grid-cols-4 gap-2 border-b border-line" aria-hidden="true">
        {report.weeks.map((week) => {
          const height = week.tasks === 0 ? 0 : Math.max(6, Math.round((week.tasks / most) * 96));
          const summary = `Week of ${weekLabel(week.week_start)}: ${week.tasks} tasks, ${
            week.average_score === null ? "not reviewed" : `average score ${week.average_score}`
          }`;
          return (
            <div key={week.week_start} className="flex h-32 flex-col items-center justify-end" title={summary}>
              <span className="mb-1 text-xs tabular-nums text-slate-200">{week.tasks}</span>
              <span className="w-7 rounded-t-[4px] bg-brand" style={{ height: `${height}px` }} />
            </div>
          );
        })}
      </div>
      <div className="mt-2 grid grid-cols-4 gap-2 text-center" aria-hidden="true">
        {report.weeks.map((week) => (
          <div key={week.week_start}>
            <p className="text-xs text-muted">{weekLabel(week.week_start)}</p>
            <p className="text-xs tabular-nums text-slate-300">
              {week.average_score === null ? "No score" : `Score ${week.average_score}`}
            </p>
          </div>
        ))}
      </div>
      <table className="sr-only">
        <caption>Tasks and average review score per week</caption>
        <thead>
          <tr>
            <th scope="col">Week of</th>
            <th scope="col">Tasks</th>
            <th scope="col">Average score</th>
          </tr>
        </thead>
        <tbody>
          {report.weeks.map((week) => (
            <tr key={week.week_start}>
              <td>{weekLabel(week.week_start)}</td>
              <td>{week.tasks}</td>
              <td>{week.average_score ?? "Not reviewed"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

function Finding({ finding }: { finding: TrackerFinding }) {
  const verdict = VERDICTS[finding.verdict];
  return (
    <li className="rounded-xl border border-line bg-panel p-4">
      <div className="flex items-start gap-3">
        <verdict.Icon className={`mt-0.5 h-5 w-5 shrink-0 ${verdict.color}`} />
        <div className="min-w-0 flex-1">
          <p className="text-sm">
            <span className="font-semibold text-white">{verdict.label}</span>
            {finding.score !== null ? <span className="text-muted">, score {finding.score}</span> : null}
            {finding.topic ? <span className="text-slate-300">: {finding.topic}</span> : null}
          </p>
          {finding.feedback ? <p className="mt-1 text-sm leading-relaxed text-slate-300">{finding.feedback}</p> : null}
          {finding.owner_pushback ? <p className="mt-1 text-xs text-muted">You pushed back on this answer.</p> : null}
          {finding.question || finding.answer ? (
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer text-brand-soft">See the exchange</summary>
              <div className="mt-2 flex flex-col gap-2">
                {finding.question ? (
                  <p className="whitespace-pre-wrap break-words text-slate-300">
                    <span className="text-muted">You: </span>
                    {finding.question}
                  </p>
                ) : null}
                {finding.answer ? (
                  <p className="whitespace-pre-wrap break-words text-slate-300">
                    <span className="text-muted">Agent: </span>
                    {finding.answer}
                  </p>
                ) : null}
              </div>
            </details>
          ) : null}
        </div>
      </div>
    </li>
  );
}

// The tracker's report for one of my business agents. Only the owner sees it.
export function AgentReport({ sub }: { sub: Subscription }) {
  const [report, setReport] = useState<TrackerReport | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setReviewing(true);
    setError(null);
    try {
      setReport(await api.refreshReport(sub.id));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The report couldn't be updated. Please try again.");
    } finally {
      setReviewing(false);
    }
  }, [sub.id]);

  // Show the report straight away, then let waiting reviews catch up.
  useEffect(() => {
    let cancelled = false;
    api
      .report(sub.id)
      .then((first) => {
        if (cancelled) return;
        setReport(first);
        if (first.pending_reviews > 0) void refresh();
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof ApiError ? caught.message : "The report couldn't be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, [sub.id, refresh]);

  if (!report) {
    return error ? (
      <p role="alert" className="text-sm text-danger">
        {error}
      </p>
    ) : (
      <p className="text-sm text-muted">Loading the report…</p>
    );
  }

  return (
    <section aria-labelledby="report-heading" className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="report-heading" className="text-lg font-semibold text-white">
            Performance, last {report.period_days} days
          </h2>
          <p className="mt-1 text-sm text-muted">
            {report.reviewed === 0
              ? "No tasks reviewed yet."
              : `${report.reviewed} of ${report.tasks_handled} tasks reviewed.`}
            {report.last_reviewed_at
              ? ` Last review ${new Date(report.last_reviewed_at).toLocaleString(undefined, {
                  day: "numeric",
                  month: "short",
                  hour: "numeric",
                  minute: "2-digit",
                })}.`
              : ""}
          </p>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={reviewing} className={SMALL_BUTTON}>
          {reviewing ? "Reviewing…" : "Update report"}
        </button>
      </div>

      {reviewing && report.pending_reviews > 0 ? (
        <p role="status" className="text-sm text-slate-300">
          Reviewing {report.pending_reviews === 1 ? "1 new task" : `${report.pending_reviews} new tasks`}…
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      {report.tasks_handled === 0 ? (
        <p className="max-w-xl text-sm leading-relaxed text-muted">
          The tracker starts as soon as you work with {sub.agent.name}. Every answer is logged, and a sample is reviewed
          for quality: whether it dealt with your request, followed your instructions and used what it knows. You&apos;ll
          see the results here.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Tasks handled" value={report.tasks_handled.toLocaleString()} note={report.failed ? `${report.failed} failed to answer` : undefined} />
            <StatTile
              label="Quality score"
              value={report.average_score === null ? "—" : `${report.average_score}/100`}
              note={report.reviewed ? `From ${report.reviewed} reviewed` : "Waiting for reviews"}
            />
            <StatTile label="Time saved" value={formatHours(report.hours_saved)} note="Estimate" />
            <StatTile
              label="Average answer time"
              value={report.average_response_seconds === null ? "—" : `${report.average_response_seconds} s`}
            />
          </div>

          {report.reviewed > 0 ? (
            <div className="flex flex-col gap-3">
              <ul className="flex flex-wrap gap-x-6 gap-y-2" aria-label="Review results">
                {(["good", "needs_work", "problem"] as const).map((key) => {
                  const verdict = VERDICTS[key];
                  return (
                    <li key={key} className="flex items-center gap-2 text-sm">
                      <verdict.Icon className={`h-5 w-5 ${verdict.color}`} />
                      <span className="text-slate-200">{verdict.label}</span>
                      <span className="font-semibold tabular-nums text-white">{report[key]}</span>
                    </li>
                  );
                })}
              </ul>
              <ul className="flex flex-col gap-1 text-sm text-slate-300">
                {report.answered_rate !== null ? <li>Dealt with the request in {report.answered_rate}% of reviewed tasks.</li> : null}
                {report.instructions_rate !== null ? <li>Followed your instructions in {report.instructions_rate}% of them.</li> : null}
                {report.owner_pushbacks > 0 ? (
                  <li>You pushed back on {report.owner_pushbacks === 1 ? "1 answer" : `${report.owner_pushbacks} answers`}.</li>
                ) : null}
              </ul>
            </div>
          ) : null}

          <WeeklyBars report={report} />

          {report.findings.length > 0 ? (
            <div>
              <h3 className="text-base font-semibold text-white">Worth a look</h3>
              <ul className="mt-3 flex flex-col gap-3">
                {report.findings.map((finding) => (
                  <Finding key={finding.task_id} finding={finding} />
                ))}
              </ul>
            </div>
          ) : report.reviewed > 0 ? (
            <p className="text-sm text-slate-300">Nothing needs your attention in the reviewed tasks.</p>
          ) : null}
        </>
      )}

      <p className="text-xs leading-relaxed text-muted">
        Reviews are done by an AI reviewer ({report.reviewer}) on a sample of tasks, so scores are estimates. Time saved is
        the reviewer&apos;s estimate per task, applied to every task handled.
      </p>
    </section>
  );
}
