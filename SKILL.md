---
name: skill-sync
description: >-
  Audit, diff, security-scan, and safely update installed AI agent skills
  (SKILL.md repositories and skills.sh / npx skills lockfiles) across
  Antigravity, Claude Code, Codex, Cursor, and Gemini CLI. Supports /update all,
  /updates list, /update <name>, /updates diff <name>, /updates status, and
  /updates schedule. Use only when the user wants to check, diff, update, or
  schedule updates for AI agent skills—do not trigger for application dependency
  or package updates (npm, pip, cargo, Docker, or OS packages).
---

# Skill Sync

Safely discover, security-scan, diff, and update installed `SKILL.md` skills across standard agent directories—covering both **git-cloned repositories** and **`npx skills` (`skills.sh`)** installs—without clobbering local edits or blindly pulling risky instruction changes.

## Resolving `<skill-dir>`

Resolve `scripts/sync-skills.mjs` relative to the directory containing this loaded `SKILL.md` file (`<skill-dir>/scripts/sync-skills.mjs`). If your host agent does not expose the loaded skill path directly, check these standard locations in order:
1. `~/.gemini/config/skills/skill-sync/scripts/sync-skills.mjs`
2. `~/.agents/skills/skill-sync/scripts/sync-skills.mjs`
3. `./.agents/skills/skill-sync/scripts/sync-skills.mjs`

## Commands

| Command | Action |
| :--- | :--- |
| **`/updates list`** | Dry-run scan across git + `npx skills`, listing every outdated skill (plus any security flags) and **asking the user which ones to update** before applying. |
| **`/update all`** | Pre-pull security-scans upstream diffs, updates all clean, low-risk git skills (`git pull --ff-only`) and `npx skills` installs, and **blocks** any git repo with high-risk diff findings until the user reviews and approves. |
| **`/update <skill-name>`** | Updates a single named skill (git or `npx skills`), enforcing the same pre-pull security gate. |
| **`/updates diff <skill-name>`** | Shows upstream commits, security scan findings, and full `git diff HEAD..@{u}` for a git-cloned skill before pulling. |
| **`/updates status`** | Full deduplicated inventory audit of all installed skills across all agent directories (git vs local, clean vs dirty, upstream status). |
| **`/updates schedule`** | Guides setting up recurring background checks/updates (via `/schedule` in Antigravity or a weekly GitHub Actions PR workflow). |

## Command Procedures

### `/updates list`
1. Run:
   ```bash
   node "<skill-dir>/scripts/sync-skills.mjs" --check --only-updates --include-npx
   ```
2. Present a clean numbered list of every skill with an available update (both git-cloned repos and `npx skills` entries), highlighting any dirty repos or `[security flag(s)]`.
3. Ask the user which skills to update (e.g., **Update all**, **Pick specific skills**, **Inspect diff first**, or **Skip**). Do not modify anything until confirmed.

### `/update all`
1. Run:
   ```bash
   node "<skill-dir>/scripts/sync-skills.mjs" --apply --include-npx
   ```
2. `sync-skills.mjs` automatically runs a **pre-pull diff security scan** on every outdated git skill *before* executing `git pull --ff-only`.
   - Any repo whose upstream diff adds external URLs, downloaders (`curl`/`wget`/`iwr`), shell/process execution, hook files, or environment/credential reads is **blocked** (`BLOCKED-SECURITY`) and left untouched.
   - If any skill is blocked, show the flagged lines (or run `--diff <name>`) and ask the user for explicit confirmation before re-running with `--apply --skill "<name>" --allow-risky`.
3. Report a concise summary of **updated**, **blocked-security**, **up-to-date**, **skipped** (dirty/diverged), and **failed** skills.

### `/update <skill-name>`
```bash
node "<skill-dir>/scripts/sync-skills.mjs" --apply --skill "<skill-name>" --include-npx
```
*(Add `--allow-risky` only after the user reviews flagged diff lines and confirms.)*

### `/updates diff <skill-name>`
```bash
node "<skill-dir>/scripts/sync-skills.mjs" --diff "<skill-name>"
```
Displays upstream commits, any triggered security findings, and the full diff before pulling.

### `/updates status`
```bash
node "<skill-dir>/scripts/sync-skills.mjs" --check --include-npx
```

### `/updates schedule`
- **Antigravity**: Recommend `/schedule` to run `--check --only-updates --include-npx` daily or weekly and notify when updates are available.
- **GitHub Repos (CI)**: Suggest a weekly GitHub Actions workflow running `npx skills update -y` on a dedicated branch and opening a pull request for review.

## Skill Root Scanning & Symlink Deduplication

Global (`$HOME`): `~/.gemini/config/skills`, `~/.agents/skills`, `~/.claude/skills`, `~/.codex/skills`, `~/.cursor/skills`.
Project-local (`$PWD`): `./.agents/skills`, `./.claude/skills`, `./.gemini/skills`, `./.codex/skills`, `./.cursor/skills`.

- **Symlink deduplication**: `sync-skills.mjs` resolves every discovered skill directory via `fs.realpathSync` and deduplicates by canonical target path, so cross-agent symlinks (e.g., `~/.claude/skills/foo → ~/.agents/skills/foo`) are only scanned, reported, and updated once.
- Pass `--dir "<path>"` (repeatable) to scan custom directories, or `--json` for machine-readable output.

## Safety Guarantees

- **Pre-pull security gate (git repos)**: Blocks automatic `git pull` when upstream diffs introduce new external URLs, downloaders, shell execution, hook files, or credential/env-var reads unless `--allow-risky` is explicitly passed after user review. *(Note: `npx skills update -y` updates `skills.sh` packages directly without a pre-pull diff scan; install skills via `git clone` if you want every update gated by the diff scanner.)*
- **Input validation**: `--skill` and `--diff` names are strictly validated against `/^[a-zA-Z0-9._-]+$/` (disallowing shell metacharacters and `..`).
- **Fast-forward only (`--ff-only`)**: Never force-resets or auto-merges diverged git history.
- **Dirty-tree protection**: Automatically skips repos with uncommitted local edits, detached `HEAD`, or no upstream tracking branch.
