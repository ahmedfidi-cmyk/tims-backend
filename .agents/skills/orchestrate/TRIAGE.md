# Triage a bug (session T)

1. Show phase `triage`. Start the worker.
2. Prompt `/triage #N. I am away: where you would ask me, decide with the option you recommend. The goal is an agent brief and the READY label, unless the evidence says otherwise.` (`--wait`, no timeout) and wait for the worker. Its questions go through Answer a question: take the clear answer yourself, and use `/what-would-you-do` when the choice is not clear.
3. Run `gh issue view N --json state,labels`.
   - Open with READY: stop the worker (its session stays in SESSIONS for the retro), and go on to Implement.
   - Still TRIAGE: park the lane.
   - Anything else (closed, needs-info, ready-for-human, wontfix): add `#N triaged as <label or closed>` to the friction log, stop the worker, remove the worktree, drop N from IN_FLIGHT, and go back to Pick the issue.
