# Verify a spec (session V)

A spec is a parent issue: its tickets are its sub-issues, or the issues whose `## Parent` section names it. Once the last ticket closes, check that the tickets together delivered what the spec asked for.

1. Show phase `verify`. Start the worker.
2. Prompt (`--wait`, no timeout) and wait for the worker: `Verify spec #N: all of its tickets are closed. The fixed point is the parent of the oldest commit on DEFAULT that references one of its tickets. From that fixed point, run the qa skill and then the code-review skill, with #N as the spec. Change no file. Then reply with the fixed point, both verdict lines, and one line per gap: each QA fail, and each verified P0 or P1 finding.`
3. No gap: run `gh issue close N --comment "Verified since <fixed point>: QA <verdict>, review <verdict>."`. Add each P2 or P3 finding to the friction log.
4. Gaps: prompt `File one ticket per gap as a child of #N, the way docs/agents/issue-tracker.md creates children, with acceptance criteria and the READY label. Reply with their numbers.` (`--wait`) and wait for the worker. The spec now has open tickets, so the loop implements them, and the spec comes back here once they close. If this is the spec's second verification in this run that found gaps, park the lane instead of filing.
5. Stop the worker, remove the worktree, and drop N from IN_FLIGHT. Report one line: `lane L: #N spec -> verified, closed` or `lane L: #N spec -> gaps #M, #M`. Go back to Pick the issue.
