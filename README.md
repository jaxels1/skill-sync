<p align="left">
  <img src="./assets/logo.svg" alt="skill-sync logo" width="64" height="64" />
</p>

# Skill Sync (`skill-sync`) — Auto-Update Agent Skill for `SKILL.md` & `skills.sh`

**Skill Sync (`skill-sync`)** is an open-source AI agent skill that audits, diffs, and safely updates all of your installed `SKILL.md` skills across Antigravity, Claude Code, OpenAI Codex, Cursor, Gemini CLI, and `skills.sh` (`npx skills`).

![skill-sync demo](./assets/demo.gif)

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

- **Pre-pull security gate (git repos)**: Automatically scans upstream diffs *before* pulling and blocks any git skill adding new external URLs, downloaders (`curl`/`wget`/`iwr`), shell execution, hook files, or env/credential reads (`BLOCKED-SECURITY`) until reviewed and explicitly approved with `--allow-risky`. *(Note: `npx skills update -y` delegates directly to the `skills.sh` CLI without a pre-pull diff scan; install via `git clone` if you want every update diff-gated.)*
- **Strict input validation**: `--skill` and `--diff` arguments are validated against `/^[a-zA-Z0-9._-]+$/` before invoking subprocesses.
- **Fast-forward only (`--ff-only`)**: Never force-resets or auto-merges diverged history.
- **Dirty-tree protection**: Automatically skips any skill repo with uncommitted local edits or detached `HEAD`.
- **Symlink deduplication**: Resolves canonical paths via `fs.realpathSync` so cross-agent symlinks (e.g. `~/.claude/skills/foo → ~/.agents/skills/foo`) are checked and updated once without duplicates.

## Structure

```text
skill-sync/
├── SKILL.md
├── README.md
├── assets/
│   └── logo.svg
└── scripts/
    └── sync-skills.mjs
```
