# Finding: 2026-04-17 Handoff Mojibake Is Display-path Related

date: 2026-04-17
author: Codex

## Summary

The newly added 2026-04-17 handoff files are valid UTF-8 and contain readable Japanese when decoded as UTF-8. The mojibake observed through plain PowerShell `Get-Content` is a display/read-path issue, not persisted corruption in the files.

## Evidence

- Node `fs.readFileSync(path, "utf8")` prints readable Japanese for:
  - `ai-handoff/tasks/2026-04-17-perf-fix-full-scans.md`
  - `ai-handoff/tasks/2026-04-17-viewer-app-second-pass.md`
  - `ai-handoff/findings/2026-04-17-cia-perf-audit.md`
  - `ai-handoff/tasks/2026-04-06-investigate-handoff-encoding.md`
- UTF-8 round-trip checks passed for the inspected files.
- The first bytes of `2026-04-17-perf-fix-full-scans.md` include valid UTF-8 sequences for Japanese text, for example `E3 83 91 ...`.
- `git show 7c8c604:ai-handoff/tasks/2026-04-17-perf-fix-full-scans.md` displays readable Japanese in this environment.

## Conclusion

No source-text recovery is needed for the affected 2026-04-17 handoff files. They should be read with an explicit UTF-8 path when using PowerShell, or with Node/Git commands that preserve UTF-8.

## Recommendation

- Prefer `Get-Content -Encoding utf8` on Windows PowerShell when inspecting handoff Markdown.
- For investigation scripts, prefer Node `fs.readFileSync(path, "utf8")`.
- Avoid rewriting readable UTF-8 handoff files based only on plain `Get-Content` output.
