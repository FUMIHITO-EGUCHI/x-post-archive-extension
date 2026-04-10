/**
 * log-changes.mjs
 *
 * 現在の git 変更ファイル一覧をアクティブな task packet の ## Changed Files
 * セクションへ書き込む。既存の内容は上書きされる。
 *
 * 使い方: npm run handoff:log-changes
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const repoRoot = process.cwd();
const handoffDir = path.join(repoRoot, "ai-handoff");
const currentTaskPath = path.join(handoffDir, "current-task.md");

function readFile(fp) {
  return fs.readFileSync(fp, "utf8");
}

function writeFile(fp, content) {
  fs.writeFileSync(fp, content, "utf8");
}

/**
 * Replace the body of a named section with newBody (preserving the heading).
 */
function replaceSectionBody(content, sectionName, newBody) {
  const lines = content.split("\n");
  const result = [];
  let state = "before";

  for (const line of lines) {
    if (state === "before") {
      result.push(line);
      if (line === `## ${sectionName}`) {
        state = "in-section";
        if (newBody.trim()) {
          result.push("");
          for (const bodyLine of newBody.trim().split("\n")) {
            result.push(bodyLine);
          }
        }
      }
    } else if (state === "in-section") {
      if (/^## /.test(line)) {
        result.push("");
        result.push(line);
        state = "after";
      }
    } else {
      result.push(line);
    }
  }

  return result.join("\n");
}

function getChangedFiles() {
  // Collect both staged and unstaged tracked-file changes, plus untracked
  // that are already mentioned in a previous Changed Files section.
  // We use `git status --porcelain` to get everything.
  try {
    const raw = execSync("git status --porcelain", {
      cwd: repoRoot,
      encoding: "utf8",
    });
    const files = raw
      .split("\n")
      .filter(Boolean)
      .map((line) => line.slice(3).trim()) // strip XY status prefix
      .filter((f) => f && !f.startsWith("ai-handoff/")) // skip handoff files themselves
      .filter((f, i, arr) => arr.indexOf(f) === i); // deduplicate
    return files;
  } catch {
    return [];
  }
}

function main() {
  if (!fs.existsSync(currentTaskPath)) {
    process.stderr.write("Missing ai-handoff/current-task.md\n");
    process.exitCode = 1;
    return;
  }

  const currentTask = readFile(currentTaskPath);
  const taskFileMatch = currentTask.match(/^- task_file:\s*`([^`]+)`/m);

  if (!taskFileMatch) {
    process.stderr.write("No task_file entry found in current-task.md\n");
    process.exitCode = 1;
    return;
  }

  const taskFilePath = path.join(repoRoot, taskFileMatch[1]);

  if (!fs.existsSync(taskFilePath)) {
    process.stderr.write(`Active task file not found: ${taskFileMatch[1]}\n`);
    process.exitCode = 1;
    return;
  }

  const changedFiles = getChangedFiles();

  if (!changedFiles.length) {
    process.stdout.write("No changed files detected outside ai-handoff/\n");
    return;
  }

  const newBody = changedFiles.map((f) => `- \`${f}\``).join("\n");
  let taskContent = readFile(taskFilePath);
  taskContent = replaceSectionBody(taskContent, "Changed Files", newBody);
  writeFile(taskFilePath, taskContent);

  process.stdout.write(
    `Updated ## Changed Files with ${changedFiles.length} file(s) in ${taskFileMatch[1]}\n`
  );
}

main();
