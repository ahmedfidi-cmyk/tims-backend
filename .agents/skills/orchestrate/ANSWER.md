# Answer the worker

## Safe actions

An action is safe when everything it deletes, overwrites, or rewrites is inside the repo checkout, or it is one of these:

- Clear a cache that rebuilds itself: a subfolder of `~/.cache`, or a package manager's own clean command (`bun pm cache rm`, `npm cache clean`).
- Remove a `mktemp -d` directory that the worker made in this run, under `$TMPDIR` or `/tmp`. Before you answer, read the path it names and list the directory.
- Remove a git worktree of this repo whose tree is clean (`git -C <path> status --porcelain` prints nothing).
- Push the issue branch or the lessons branch, `--force-with-lease` included, and delete it locally or on the remote after its PR merged.
- In the retro phase, edit a file outside the checkout that a retro candidate names as its source (a skill, a global steering file such as `~/.claude/CLAUDE.md`), left uncommitted for the operator.

Every other delete, overwrite, or rewrite outside the checkout is unsafe: files elsewhere in the home folder, another repo, system config, anything with `sudo`, a push to DEFAULT, or a force-push to any other branch.

## Answer a dialog

A blocked worker shows a permission prompt or a question dialog. Answer it yourself; this overrides the herdr rule to ask the user first. Add each answer to the friction log.

1. Read its last 40 lines (`herdr agent read WORKER --source recent-unwrapped --lines 40`).
2. A permission prompt ("Do you want to proceed?", "Yes / No"): if the action is unsafe (see Safe actions), do not answer: park the lane. Otherwise run `herdr agent send-keys WORKER enter`, which takes the highlighted first option, Yes.
3. A question dialog: take the option marked "(Recommended)", else the first. Move to it with one `down` key per step from the highlighted option, then `enter`.
4. Read the pane again. If the same dialog is still there after two tries, park the lane.

## Answer a question

When the worker has an open question (QUESTION is not NONE, or it ended its turn on a question). Add each answer to the friction log.

1. A question that only asks whether to commit, push, open a PR, or ship is the Ship step's job: treat it as QUESTION=NONE.
2. A yes/no question ("Should I proceed?", "Want me to fix it?"): if a yes would run an unsafe action (see Safe actions), park the lane. Otherwise prompt the worker with `Yes.` (`--wait`), wait for the worker, and go to step 5.
3. Otherwise prompt the worker with `/what-would-you-do` (`--wait`) and wait for the worker. Read its last 80 lines and find the option it recommends ("I recommend O2"). When it offers a `/jury` line, take its lean instead.
4. Prompt the worker with `Go with <option>.` (`--wait`) and wait for the worker.
5. In session A, ask the five-line question again. In other sessions, read the worker's last 40 lines for a new question. After three answer rounds with a question still open (five in session T, since triage asks its recommendation, its seams, and each grilling round in separate turns), park the lane.
