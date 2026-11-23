#!/usr/bin/env node
/**
 * skill-sync: Zero-dependency cross-platform checker, security scanner, differ,
 * and fast-forward updater for git-cloned AI agent skills and `npx skills` (skills.sh).
 *
 * Usage:
 *   node sync-skills.mjs [--check | --apply] [--only-updates] [--include-npx]
 *                        [--allow-risky] [--skill <name>]... [--diff <name>]
 *                        [--dir <path>]... [--json]
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const applyMode = args.includes("--apply");
const includeNpx = args.includes("--include-npx");
const onlyUpdates = args.includes("--only-updates");
const allowRisky = args.includes("--allow-risky");
const jsonMode = args.includes("--json");

const customDirs = [];
const targetSkills = [];
let diffTarget = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--dir" && args[i + 1]) {
    customDirs.push(path.resolve(args[i + 1]));
    i++;
  } else if (args[i] === "--skill" && args[i + 1]) {
    targetSkills.push(args[i + 1].toLowerCase());
    i++;
  } else if (args[i] === "--diff" && args[i + 1]) {
    diffTarget = args[i + 1].toLowerCase();
    i++;
  }
}

const home = os.homedir();
const cwd = process.cwd();

const defaultRoots = [
  path.join(home, ".gemini", "config", "skills"),
  path.join(home, ".agents", "skills"),
  path.join(home, ".claude", "skills"),
  path.join(home, ".codex", "skills"),
  path.join(home, ".cursor", "skills"),
  path.join(cwd, ".agents", "skills"),
  path.join(cwd, ".claude", "skills"),
  path.join(cwd, ".gemini", "skills"),
  path.join(cwd, ".codex", "skills"),
  path.join(cwd, ".cursor", "skills"),
  ...customDirs,
];

const SECURITY_PATTERNS = [
  { id: "external-url", label: "New external URL", regex: /https?:\/\/[^\s"'`<>)]+/i },
  {
    id: "network-fetch",
    label: "Network download / pipe-to-shell",
    regex: /\b(curl|wget|Invoke-WebRequest|Invoke-RestMethod|iwr|irm)\b/i,
  },
  {
    id: "shell-exec",
    label: "Process / shell execution",
    regex: /\b(child_process|spawnSync|execSync|execFile|eval\(|os\.system|subprocess|powershell|cmd\.exe|bash\s+-c|sh\s+-c)\b/i,
  },
  {
    id: "credential-access",
    label: "Environment / credential access",
    regex: /(\bprocess\.env\b|\$env:|API_KEY|SECRET|ACCESS_TOKEN|PRIVATE_KEY|\.ssh\/|\.aws\/|\.npmrc|keychain|keyring)/i,
  },
];

function run(cmd, cmdArgs, options = {}) {
  if (process.platform === "win32" && cmd === "npx") {
    return spawnSync("cmd.exe", ["/d", "/s", "/c", "npx", ...cmdArgs], {
      encoding: "utf8",
      windowsHide: true,
      ...options,
    });
  }
  return spawnSync(cmd, cmdArgs, {
    encoding: "utf8",
    windowsHide: true,
    ...options,
  });
}

function discoverSkillDirs(roots) {
  const seen = new Set();
  const found = [];

  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    let entries;
    try {
      entries = fs.readdirSync(root, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
      if (entry.name.startsWith(".")) continue;
      const fullPath = path.join(root, entry.name);
      let realPath = fullPath;
      try {
        // Deduplicate symlinked cross-agent skill directories by realpath
        realPath = fs.realpathSync(fullPath);
      } catch {
        continue;
      }
      if (seen.has(realPath)) continue;
      if (!fs.existsSync(path.join(realPath, "SKILL.md"))) continue;
      seen.add(realPath);
      found.push({ name: entry.name, path: realPath, root });
    }
  }
  return found;
}

function scanUpstreamDiffForRisks(skillPath, upstream, changedFiles) {
  const flags = [];

  for (const file of changedFiles) {
    if (/^hooks\//i.test(file) || /hooks\.json$/i.test(file)) {
      flags.push({
        id: "hook-modified",
        label: "Hook file added/modified",
        file,
        snippet: file,
      });
    }
  }

  const diffRes = run("git", ["-C", skillPath, "diff", "-U0", `HEAD..${upstream}`]);
  const lines = (diffRes.stdout || "").split(/\r?\n/);
  let currentFile = "";

  for (const line of lines) {
    if (line.startsWith("+++ b/")) {
      currentFile = line.slice(6).trim();
      continue;
    }
    if (!line.startsWith("+") || line.startsWith("+++")) continue;
    const added = line.slice(1);
    for (const pat of SECURITY_PATTERNS) {
      if (pat.regex.test(added)) {
        flags.push({
          id: pat.id,
          label: pat.label,
          file: currentFile || "unknown",
          snippet: added.trim().slice(0, 140),
        });
        break;
      }
    }
    if (flags.length >= 25) break;
  }

  return flags;
}

function showGitDiff(skill) {
  const gitDir = path.join(skill.path, ".git");
  if (!fs.existsSync(gitDir)) {
    console.log(`[${skill.name}] Not a git repository (${skill.path}).`);
    return;
  }
  const upstreamRes = run("git", [
    "-C",
    skill.path,
    "rev-parse",
    "--abbrev-ref",
    "--symbolic-full-name",
    "@{u}",
  ]);
  if (upstreamRes.status !== 0) {
    console.log(`[${skill.name}] No upstream tracking branch configured.`);
    return;
  }
  const upstream = upstreamRes.stdout.trim();
  run("git", ["-C", skill.path, "fetch", "--quiet"]);
  const logRes = run("git", ["-C", skill.path, "log", "--oneline", `HEAD..${upstream}`]);
  const filesRes = run("git", ["-C", skill.path, "diff", "--name-only", `HEAD..${upstream}`]);
  const diffRes = run("git", ["-C", skill.path, "diff", `HEAD..${upstream}`]);
  const commits = (logRes.stdout || "").trim();
  const changedFiles = (filesRes.stdout || "").trim().split(/\r?\n/).filter(Boolean);
  const diff = (diffRes.stdout || "").trim();
  if (!commits && !diff) {
    console.log(`[${skill.name}] Already up to date with ${upstream}.`);
    return;
  }
  const securityFlags = scanUpstreamDiffForRisks(skill.path, upstream, changedFiles);
  console.log(`=== ${skill.name} (${skill.path}) vs ${upstream} ===\n`);
  if (commits) console.log("Commits:\n" + commits + "\n");
  if (securityFlags.length > 0) {
    console.log(`Security Scan Findings (${securityFlags.length}):`);
    for (const f of securityFlags) {
      console.log(`  - [${f.label}] (${f.file}): ${f.snippet}`);
    }
    console.log("");
  }
  if (diff) console.log("Diff:\n" + diff);
}

function inspectAndSyncGitSkill(skill) {
  const gitDir = path.join(skill.path, ".git");
  if (!fs.existsSync(gitDir)) {
    return {
      name: skill.name,
      path: skill.path,
      type: "local",
      status: "unmanaged",
      detail: "Not a git repository (managed manually or via npx skills)",
    };
  }

  const branchRes = run("git", ["-C", skill.path, "rev-parse", "--abbrev-ref", "HEAD"]);
  const branch = (branchRes.stdout || "").trim();
  if (branchRes.status !== 0 || branch === "HEAD") {
    return {
      name: skill.name,
      path: skill.path,
      type: "git",
      status: "skipped",
      detail: "Detached HEAD or unreadable git state",
    };
  }

  const statusRes = run("git", ["-C", skill.path, "status", "--porcelain"]);
  const dirty = (statusRes.stdout || "").trim().length > 0;

  const upstreamRes = run("git", [
    "-C",
    skill.path,
    "rev-parse",
    "--abbrev-ref",
    "--symbolic-full-name",
    "@{u}",
  ]);
  if (upstreamRes.status !== 0) {
    return {
      name: skill.name,
      path: skill.path,
      type: "git",
      branch,
      dirty,
      status: "skipped",
      detail: "No upstream tracking branch configured",
    };
  }
  const upstream = upstreamRes.stdout.trim();

  const fetchRes = run("git", ["-C", skill.path, "fetch", "--quiet"]);
  if (fetchRes.status !== 0) {
    return {
      name: skill.name,
      path: skill.path,
      type: "git",
      branch,
      upstream,
      dirty,
      status: "error",
      detail: `git fetch failed: ${(fetchRes.stderr || "").trim()}`,
    };
  }

  const countRes = run("git", [
    "-C",
    skill.path,
    "rev-list",
    "--left-right",
    "--count",
    `HEAD...${upstream}`,
  ]);
  const [aheadStr = "0", behindStr = "0"] = (countRes.stdout || "").trim().split(/\s+/);
  const ahead = Number(aheadStr) || 0;
  const behind = Number(behindStr) || 0;

  if (behind === 0) {
    return {
      name: skill.name,
      path: skill.path,
      type: "git",
      branch,
      upstream,
      dirty,
      ahead,
      behind,
      status: "up-to-date",
      detail: ahead > 0 ? `Up to date (${ahead} local commit(s) ahead)` : "Up to date",
    };
  }

  const logRes = run("git", [
    "-C",
    skill.path,
    "log",
    "--oneline",
    "-n",
    "10",
    `HEAD..${upstream}`,
  ]);
  const commits = (logRes.stdout || "")
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);

  const filesRes = run("git", [
    "-C",
    skill.path,
    "diff",
    "--name-only",
    `HEAD..${upstream}`,
  ]);
  const changedFiles = (filesRes.stdout || "")
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);

  const securityFlags = scanUpstreamDiffForRisks(skill.path, upstream, changedFiles);

  if (!applyMode) {
    return {
      name: skill.name,
      path: skill.path,
      type: "git",
      branch,
      upstream,
      dirty,
      ahead,
      behind,
      commits,
      changedFiles,
      securityFlags,
      status: dirty ? "update-available-dirty" : "update-available",
      detail:
        `${behind} commit(s) behind ${upstream}` +
        (dirty ? " (local edits present; will skip on --apply)" : "") +
        (securityFlags.length > 0 ? ` [${securityFlags.length} security flag(s)]` : ""),
    };
  }

  if (dirty) {
    return {
      name: skill.name,
      path: skill.path,
      type: "git",
      branch,
      upstream,
      dirty,
      ahead,
      behind,
      commits,
      changedFiles,
      securityFlags,
      status: "skipped",
      detail: `Skipped: ${behind} commit(s) behind, but working tree has uncommitted changes`,
    };
  }

  if (ahead > 0) {
    return {
      name: skill.name,
      path: skill.path,
      type: "git",
      branch,
      upstream,
      dirty,
      ahead,
      behind,
      commits,
      changedFiles,
      securityFlags,
      status: "skipped",
      detail: `Skipped: diverged (${ahead} ahead, ${behind} behind); resolve manually`,
    };
  }

  if (securityFlags.length > 0 && !allowRisky) {
    return {
      name: skill.name,
      path: skill.path,
      type: "git",
      branch,
      upstream,
      dirty,
      ahead,
      behind,
      commits,
      changedFiles,
      securityFlags,
      status: "blocked-security",
      detail: `Blocked pull (${securityFlags.length} security flag(s) in upstream diff). Inspect with --diff ${skill.name} and re-run with --allow-risky to confirm.`,
    };
  }

  const pullRes = run("git", ["-C", skill.path, "pull", "--ff-only", "--quiet"]);
  if (pullRes.status !== 0) {
    return {
      name: skill.name,
      path: skill.path,
      type: "git",
      branch,
      upstream,
      status: "error",
      detail: `git pull --ff-only failed: ${(pullRes.stderr || "").trim()}`,
    };
  }

  return {
    name: skill.name,
    path: skill.path,
    type: "git",
    branch,
    upstream,
    behind,
    commits,
    changedFiles,
    securityFlags,
    status: "updated",
    detail: `Fast-forwarded ${behind} commit(s) from ${upstream}`,
  };
}

function runNpxSkills() {
  if (applyMode && targetSkills.length > 0) {
    return targetSkills.map((name) => {
      const subcmd = ["skills", "update", name, "-y"];
      const res = run("npx", ["--yes", ...subcmd], { cwd });
      return {
        command: `npx --yes ${subcmd.join(" ")}`,
        exitCode: res.status,
        stdout: (res.stdout || "").trim(),
        stderr: (res.stderr || "").trim(),
      };
    });
  }

  const subcmd = applyMode ? ["skills", "update", "-y"] : ["skills", "check"];
  const res = run("npx", ["--yes", ...subcmd], { cwd });
  return [
    {
      command: `npx --yes ${subcmd.join(" ")}`,
      exitCode: res.status,
      stdout: (res.stdout || "").trim(),
      stderr: (res.stderr || "").trim(),
    },
  ];
}

const discovered = discoverSkillDirs(defaultRoots);

if (diffTarget) {
  const match = discovered.find((s) => s.name.toLowerCase() === diffTarget);
  if (!match) {
    console.error(`Skill "${diffTarget}" not found in scanned skill directories.`);
    process.exit(1);
  }
  showGitDiff(match);
  process.exit(0);
}

const filtered =
  targetSkills.length > 0
    ? discovered.filter((s) => targetSkills.includes(s.name.toLowerCase()))
    : discovered;

const allResults = filtered.map(inspectAndSyncGitSkill);
const displayedResults = onlyUpdates
  ? allResults.filter((r) =>
      [
        "update-available",
        "update-available-dirty",
        "blocked-security",
        "updated",
        "skipped",
        "error",
      ].includes(r.status)
    )
  : allResults;

const npxResults = includeNpx ? runNpxSkills() : [];

if (jsonMode) {
  console.log(
    JSON.stringify(
      {
        mode: applyMode ? "apply" : "check",
        scannedCount: allResults.length,
        skills: displayedResults,
        npxSkills: npxResults,
      },
      null,
      2
    )
  );
  process.exit(0);
}

console.log(
  `skill-sync (${applyMode ? "APPLY" : "CHECK"} mode) — scanned ${allResults.length} deduplicated skill(s)` +
    (onlyUpdates ? `, showing ${displayedResults.length} actionable git skill(s)` : "") +
    "\n"
);

if (displayedResults.length === 0 && onlyUpdates) {
  console.log("All git-cloned skills are up to date.");
} else {
  for (const r of displayedResults) {
    console.log(`[${r.status.toUpperCase()}] ${r.name} (${r.type}) — ${r.detail}`);
    console.log(`  path: ${r.path}`);
    if (r.commits?.length) {
      for (const c of r.commits) console.log(`    commit: ${c}`);
    }
    if (r.changedFiles?.length) {
      console.log(`    files: ${r.changedFiles.join(", ")}`);
    }
    if (r.securityFlags?.length) {
      console.log(`    security flags (${r.securityFlags.length}):`);
      for (const f of r.securityFlags) {
        console.log(`      ! [${f.label}] (${f.file}): ${f.snippet}`);
      }
    }
  }
}

for (const npxResult of npxResults) {
  console.log(`\n--- ${npxResult.command} (exit ${npxResult.exitCode}) ---`);
  if (npxResult.stdout) console.log(npxResult.stdout);
  if (npxResult.stderr) console.error(npxResult.stderr);
}
