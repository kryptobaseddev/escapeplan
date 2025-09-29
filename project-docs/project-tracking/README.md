# Project Tracking Template

A lightweight, automation-friendly project tracker built around structured JSON, a unified CLI, and session documentation. It’s optimized so humans and AI agents can onboard fast, stay aligned, and hand off work without friction.

---

## What You Get
- **Phased backlog (`TODO.json`)** – tasks grouped by phase with schema-backed metadata.
- **User story catalogue (`USER_STORIES.json`)** – personas, acceptance criteria, and effort to tie work to outcomes.
- **Session workflow** – session templates plus `HANDOFF.md` to keep every contributor in sync.
- **Configuration snapshot (`project.yaml`)** – single source for project name, goal, stack, and commands.
- **Unified command interface (`./project-tracker`)** – validation, reporting, session management, and health checks in one script.
- **Automation scripts** – reusable helpers for validation, metrics, new sessions, reporting, and config application.

---

## Fast Onboarding Flow
1. **Edit `project.yaml`** with the real project name, goal, stack, and go-to commands.
2. **Apply the config** so the tracker files update automatically:
   ```bash
   ./project-tracker init-config --config project-docs/project-tracking/project.yaml
   ```
3. **Review the generated updates** in `TODO.json`, `USER_STORIES.json`, and `HANDOFF.md` (tweak anything specific to your project).
4. **Run validation** to confirm everything lines up:
   ```bash
   ./project-tracker validate
   ```
5. **Create your first session note**:
   ```bash
   ./project-tracker new-session
   ```
6. Follow the Start → Work → Finish rhythm from the setup guide or the handoff checklist for daily use.

👉 Need more detail? See `SETUP_GUIDE.md` for the full new-project vs. existing-project walkthrough.

---

## Unified Command Interface
Use `./project-tracker` for everything—AI-safe output, clear exit codes, and deterministic formatting.

```bash
./project-tracker help            # Discover commands
./project-tracker validate        # Schema + consistency checks
./project-tracker quick-check     # Validation + status summary
./project-tracker new-session     # Create pre-filled session note
./project-tracker report markdown # Shareable status snapshot
./project-tracker dashboard       # HTML view for stakeholders
```

Advanced helpers exist too (`status`, `update-metrics`, `release-readiness`, etc.); run `./project-tracker help <command>` for details.

---

## File Map
```
project-docs/project-tracking/
├── project-tracker              # Unified CLI
├── README.md                    # This overview
├── project.yaml                 # Single-source project config
├── SETUP_GUIDE.md               # Step-by-step onboarding
├── TODO.json                    # Phase-based backlog
├── USER_STORIES.json            # Personas + stories
├── HANDOFF.md                   # Session workflow + commands
├── sessions/
│   ├── SESSION_TEMPLATE.md      # Session note template
│   └── SESSION_0_NOTES.md       # Example session note
├── schemas/
│   ├── todo-schema.json
│   └── user-stories-schema.json
└── scripts/
    ├── README.md
    ├── validate-tracking.sh
    ├── generate-report.py
    ├── new-session.sh
    └── update-metrics.py
```

---

## Usage Tips
- Keep the backlog honest: update task status, assignees, and notes as soon as work changes.
- Log decisions and blockers in the session notes—reports and handoffs rely on them.
- Run `./project-tracker validate` (or `quick-check`) before you start and before you hand off.
- The `project.yaml` file includes a `$schema` reference (`./schemas/project-schema.json`); keep values aligned with that schema so validation passes.
- When you add automation or tests, document the commands in `HANDOFF.md` so agents follow the same playbook.
- Stay schema-compliant. All JSON files validate through the provided schemas, making it safe for tooling and AI parsing.

### For Existing Projects
- Replace the kickoff tasks with reality, add follow-up cleanup tasks if needed.
- Sync personas/stories with current goals before adding new work.
- Use `./project-tracker report markdown` to share the current state with stakeholders immediately.

### For Growing Teams
- Expand phases and stories as your SDLC matures.
- Integrate `./project-tracker validate` into CI to catch drift.
- Revisit `HANDOFF.md` after milestones so newcomers stay productive.

---
Keep it simple, keep it current, and every new contributor—or AI agent—can get moving in minutes.
