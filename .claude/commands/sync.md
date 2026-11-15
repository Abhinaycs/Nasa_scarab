---
description: "Pull teammate's work, run quick checks, commit and push your own"
---
Sync this repo with GitHub safely. Message hint: $ARGUMENTS

1. Run `git status`. Stage only the files you meant to change. Never stage `.env`, `data/raw/`, `data/work/`, `node_modules/` or anything over 50 MB.
2. If there are changes, commit them with a short message prefixed with the track (`s:` or `a:`) and using the hint above if one was given.
3. Run `git pull --rebase`. If there are conflicts:
   - For files you own (see CLAUDE.md Layout), keep your version.
   - In docs/CONTRACT.md, merge both sides carefully.
   - Then continue the rebase.
4. Quick checks, only for the parts that exist: `cd frontend && npm run build`; `.venv/bin/python -m pytest backend/tests -q`.
5. Run `git push`.
6. Summarize what the teammate pushed since the last sync (`git log --oneline ORIG_HEAD..HEAD`, plus the checkboxes in their tasks file), and say whether docs/CONTRACT.md changed.
