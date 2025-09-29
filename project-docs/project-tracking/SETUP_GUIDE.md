# Project Tracking Setup Guide

This guide helps you turn the template into a working tracker for any project. Keep it lightweight—update only what you need, when you need it.

---

## 1. Orientation (5 minutes)
1. Open these core files:
   - `project.yaml` – single-place config for name, goal, stack, commands
   - `TODO.json` – backlog organized by phase
   - `USER_STORIES.json` – personas and acceptance criteria
   - `HANDOFF.md` – quick-start instructions for every session
2. Keep `project.yaml` aligned with `schemas/project-schema.json` (the `$schema` field already points there).
3. Run the default check to confirm the scripts work on your machine:
   ```bash
   ./project-tracker validate
   ```
4. Skim `scripts/README.md` for command details if you plan to integrate with CI.

---

## 2. Choose Your Path
### A. Brand-new project
1. Populate `project.yaml` with your project name, goal, stack, key commands, and overview path.
2. Apply the configuration:
   ```bash
   ./project-tracker init-config --config project-docs/project-tracking/project.yaml
   ```
3. Review the generated updates in `TODO.json`, `USER_STORIES.json`, and `HANDOFF.md`; tweak wording if needed.
4. Commit the changes and create your first session note (`./project-tracker new-session`).

### B. Existing project adoption
1. Review any existing documentation/decisions you want to keep.
2. Fill `project.yaml` with the current reality (goal, stack, commands, overview path).
3. Run `./project-tracker init-config --config project-docs/project-tracking/project.yaml` to sync files.
4. Layer in extra cleanup tasks or stories after the initial sync, then run `./project-tracker quick-check` to confirm the tracker reflects reality.

---

## 3. Customize the Workflow
| Area | Why it matters | Where to edit |
| ---- | -------------- | ------------- |
| Quality Gates | Define review, testing, or documentation expectations | `TODO.json -> configuration -> qualityGateRequirements` |
| Personas & Stories | Align tasks to user value | `USER_STORIES.json -> personas` / `stories` |
| Session Notes | Capture decisions & blockers | `sessions/SESSION_TEMPLATE.md` |
| Command Shortcuts | Teach contributors how to run key scripts | `HANDOFF.md` |

Tips:
- Only add sections you intend to maintain.
- When you introduce new automation, update the command reference.
- Use `notes` fields on tasks to guide AI agents toward next steps.

---

## 4. Daily Use Rhythm
1. **Start:** read the latest session note → review `TODO.json` phase → run `./project-tracker validate`.
2. **Work:** update task status as you go → document decisions in the session file.
3. **Finish:** rerun validation → summarize work/next steps → commit with meaningful message.
4. **Share:** notify the next contributor (include session note link or summary).

Optional helpers:
```bash
./project-tracker quick-check     # health summary (validation + status)
./project-tracker report markdown # snapshot for async stakeholders
./project-tracker dashboard       # HTML report if you need visuals
```

---

## 5. Growing the Tracker
- Add phases, stories, and metrics as the project matures—start small.
- Integrate `./project-tracker validate` into CI once the repo stabilizes.
- Revisit `HANDOFF.md` after each major milestone to ensure new joiners stay productive.

That’s it. Keep the system simple, accurate, and easy for the next person (or AI agent) to follow.
