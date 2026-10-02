---
name: orchestrate
description: "Work through a repository's GitHub issues unattended in parallel lanes, driving worker Claude Code sessions in herdr panes and git worktrees to verify specs, triage bugs, implement, refactor, and merge each issue, and store the lessons of each run in the repo."
argument-hint: "[parallel runs]"
disable-model-invocation: true
compatibility: Designed for Claude Code. Requires herdr, gh, and Bun or Node.js 18.17 or later (built-in modules only). The notification uses osascript, so it shows on macOS only.
license: MIT
---

# orchestrate

You are the orchestrator. You do not write code. You pick issues, drive worker Claude Code sessions, and check their results. The work runs in LANES parallel lanes: each lane is a herdr pane beside yours and a git worktree of its own, and works one issue at a time. A spec whose tickets are all closed comes first: one worker session **V** checks the whole spec against the code (see [SPEC.md](SPEC.md)). Bugs come next, then the other tickets. Each ticket runs through up to four worker sessions, each with a fresh context:

1. **T**: `/triage #N`, only for a bug that is not triaged yet, to make it ready for an agent.
2. **A**: `/implement #N`, which QAs, reviews, and fixes its own work, then any fixes it left.
3. **B**: `/refactor`, then `/ship-pr` to merge.
4. **C**: `/retro` over A and B, then the lessons it finds, merged into the repo so the next `/implement` starts from them.

Repeat until a stop condition is met. Never ask the user anything, through a question tool or otherwise: answer every question and dialog as below.

## Setup

1. Run `test "${HERDR_ENV:-}" = 1`. If it fails, say you are not inside herdr and stop.
2. PROJECT is the repo folder name (`basename "$(git rev-parse --show-toplevel)"`) made into a valid herdr agent name: lowercase it, change each character outside `a-z`, `0-9`, `_` and `-` to `-`, drop leading characters that are not letters, and keep at most 20 characters. K is the lowest number from 1 up that no live agent in `herdr agent list` uses in the name `PROJECT-orch-K`, so several orchestrators in one project stay apart. Now, before any check that can stop, run `herdr agent rename "$HERDR_PANE_ID" PROJECT-orch-K` and `herdr pane report-metadata "$HERDR_PANE_ID" --source orchestrate --display-agent orchestrator`.
3. PREFIX is `supermatt:` when this skill's directory is inside `~/.claude/plugins/` (the installed plugin, whose skills are namespaced), and empty otherwise (skills linked into `~/.claude/skills`). Every skill you send a worker below, written `/name`, goes out as `/PREFIXname`: `/supermatt:implement #N` or `/implement #N`. A bare `/code-review` from the installed plugin would run Claude Code's bundled review instead of this one.
4. Run `herdr --skill` and follow its rules. Parse every ID from JSON output. Never close a tab or pane you did not create.
5. Read `docs/agents/issue-tracker.md` and `docs/agents/triage-labels.md`. If either is missing, or the tracker is not GitHub, say so and stop. READY, BUG, and TRIAGE are the label strings that `triage-labels.md` maps to the ready-for-agent, bug, and needs-triage roles.
6. Your working directory is the repo's main checkout. It stays on DEFAULT for the whole run; the workers work in the lanes' worktrees. DEFAULT is the output of `gh repo view --json defaultBranchRef --jq .defaultBranchRef.name`. Run `git switch DEFAULT && git pull --ff-only`. The tree must be clean. If it is not, stop. If `git check-ignore -q .claude/worktrees/x` fails, append the line `.claude/worktrees/` to `.git/info/exclude`, so the worktrees stay out of `git status`.
7. LANES is the number in the arguments, or 1 when there is none. RUN_START is `date -u +%Y-%m-%dT%H:%M:%SZ`. RUN is `bun` when `command -v bun` finds it, else `node`. Run `RUN <this skill's directory>/scripts/next-issue.mjs READY BUG TRIAGE` and print the queue it lists, so the operator sees what will run.
8. Open the lanes (see Lanes).

## Lanes

Lane L, from 1 to LANES, has a pane, a worker agent named `PROJECT-work-K-L`, and a worktree at `<repo root>/.claude/worktrees/orch-K-L`, inside the repo so Claude Code's folder trust carries over. Below, PANE, WORKER, and WT are the current lane's, and every git command about the lane's work runs as `git -C WT`. IN_FLIGHT is the set of issues the lanes hold, parked lanes included.

- **Open the lanes** once, at setup, as shell panes stacked in one column right of yours, with equal heights. Lane 1: `herdr pane split "$HERDR_PANE_ID" --direction right --no-focus --cwd "$PWD"`. Lane L above 1: `herdr pane split <lane L-1's pane> --direction down --ratio R --no-focus --cwd "$PWD"`, where R is 1/(LANES-L+2), the share lane L-1 keeps. Save each `.result.pane.pane_id`. The panes stay for the whole run.
- **Create the worktree** on branch B: `git fetch origin && git worktree add -b B WT origin/DEFAULT`, or `git worktree add --detach WT origin/DEFAULT` with no branch. Then copy each `.env*` file at the repo root from the main checkout to WT, when one exists: it is ignored, so a new worktree lacks it.
- **Remove the worktree**: if WT exists, `git worktree remove WT`, and if branch B is still local, `git branch -D B`. A worktree with changes refuses: then park the lane.
- **Park the lane**: stop driving it, ignore its later notifications, and leave its pane, worker, and worktree as they are. Its issue stays in IN_FLIGHT. If it holds the ship slot, release it. Send the notification (see On stop) with the title `PROJECT lane L needs you` and the reason as its body, and add the reason to the friction log. The other lanes go on.

## Run the lanes

Each lane runs the Loop on its own issue. Start by running Pick the issue for lanes 1 to LANES in order, so lane 1 takes the first issue in the queue. Then act on whichever lane's background wait notifies you, take that lane through its next steps up to its next wait, and wait again.

- A lane whose Pick finds nothing goes idle. Whenever an issue closes or a lane goes back to Pick, run Pick for every idle lane too: a closed issue can unblock others.
- The ship slot: one lane at a time runs from Sync to the end of Close out, and from the lessons sync to its merge, so no other merge lands between a branch's sync and its own merge. A lane that reaches Sync while another holds the slot waits for it.
- When every lane is idle or parked, stop (see Stop conditions).

## Worker

Each session runs its own model and effort:

| Session | Phases | Model | Effort |
|---|---|---|---|
| V | verify | `opus` | `xhigh` |
| T | triage | `opus` | `high` |
| A | implement, the QA and review restarts in step 3, fix | `sonnet` | `high` |
| B | refactor, ship | `opus` | `high` |
| C | retro, lessons | `opus` | `high` |

- **Start the worker**: `herdr pane run PANE "cd WT"`, then `herdr agent start WORKER --kind claude --pane PANE -- --model MODEL --effort EFFORT`, with MODEL and EFFORT from the current session's row, and `herdr pane report-metadata PANE --source orchestrate --display-agent "worker L"`. The shell can still be starting, or the last worker still exiting: if `agent start` returns `agent_pane_busy` or says the name is in use, run `sleep 3` and start it again, up to five times. If it returns `agent_not_ready`, a startup dialog such as folder trust holds the worker: answer it (see Answer a dialog).
- **Stop the worker**: add `herdr agent get WORKER` `.result.agent.agent_session.value` to SESSIONS (the issue's list of worker session IDs, for the retro), then `herdr agent prompt WORKER "/exit"`. The pane stays.
- **Restart the worker**: stop it, then start it.
- **Show phase P**: at the start of each phase below, set the lane's phase to `#N P` and run `herdr tab rename "$HERDR_TAB_ID" "<each busy lane's phase, joined by ' | '>"`.
- **Wait for the worker**: run every `herdr agent prompt ... --wait` as a background command, so the other lanes go on meanwhile. When it returns, run `herdr agent wait WORKER --until idle --until done --until blocked` in the background and let it notify you. The wait can return `done` between two turns while sub-agents are still running, so then run `sleep 15` and `herdr agent get WORKER`: if it is `working`, wait for the worker again. If the worker is `blocked`, answer the dialog (see Answer a dialog) and wait for the worker again.
- **Read the worker's reply**: `herdr agent read WORKER --source recent-unwrapped --lines <n>`. If that does not show the reply (the pane is scrolled up and shows a "new message" marker), read the last assistant text blocks from `~/.claude/projects/*/<session>.jsonl`, where `<session>` is `.result.agent.agent_session.value` from `herdr agent get WORKER`.

## Answers

When a worker is `blocked`, or has an open question (QUESTION is not NONE, or it ended its turn on a question), read [ANSWER.md](ANSWER.md): its Answer a dialog and Answer a question are the procedures the steps below name, and its Safe actions decide what you may approve.

## Loop

### 1. Pick the issue

If the operator asked you to pause, the lane goes idle. Otherwise run `RUN <this skill's directory>/scripts/next-issue.mjs READY BUG TRIAGE` in the main checkout. It lists the open, unassigned issues to work on, with an open blocker (native, or a `Blocked by:` line) dropped: specs whose tickets are all closed, then bugs, then the rest, lowest number first. Each line is `number<TAB>title<TAB>spec|ready|triage`. Specs and TRIAGE bugs count only when the repo's own team filed them.

Take the first line whose number is not in IN_FLIGHT. If there is none, the lane goes idle. Add N to IN_FLIGHT and say which issue you picked, as `lane L: #N title`. Empty SESSIONS. Create the worktree: with no branch for a `spec`; otherwise on branch `fix/N-<slug>` for an issue labelled BUG and `feat/N-<slug>` for any other, where slug is the title in lowercase kebab case, at most 40 characters. If its last column is `spec`, verify it: read [SPEC.md](SPEC.md). If it is `triage`, triage it first: read [TRIAGE.md](TRIAGE.md).

### 2. Implement (session A)

1. Show phase `implement`. Start the worker.
2. `herdr agent prompt WORKER "/implement #N" --wait` with no `--timeout`, then wait for the worker. This can take a long time.
3. Run `git -C WT log --oneline origin/DEFAULT..HEAD`. If it is empty, ask the five-line question from step 3. If QUESTION is not NONE, answer it, wait for the worker, and run this check again. Otherwise read the pane, report what the worker said, and park the lane.

### 3. Check the worker

Ask the worker, do not guess from scrollback:

```bash
herdr agent prompt WORKER "Reply with exactly five lines and nothing else. Line 1: BUSY=<yes if a background task or sub-agent you started is still running, else no>. Line 2: QA=<the verdict line of the last QA pass in this session, or NONE if none ran>. Line 3: REVIEW=<the verdict line of the code-review you ran in this session, or NONE if you did not run it>. Line 4: UNFIXED=<the code, or file:line if it has no code, of each verified finding and each QA fail that is still open: not fixed, and not settled by an answer to your question, or NONE>. Line 5: QUESTION=<a question you asked the user in this session that has no answer yet, or NONE>." --wait
herdr agent read WORKER --source recent-unwrapped --lines 40
```

- BUSY=yes: run `sleep 60` in the background, then ask again. If BUSY is still yes after 30 minutes, park the lane.
- QUESTION is not NONE: answer it (see Answer a question).
- QA=NONE: run `git -C WT log --format=%s origin/DEFAULT..HEAD`. If every subject has the type `refactor`, the branch changes nothing a user can see: QA is `skipped, refactor only`. Otherwise restart the worker, prompt it with `/qa origin/DEFAULT #N` (`--wait`, no timeout), and wait for the worker. Ask it the same five-line question.
- REVIEW=NONE: restart the worker, prompt it with `/code-review` (`--wait`, no timeout), and wait for the worker. Ask it the same five-line question.

### 4. Fix findings

If UNFIXED is not NONE, show phase `fix`, prompt the current worker with `/fix-findings <the UNFIXED value>` (`--wait`) and wait for the worker. Then ask the five-line question again, and answer any open question. A finding that `/fix-findings` settled with no edit, because the option it applied (its own recommendation, or what the issue asks for) keeps the code as it is, counts as fixed. If UNFIXED still names a finding that is open, park the lane. Then prompt `/commit` (`--wait`) and wait for the worker, so the tree is clean for session B.

### 5. Refactor (session B)

1. Show phase `refactor`. Restart the worker.
2. Prompt `/refactor the changes on this branch since origin/DEFAULT` (`--wait`, no timeout) and wait for the worker. Its questions and plan approval go through Answer a dialog and Answer a question.
3. If `git -C WT status --porcelain` prints anything, prompt `/commit` (`--wait`) and wait for the worker.

### 6. Sync

Other lanes may have merged since this branch started. Wait for the ship slot (see Run the lanes), then bring the branch onto the current DEFAULT. The branch is not pushed yet, so a rebase rewrites nothing shared.

1. Show phase `sync`. Run `git -C WT fetch origin && git -C WT rebase origin/DEFAULT`. If it rebased clean, go to Ship.
2. It stopped on conflicts: add `#N rebase conflicts in <files>` to the friction log, prompt the current worker with `/resolving-merge-conflicts` (`--wait`, no timeout), and wait for the worker. The rebase is done when `git -C WT status` no longer reports a rebase in progress and `git -C WT status --porcelain` prints nothing. If it is not, park the lane.
3. The resolved code is code that no QA pass ran: prompt `/qa origin/DEFAULT #N` (`--wait`, no timeout), wait for the worker, and ask the five-line question from step 3. If its QA line has a fail, park the lane. That QA line replaces the one from step 3 in Ship.

### 7. Ship

1. Show phase `ship`. Prompt the current worker with `/ship-pr QA of this branch stands: <the QA line from Sync, or else from step 3>` (`--wait`, no timeout), then wait for the worker. Session B holds no record of the QA pass of session A and otherwise runs it again.
2. Read its last 60 lines. Find the PR URL and whether it merged.
3. Confirm with `gh pr view <url> --json state,mergedAt`. If the state is not MERGED (red CI, refused push, anything else), park the lane with the reason. Do not retry and do not fix.

### 8. Close out

1. If issue N is still open, run `gh issue close N --comment "Merged in <PR URL>."`. A closed issue unblocks the issues that wait on it.
2. In the main checkout: `git pull --ff-only`. The tree must be clean.
3. Remove the worktree (`/ship-pr` may have removed it already, to merge from the main checkout). Release the ship slot.
4. Create the worktree on branch `chore/lessons-N`, for the retro's changes.

### 9. Retro (session C)

1. Show phase `retro`. Restart the worker.
2. Prompt `/retro the sessions <SESSIONS>, each at ~/.claude/projects/*/<id>.jsonl` (`--wait`, no timeout) and wait for the worker.
3. Prompt `Apply every surviving candidate, most severe first, a check before a rule, including those whose source is outside this repo. Do not commit. Then list each candidate, one per line, as applied or not applied, with its target file and, if not applied, why.` (`--wait`) and wait for the worker.
4. Add each applied candidate whose target file is outside the checkout to OUTSIDE (the run's list of outside changes: file, issue, one line on what changed). Add each candidate not applied to the friction log.

### 10. Store the lessons

Show phase `lessons`. Run `git -C WT status --porcelain`.

- Nothing changed: LESSONS is `none`. Remove the worktree and go to Report.
- Anything changed: prompt `/commit lessons from #N` (`--wait`) and wait for the worker. Wait for the ship slot, then run the rebase of Sync step 1, and Sync step 2 on conflicts (no QA: lessons change no behavior). Prompt `/ship-pr lessons from #N` (`--wait`, no timeout) and wait for the worker. Do not add `[skip ci]`: a ruleset that requires checks blocks the merge of a PR whose checks never ran.

Find the PR URL in the worker's last 60 lines and confirm with `gh pr view <url> --json state`. If it is not MERGED, park the lane with the reason. LESSONS is the PR URL. In the main checkout, run `git pull --ff-only`. Remove the worktree and release the ship slot.

### 11. Report

1. Stop the worker. Drop N from IN_FLIGHT.
2. Run `gh issue list --state all --search "created:>=RUN_START" --json number,title` and add each issue not yet in the friction log as `filed #M title`. Workers file bugs they find outside their issue; the next pick takes them first.
3. Report one line: `lane L: #N -> <PR URL>, merged, QA <verdict>, review <verdict>, lessons <LESSONS>`.
4. Go back to Pick the issue.

## Operator

- **Pause**: the operator can type into your pane while you work. A request to pause or stop means every busy lane finishes its current issue through Report and no lane picks a new one; then stop. A request to stop now means stop at once.
- **Friction log**: keep a running list across issues, each entry with its lane and issue: each dialog and question you answered (phase, what you chose), each `--wait` that returned `timeout` or `agent_prompt_stalled`, each restart of the worker outside Refactor and Retro, each rebase conflict, each parked lane and its reason, each unapplied retro candidate, each triage outcome other than READY, and each issue filed during the run. Print it when you stop; it is the operator's input for tuning this skill.
- **On stop**: send one macOS notification, then print the reason, the friction log, and OUTSIDE: each changed file with its issue and what changed, grouped by repo, then `git -C <repo> diff --stat` for each repo, so the operator can review and commit them. The operator is notified only here and when a lane parks: when the run is finished, or when it needs them.
  - No lane is parked: title `PROJECT done`, body `<count> issues merged, <count> filed`.
  - A lane is parked, or Setup failed: title `PROJECT needs you`, body the reason, or each parked lane with its issue and reason.

  Pass the text as arguments, so quotes in a reason cannot break the script: `osascript -e 'on run argv' -e 'display notification (item 2 of argv) with title (item 1 of argv) sound name "Glass"' -e 'end run' "TITLE" "BODY"`.

## Stop conditions

Park the lane when: triage left a bug untriaged, a spec found gaps on its second verification, `/implement` made no commits, a question stays open after three answer rounds, a dialog stays open after two answers, the worker asks to run an unsafe action, findings stay unfixed after `/fix-findings`, a rebase stays unfinished after `/resolving-merge-conflicts` or its QA fails, the PR or the lessons PR does not merge, a worktree with changes refuses removal, or a herdr, gh, or git command about the lane fails.

Stop the run when every lane is idle or parked: the queue has nothing left that no lane holds, or the operator paused. Stop it at once when a Setup step fails or a herdr command about the run itself fails. On stop, close the panes of idle lanes, and leave the panes and worktrees of parked lanes open, so the operator can inspect them.

## Rules

- One issue per lane, so at most LANES in flight. A lane starts its next issue only after its issue and lessons are merged.
- One lane at a time holds the ship slot.
- Never remove a worktree the run did not create.
- Run unattended. Never hand a question or dialog to the user; answer it as above.
- If a `--wait` returns `timeout` or `agent_prompt_stalled`, read the pane before you do anything, since the prompt may have landed.
