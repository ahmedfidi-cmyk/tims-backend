---
name: ship-pr
description: "Commit, push, open a pull request, wait for green CI, then squash merge and close the issues it finishes."
argument-hint: "[message hint]"
disable-model-invocation: true
compatibility: Requires git and an authenticated gh CLI.
license: MIT
---

Commit every change, push, open a pull request, and merge it once CI is green. Never commit onto the default branch. The arguments, if any, are a hint at what the change is about, not the message itself.

Start from the session's working directory. When this session's work sits in another worktree (`git worktree list`), run every step there with `git -C <path>` and leave the working directory's changes untouched.

1. Run `git status --short --branch`, `git diff HEAD --stat`, `git log --oneline origin/HEAD..HEAD` (the branch commits), `git log --oneline -10`, and `gh api 'repos/{owner}/{repo}/actions/permissions' --jq .enabled` (whether Actions is enabled). Read the full diff (`git diff HEAD`), every untracked file `git status` lists, and, when there are branch commits, their diff (`git diff origin/HEAD...HEAD`) before writing anything. Read each issue the branch commits reference (`#N`) with the **Read an issue** operation in `docs/agents/issue-tracker.md`, since its comments hold the triage brief, or with `gh issue view N --json title,body,comments` when that file is missing.
2. Scan it for credentials, tokens, private keys, and any value that does not belong in this repository. If you find one, stop, commit nothing, and report what you found.
3. If the current branch is the repository's default branch, create and switch to a new one first: `type/kebab-description`, where `type` matches the Conventional Commit type you are about to use and the description comes from the change itself. Any branch commits move to the new branch with it: then run `git branch -f <default> origin/<default>` so the default branch matches its remote and the merge can fast-forward it.
4. Stage the changes. Prefer explicit paths over `git add -A`. An untracked directory that holds a local tool's state (an index, cache, or database, such as `.codegraph/`) belongs in the root `.gitignore`, even when it ships its own `.gitignore`: add its path there, stage that line with the rest, and say so in the report.
5. Write a Conventional Commit `type(scope): description`, matching the subject style already in `git log`. When the `oss-writing` skill is installed, call the Skill tool with it for the wording.
6. Commit, then `git push -u origin HEAD` with a 10-minute timeout: a pre-push hook can run the whole test suite.
7. `gh pr create`. The squash merge makes the title the one commit on the default branch, so the title and body cover the whole branch: your commit's subject when it is the branch's only commit, otherwise one Conventional Commit subject spanning every commit. Use the repository's pull request template when it has one. Otherwise, call the Skill tool with "pr" for the body, and call it again with "oss-writing" for the wording when that skill is installed, even when no commit was written in step 5.
8. Actions enabled `false` in step 1 means the repository runs no CI: skip the watch and treat it as green. Otherwise, `gh pr checks --watch` until every check settles. It exits non-zero on failure, so allow that and read the result. CI takes a few seconds to register a new pull request, so when it reports no checks, `sleep 20` and watch again. No checks the second time means the branch runs no CI: treat it as green.
9. Green: `gh pr merge --squash --delete-branch`. When the branch is checked out in a worktree, `--delete-branch` cannot delete it: first confirm `git -C <worktree> status --short` is empty, then remove the worktree and merge in one shell call that starts in the main checkout (`cd <main checkout> && git worktree remove <worktree> && gh pr merge ...`), since removing the session's own worktree deletes the working directory the next call would start in. Red: stop, name the failing check and the reason, and merge nothing. Do not retry, do not fix, do not merge past a failure.
10. Merged: close each issue the branch commits reference (`#N`, or a local issue path) that is still open, since the merge is what finishes it and a closed issue unblocks the tickets that wait on it. Use the **Close** operation in `docs/agents/issue-tracker.md` with the comment `Merged in <PR URL>.`, or `gh issue close N --comment` when that file is missing.
11. Report the PR URL, whether it merged, each issue you closed, and the `.gitignore` line from step 4 if you added one.
