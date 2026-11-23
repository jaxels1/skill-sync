---
name: skill-sync
description: >-
  Audit, diff, check, and safely update all installed AI agent skills across
  Antigravity, Claude Code, Codex, Cursor, Gemini CLI, and skills.sh. Supports
  commands like /update all, /updates list, /update <name>, /updates diff
  <name>, /updates status, and /updates schedule. Scans both git-cloned skill
  repositories and npx skills lockfiles, skips dirty working trees, and
  summarizes upstream changes before pulling. Use when the user types /update,
  /updates, asks to update or sync skills, check for skill updates, or set up
  automatic skill updates.
---

# Skill Sync

Safely discover, inspect, diff, and update all installed `SKILL.md` skills across standard agent directories—covering both **git-cloned repositories** and **`npx skills` (`skills.sh`)** installs—without clobbering local edits or blindly pulling risky instruction changes.

## Commands

When the user invokes any of these commands (or equivalent natural language), run the matching workflow below using the bundled zero-dependency script `scripts/sync-skills.mjs`:

| Command | Action |
| :--- | :--- |
| **`/updates list`** | Dry-run check for available updates across git + `npx skills`, list every outdated skill, and **ask the user which ones to update** before applying. |
| **`/update all`** | Check and safely update **all** clean git-cloned skills (`git pull --ff-only`) and all `npx skills`-managed skills (`npx skills update -y`), skipping dirty/diverged repos. |
| **`/update <skill-name>`** | Update a single named skill (handles both git-cloned repos and `npx skills` packages). |
| **`/updates diff <skill-name>`** | Show upstream commits and full `git diff HEAD..@{u}` for a git-cloned skill before updating. |
| **`/updates status`** | Full inventory audit of all installed skills across all agent directories (git vs local, clean vs dirty, branch/upstream health). |
| **`/updates schedule`** | Guide the user to automate recurring checks/updates (via `/schedule` in Antigravity or a weekly GitHub Actions workflow). |

## Command Procedures

### `/updates list`
1. Run:
   ```bash
   node "<skill-dir>/scripts/sync-skills.mjs" --check --only-updates --include-npx
   ```
2. Present a clean numbered list of every skill with an available update (both git-cloned repos and `npx skills` entries), noting any dirty repos that have local edits.
3. Ask the user which skills they want to update (e.g., **Update all**, **Pick specific skills**, or **Skip for now**). Do not modify anything until the user confirms.

### `/update all`
1. First inspect available updates (`--check --only-updates --include-npx`) so you can flag any unexpected changes to `SKILL.md` or `scripts/`.
2. Apply safe fast-forward updates across all clean repos and `npx skills`:
   ```bash
   node "<skill-dir>/scripts/sync-skills.mjs" --apply --include-npx
   ```
3. Report a concise summary of **updated**, **up-to-date**, **skipped** (dirty/diverged), and **failed** skills.

### `/update <skill-name>`
Run targeted update for a single skill:
```bash
node "<skill-dir>/scripts/sync-skills.mjs" --apply --skill "<skill-name>" --include-npx
```

### `/updates diff <skill-name>`
Inspect upstream commits and diff before pulling:
```bash
node "<skill-dir>/scripts/sync-skills.mjs" --diff "<skill-name>"
```
Highlight any new external URLs, shell commands, hooks, or credential access added to `SKILL.md` or `scripts/`.

### `/updates status`
Run a full inventory scan across all agent roots:
```bash
node "<skill-dir>/scripts/sync-skills.mjs" --check --include-npx
```

### `/updates schedule`
- **Antigravity**: Recommend using `/schedule` to run `--check --only-updates --include-npx` daily or weekly and notify when updates are available.
- **GitHub Repos (CI)**: Suggest a weekly GitHub Actions workflow running `npx skills update -y` on a dedicated branch and opening a PR for review.

## Default Skill Roots Scanned

Global (`$HOME`): `~/.gemini/config/skills`, `~/.agents/skills`, `~/.claude/skills`, `~/.codex/skills`, `~/.cursor/skills`.
Project-local (`$PWD`): `./.agents/skills`, `./.claude/skills`, `./.gemini/skills`, `./.codex/skills`, `./.cursor/skills`.
Pass `--dir "<path>"` to include custom directories, or `--json` for machine-readable output.

## Safety Guarantees

- Never force-resets or auto-merges diverged git history (`git pull --ff-only` only).
- Automatically skips dirty working trees with uncommitted edits, detached `HEAD`, or repos without an upstream branch.
- Summarizes upstream commit titles and modified files so you stay aware of changes to agent instructions.
