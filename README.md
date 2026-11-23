# Skill Sync (`skill-sync`) — Auto-Update Agent Skill for `SKILL.md` & `skills.sh`

**Skill Sync (`skill-sync`)** is an open-source AI agent skill that audits, diffs, and safely updates all of your installed `SKILL.md` skills across Antigravity, Claude Code, OpenAI Codex, Cursor, Gemini CLI, and `skills.sh` (`npx skills`).

## Quick Install

Install via the open agent skills CLI (`skills.sh`):

```bash
npx skills add jaxels1/skill-sync
```

Or clone directly into your agent's skills directory:

```bash
# Global (Antigravity / Gemini)
git clone https://github.com/jaxels1/skill-sync.git ~/.gemini/config/skills/skill-sync

# Project-local (Claude Code / Codex / Cursor / universal .agents)
git clone https://github.com/jaxels1/skill-sync.git .agents/skills/skill-sync
```

## Commands

| Command | Description |
| :--- | :--- |
| **`/updates list`** | Dry-run check across all git-cloned and `npx skills` installs; lists everything that needs updating and asks which ones you want to update. |
| **`/update all`** | Safely updates all clean git-cloned skills (`git pull --ff-only`) and all `npx skills` packages (`npx skills update -y`). |
| **`/update <skill-name>`** | Updates a single named skill. |
| **`/updates diff <skill-name>`** | Displays upstream commit log and full `SKILL.md` / script diff before pulling. |
| **`/updates status`** | Full inventory audit of all installed skills across every agent directory (git vs local, clean vs dirty, upstream status). |
| **`/updates schedule`** | Sets up recurring background update checks (via `/schedule` or GitHub Actions). |

## Direct CLI Usage

The bundled zero-dependency Node.js script works identically on Windows, macOS, and Linux:

```bash
# List only skills with updates available
node scripts/sync-skills.mjs --check --only-updates --include-npx

# Update all clean skills
node scripts/sync-skills.mjs --apply --include-npx

# Update one specific skill
node scripts/sync-skills.mjs --apply --skill tactile-ui --include-npx

# Inspect upstream diff before pulling
node scripts/sync-skills.mjs --diff tactile-ui
```

## Safety Guarantees

- **Fast-forward only (`--ff-only`)**: Never force-resets or auto-merges diverged history.
- **Dirty-tree protection**: Automatically skips any skill repo with uncommitted local edits.
- **Diff transparency**: Summarizes upstream commits and modified files before/after pulling so agent instructions never change silently.

## Structure

```text
skill-sync/
├── SKILL.md
├── README.md
└── scripts/
    └── sync-skills.mjs
```
