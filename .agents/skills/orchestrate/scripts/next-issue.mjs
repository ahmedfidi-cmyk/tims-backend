#!/usr/bin/env node
// Prints the open, unassigned issues to work on as "number<TAB>title<TAB>spec|ready|triage",
// specs first, then bugs, then lowest number first. An issue qualifies at one stage:
// - spec: a parent spec (it has sub-issues, or another issue's "## Parent" section names it)
//   whose children are all closed, so it is due for verification.
// - ready: it has the READY label.
// - triage: a BUG with the TRIAGE label.
// Specs and triage bugs qualify only when filed by the repo's owner, a member, or a
// collaborator (a stranger's issue waits for a human). Drops issues with an open blocker
// (native, or a "Blocked by:" line) and specs with open children.
// Usage: next-issue.mjs READY BUG TRIAGE
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const TEAM = ["OWNER", "MEMBER", "COLLABORATOR"];

const parents = (issue) => [...(issue.body ?? "").matchAll(/## Parent\s+#(\d+)/g)].map((m) => Number(m[1]));

const blockers = (issue) =>
  (issue.body ?? "").split("\n").filter((l) => l.startsWith("Blocked by:")).flatMap((l) => [...l.matchAll(/#(\d+)/g)].map((m) => Number(m[1])));

export function pick(issues, ready, bug, triage) {
  issues = issues.filter((i) => !("pull_request" in i));
  const open = new Set(issues.filter((i) => i.state === "open").map((i) => i.number));
  const children = new Map();
  for (const i of issues) for (const p of parents(i)) children.set(p, [...(children.get(p) ?? []), i]);
  const labelled = (i, name) => i.labels.some((l) => l.name === name);

  const stageOf = (i) => {
    const team = TEAM.includes(i.author_association);
    const subs = i.sub_issues_summary ?? {};
    if ((subs.total ?? 0) > 0 || children.has(i.number)) {
      const done = (subs.completed ?? 0) === (subs.total ?? 0) && !(children.get(i.number) ?? []).some((c) => c.state === "open");
      return done && team ? "spec" : null;
    }
    if (labelled(i, ready)) return "ready";
    if (labelled(i, bug) && labelled(i, triage) && team) return "triage";
    return null;
  };
  const rank = (i) => (i.stage === "spec" ? 0 : labelled(i, bug) ? 1 : 2);

  return issues
    .map((i) => ({ ...i, stage: stageOf(i) }))
    .filter((i) =>
      i.stage && i.state === "open" &&
      i.assignees.length === 0 &&
      !(i.issue_dependencies_summary?.blocked_by > 0) &&
      !blockers(i).some((n) => open.has(n)))
    .sort((a, b) => rank(a) - rank(b) || a.number - b.number);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length !== 3) {
    console.error("usage: next-issue.mjs READY BUG TRIAGE");
    process.exit(1);
  }
  let out;
  try {
    out = execFileSync("gh", ["api", "repos/{owner}/{repo}/issues?state=all&per_page=100", "--paginate", "--slurp"], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  } catch {
    console.error("gh api failed");
    process.exit(1);
  }
  for (const i of pick(JSON.parse(out).flat(), ...args)) console.log(`${i.number}\t${i.title}\t${i.stage}`);
}
