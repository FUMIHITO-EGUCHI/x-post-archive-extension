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

function main() {
  if (!fs.existsSync(currentTaskPath)) {
    fail("Missing ai-handoff/current-task.md");
    return;
  }

  const currentTask = readFile(currentTaskPath);
  const activeTaskFile = extractActiveTaskFile(currentTask);

  if (activeTaskFile === null) {
    fail("Missing `task_file` entry in ai-handoff/current-task.md");
  } else {
    const resolved = path.join(repoRoot, activeTaskFile);
    if (!fs.existsSync(resolved)) {
      fail(`Active task file does not exist: ${activeTaskFile}`);
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
  }

  if (process.exitCode && process.exitCode !== 0) {
    return;
  }

  process.stdout.write("handoff consistency check passed\n");
}

main();
