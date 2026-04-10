/**
 * sync-handoff.mjs
 *
 * task packet (## Meta, ## Acceptance Criteria, ## Completion Checklist) の内容を
 * current-task.md の対応セクションへ同期する。
 *
 * 同期対象:
 *   - ## Active  ← task packet ## Meta フィールド
 *   - ## Next Action の acceptance_criteria 行 ← task packet ## Acceptance Criteria
 *   - ## Completion Checklist ← task packet ## Completion Checklist
 *   - ## Recently Completed ← status: done を持つ task packet を先頭に追加
 *   - ## Waiting Tasks ← status: waiting を持つ task packet を列挙
 *
 * 同期しないもの:
 *   - ## Recent Updates (手動で書く)
 *   - ## Scope (手動で書く)
 *   - ## Coordination (手動で書く)
 */

import fs from "fs";
import path from "path";

const repoRoot = process.cwd();
const handoffDir = path.join(repoRoot, "ai-handoff");
const currentTaskPath = path.join(handoffDir, "current-task.md");
const tasksDir = path.join(handoffDir, "tasks");

// ---------------------------------------------------------------------------
// File helpers
// ---------------------------------------------------------------------------

function readFile(fp) {
  return fs.readFileSync(fp, "utf8");
}

function writeFile(fp, content) {
  fs.writeFileSync(fp, content, "utf8");
}

// ---------------------------------------------------------------------------
// Section helpers
// ---------------------------------------------------------------------------

/**
 * Extract the body (lines after the heading, before the next ## heading) for
 * a given section name. Returns an empty string if not found.
 */
function extractSection(content, sectionName) {
  const lines = content.split("\n");
  const body = [];
  let capturing = false;

  for (const line of lines) {
    if (line === `## ${sectionName}`) {
      capturing = true;
      continue;
    }
    if (capturing && /^## /.test(line)) break;
    if (capturing) body.push(line);
  }

  // Trim leading/trailing blank lines
  while (body.length && !body[0].trim()) body.shift();
  while (body.length && !body[body.length - 1].trim()) body.pop();

  return body.join("\n");
}

/**
 * Replace the body of a named section with newBody.
 * The section heading line itself is preserved.
 * A blank line is inserted between the heading and the body, and between the
 * body and the next heading.
 */
function replaceSectionBody(content, sectionName, newBody) {
  const lines = content.split("\n");
  const result = [];
  let state = "before"; // before | in-section | after

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
      // Skip old section body lines
    } else {
      result.push(line);
    }
  }

  return result.join("\n");
}

// ---------------------------------------------------------------------------
// Meta parsing
// ---------------------------------------------------------------------------

/**
 * Parse `- key: value` lines from a section body into a plain object.
 * Back-tick wrapping around values is stripped.
 */
function parseMetaFields(metaContent) {
  const fields = {};
  for (const line of metaContent.split("\n")) {
    const m = line.match(/^- (\w+):\s*(.*)/);
    if (m) {
      fields[m[1]] = m[2].trim().replace(/^`|`$/g, "");
    }
  }
  return fields;
}

// ---------------------------------------------------------------------------
// Task packet helpers
// ---------------------------------------------------------------------------

/**
 * Extract the H1 title from a task packet (first `# ` line).
 * Strips a leading "Task Packet: " prefix if present.
 */
function extractTitle(content) {
  const m = content.match(/^# (.+)$/m);
  if (!m) return null;
  return m[1].trim().replace(/^Task Packet:\s*/i, "");
}

/**
 * Return the task ID (filename without .md) and absolute path for all task
 * packets that have a ## Meta section with `status: <value>`.
 */
function scanTaskPackets() {
  const entries = fs.readdirSync(tasksDir);
  const result = [];

  for (const entry of entries) {
    if (!entry.endsWith(".md")) continue;
    const fp = path.join(tasksDir, entry);
    const content = readFile(fp);
    const metaContent = extractSection(content, "Meta");
    if (!metaContent) continue;
    const meta = parseMetaFields(metaContent);
    if (!meta.status) continue;
    result.push({
      id: entry.replace(/\.md$/, ""),
      file: fp,
      content,
      meta,
      title: extractTitle(content),
    });
  }

  // Sort by filename date descending (filename starts with YYYY-MM-DD)
  result.sort((a, b) => b.id.localeCompare(a.id));
  return result;
}

// ---------------------------------------------------------------------------
// ## Active sync
// ---------------------------------------------------------------------------

function buildActiveSection(taskId, taskFile, meta, title) {
  const displayTitle = title ?? taskId;
  const lines = [
    `## Active`,
    `- id: \`${taskId}\``,
    `- title: \`${displayTitle}\``,
    `- owner: \`${meta.owner ?? "Codex"}\``,
    `- status: \`${meta.status ?? "active"}\``,
    `- branch: \`${meta.branch ?? "master"}\``,
    `- priority: \`${meta.priority ?? "normal"}\``,
    `- task_file: \`${taskFile}\``,
  ];
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// ## Next Action — acceptance_criteria lines
// ---------------------------------------------------------------------------

/**
 * Replace acceptance_criteria lines inside ## Next Action with bullets from
 * the task packet's ## Acceptance Criteria section.
 */
function syncAcceptanceCriteria(currentContent, taskContent) {
  const criteriaSection = extractSection(taskContent, "Acceptance Criteria");
  if (!criteriaSection) return currentContent;

  // Collect criteria bullets from the task packet.
  // Multi-line bullets (continuation lines indented with spaces) are joined.
  const rawLines = criteriaSection.split("\n");
  const bullets = [];
  for (const line of rawLines) {
    if (/^- /.test(line)) {
      bullets.push(line.slice(2).trim());
    } else if (/^\s+/.test(line) && bullets.length) {
      // Continuation line — append to last bullet
      bullets[bullets.length - 1] += " " + line.trim();
    }
  }
  const criteriaLines = bullets.map((b) => `- acceptance_criteria: ${b}`);

  if (!criteriaLines.length) return currentContent;

  // Within ## Next Action, remove existing acceptance_criteria lines and
  // re-insert the updated ones after the last non-acceptance_criteria line
  const lines = currentContent.split("\n");
  const result = [];
  let inNextAction = false;
  let insertedCriteria = false;

  for (const line of lines) {
    if (line === "## Next Action") {
      inNextAction = true;
      result.push(line);
      continue;
    }
    if (inNextAction && /^## /.test(line)) {
      // End of Next Action section — append criteria before exiting if not done
      if (!insertedCriteria) {
        result.push(...criteriaLines);
        insertedCriteria = true;
      }
      result.push("");
      result.push(line);
      inNextAction = false;
      continue;
    }
    if (inNextAction && /^- acceptance_criteria:/.test(line)) {
      // Skip old criteria lines; we'll insert the new ones at the end
      continue;
    }
    result.push(line);
  }

  // If we're still in Next Action at EOF
  if (inNextAction && !insertedCriteria) {
    result.push(...criteriaLines);
  }

  return result.join("\n");
}

// ---------------------------------------------------------------------------
// ## Recently Completed sync
// ---------------------------------------------------------------------------

function syncRecentlyCompleted(currentContent, packets) {
  const done = packets.filter((p) => p.meta.status === "done");
  if (!done.length) return currentContent;

  // Parse existing IDs from current ## Recently Completed
  const existingSection = extractSection(currentContent, "Recently Completed");
  const existingIds = new Set();
  const existingLines = [];

  for (const line of existingSection.split("\n")) {
    if (!line.trim()) continue;
    const m = line.match(/^- `([^`]+)`/);
    if (m) existingIds.add(m[1]);
    existingLines.push(line);
  }

  // Prepend newly-done tasks (those not yet in the list)
  const newEntries = [];
  for (const p of done) {
    if (existingIds.has(p.id)) continue;
    const summary = p.meta.summary?.trim()
      ? p.meta.summary
      : extractFirstResultSentence(p.content);
    newEntries.push(`- \`${p.id}\`: ${summary}`);
  }

  if (!newEntries.length) return currentContent;

  const newSection = [...newEntries, ...existingLines].join("\n");
  return replaceSectionBody(currentContent, "Recently Completed", newSection);
}

function extractFirstResultSentence(content) {
  const resultBody = extractSection(content, "Codex Result") || extractSection(content, "Result");
  if (!resultBody) return "(no summary)";
  // Take first non-empty line
  const first = resultBody.split("\n").find((l) => l.trim());
  return first ? first.replace(/^[-*]\s*/, "").slice(0, 120) : "(no summary)";
}

// ---------------------------------------------------------------------------
// ## Waiting Tasks sync
// ---------------------------------------------------------------------------

function syncWaitingTasks(currentContent, packets) {
  const waiting = packets.filter((p) => p.meta.status === "waiting");

  let newBody;
  if (!waiting.length) {
    newBody = "- `none`";
  } else {
    newBody = waiting.map((p) => `- \`${p.id}\`: ${p.title ?? p.id}`).join("\n");
  }

  return replaceSectionBody(currentContent, "Waiting Tasks", newBody);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  if (!fs.existsSync(currentTaskPath)) {
    process.stderr.write("Missing ai-handoff/current-task.md\n");
    process.exitCode = 1;
    return;
  }

  let currentContent = readFile(currentTaskPath);

  // Find the active task file from current-task.md
  const taskFileMatch = currentContent.match(/^- task_file:\s*`([^`]+)`/m);
  if (!taskFileMatch) {
    process.stderr.write("No task_file entry found in current-task.md\n");
    process.exitCode = 1;
    return;
  }

  const taskFileRel = taskFileMatch[1];
  const taskFilePath = path.join(repoRoot, taskFileRel);

  if (!fs.existsSync(taskFilePath)) {
    process.stderr.write(`Active task file not found: ${taskFileRel}\n`);
    process.exitCode = 1;
    return;
  }

  const taskContent = readFile(taskFilePath);
  const taskId = path.basename(taskFilePath, ".md");
  const metaContent = extractSection(taskContent, "Meta");
  const meta = metaContent ? parseMetaFields(metaContent) : {};
  const title = extractTitle(taskContent);

  // 1. Sync ## Active
  const activeSection = buildActiveSection(taskId, taskFileRel, meta, title);
  currentContent = replaceSectionBody(currentContent, "Active", activeSection.split("\n").slice(1).join("\n"));

  // 2. Sync ## Completion Checklist
  const checklistBody = extractSection(taskContent, "Completion Checklist");
  if (checklistBody) {
    currentContent = replaceSectionBody(currentContent, "Completion Checklist", checklistBody);
  }

  // 3. Sync acceptance_criteria in ## Next Action
  currentContent = syncAcceptanceCriteria(currentContent, taskContent);

  // 4. Scan all task packets
  const allPackets = scanTaskPackets();

  // 5. Sync ## Recently Completed
  currentContent = syncRecentlyCompleted(currentContent, allPackets);

  // 6. Sync ## Waiting Tasks
  currentContent = syncWaitingTasks(currentContent, allPackets);

  writeFile(currentTaskPath, currentContent);
  process.stdout.write("handoff sync complete\n");
}

main();
