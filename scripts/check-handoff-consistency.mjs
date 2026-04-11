import fs from "fs";
import path from "path";

const repoRoot = process.cwd();
const handoffDir = path.join(repoRoot, "ai-handoff");
const currentTaskPath = path.join(handoffDir, "current-task.md");
const tasksDir = path.join(handoffDir, "tasks");

function readFile(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}

function findSectionBody(content, headings) {
  for (const heading of headings) {
    const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`^## ${escaped}\\s*$([\\s\\S]*?)(?=^## |\\Z)`, "m");
    const match = content.match(regex);

    if (match) {
      return match[1].trim();
    }
  }

  return null;
}

function extractActiveTaskFile(content) {
  const match = content.match(/^- task_file:\s*`([^`]+)`/m);
  return match?.[1] ?? null;
}

function hasNoActiveTask(content) {
  const section = findSectionBody(content, ["Active"]);
  return section !== null && /^-\s*none\s*$/im.test(section);
}

function extractRecentlyCompletedIds(content) {
  const section = findSectionBody(content, ["Recently Completed"]);

  if (section === null || section === "") {
    return [];
  }

  return [...section.matchAll(/`([^`]+)`/g)].map((match) => match[1]);
}

function findTaskFileById(taskId) {
  const entries = fs.readdirSync(tasksDir);
  const exact = entries.find((entry) => entry === `${taskId}.md`);
  return exact === undefined ? null : path.join(tasksDir, exact);
}

function assertTaskHasCompletedSections(taskPath) {
  const content = readFile(taskPath);
  const resultBody = findSectionBody(content, ["Codex Result", "Result"]);
  const verificationBody = findSectionBody(content, ["Verification"]);

  if (resultBody === null || resultBody === "") {
    fail(`Missing completed result section content: ${path.relative(repoRoot, taskPath)}`);
  }

  if (verificationBody === null || verificationBody === "") {
    fail(`Missing verification section content: ${path.relative(repoRoot, taskPath)}`);
  }
}

// ---------------------------------------------------------------------------
// Meta helpers (案5: status field validation)
// ---------------------------------------------------------------------------

function extractMetaField(content, key) {
  const m = content.match(new RegExp(`^- ${key}:\\s*\`?([^\`\\n]+)\`?`, "m"));
  return m ? m[1].trim() : null;
}

function assertActivePacketStatus(taskPath) {
  const content = readFile(taskPath);
  const metaBody = findSectionBody(content, ["Meta"]);
  if (metaBody === null) return; // Old packet without Meta — skip validation

  const status = extractMetaField(content, "status");
  if (status && status !== "active") {
    fail(
      `Active task packet has status \`${status}\` (expected \`active\`): ${path.relative(repoRoot, taskPath)}\n` +
        `  Run \`npm run handoff:sync\` or update ## Meta status to \`active\`.`
    );
  }
}

function assertCompletedPacketStatus(taskPath) {
  const content = readFile(taskPath);
  const metaBody = findSectionBody(content, ["Meta"]);
  if (metaBody === null) return; // Old packet without Meta — skip validation

  const status = extractMetaField(content, "status");
  if (status && status !== "done") {
    fail(
      `Recently completed task packet has status \`${status}\` (expected \`done\`): ${path.relative(repoRoot, taskPath)}\n` +
        `  Update ## Meta - status: done in the task packet when closing a task.`
    );
  }
}

// ---------------------------------------------------------------------------
// Checklist sync validation (案2: detect when sync:handoff was not run)
// ---------------------------------------------------------------------------

function assertChecklistSynced(currentTask, taskPath) {
  const packetContent = readFile(taskPath);
  const packetChecklist = findSectionBody(packetContent, ["Completion Checklist"]);
  const currentChecklist = findSectionBody(currentTask, ["Completion Checklist"]);

  if (packetChecklist === null || currentChecklist === null) return;

  // Compare ignoring whitespace differences
  const normalize = (s) => s.replace(/\s+/g, " ").trim();
  if (normalize(packetChecklist) !== normalize(currentChecklist)) {
    fail(
      `Completion Checklist in current-task.md differs from task packet.\n` +
        `  Run \`npm run handoff:sync\` to resync.`
    );
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  if (!fs.existsSync(currentTaskPath)) {
    fail("Missing ai-handoff/current-task.md");
    return;
  }

  const currentTask = readFile(currentTaskPath);
  const activeTaskFile = extractActiveTaskFile(currentTask);

  if (activeTaskFile === null && !hasNoActiveTask(currentTask)) {
    fail("Missing `task_file` entry in ai-handoff/current-task.md");
  } else if (activeTaskFile !== null) {
    const resolved = path.join(repoRoot, activeTaskFile);
    if (!fs.existsSync(resolved)) {
      fail(`Active task file does not exist: ${activeTaskFile}`);
    } else {
      // 案5: active packet status must be "active"
      assertActivePacketStatus(resolved);
      // 案2: checklist must be in sync
      assertChecklistSynced(currentTask, resolved);
    }
  }

  const completedIds = extractRecentlyCompletedIds(currentTask);

  for (const taskId of completedIds) {
    const taskPath = findTaskFileById(taskId);

    if (taskPath === null) {
      fail(`Recently completed task file not found for id: ${taskId}`);
      continue;
    }

    assertTaskHasCompletedSections(taskPath);
    // 案5: completed packet status must be "done"
    assertCompletedPacketStatus(taskPath);
  }

  if (process.exitCode && process.exitCode !== 0) {
    return;
  }

  process.stdout.write("handoff consistency check passed\n");
}

main();
