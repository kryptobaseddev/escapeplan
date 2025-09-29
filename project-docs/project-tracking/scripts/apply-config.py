#!/usr/bin/env python3
"""Apply project.yaml configuration across tracker files.

This script updates TODO.json, USER_STORIES.json, and HANDOFF.md using the
values defined in project.yaml (or a supplied config path). It is intended to
simplify onboarding for single-maintainer projects and AI agents.
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from pathlib import Path
from typing import Any, Dict, List, Sequence

try:
    import yaml  # type: ignore
except ImportError:  # pragma: no cover - dependency notice
    sys.stderr.write(
        "Missing dependency 'pyyaml'. Install it with 'pip install pyyaml' and rerun.\n"
    )
    sys.exit(1)


ROOT_DIR = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG = ROOT_DIR / "project.yaml"
TODAY = date.today().isoformat()


def load_config(path: Path) -> Dict[str, Any]:
    if not path.exists():
        sys.stderr.write(f"Config file not found: {path}\n")
        sys.exit(1)

    with path.open("r", encoding="utf-8") as fh:
        data = yaml.safe_load(fh) or {}

    if not isinstance(data, dict):
        sys.stderr.write("project.yaml must contain a mapping at the root.\n")
        sys.exit(1)

    if "project_name" not in data:
        sys.stderr.write("project.yaml must define 'project_name'.\n")
        sys.exit(1)

    return data


def ensure_list(value: Any) -> List[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item) for item in value]
    return [str(value)]


def update_todo(config: Dict[str, Any]) -> None:
    path = ROOT_DIR / "TODO.json"
    todo = json.loads(path.read_text(encoding="utf-8"))

    project_name = config["project_name"]
    project_version = config.get("project_version", todo.get("projectVersion", "0.0.1"))
    current_phase = config.get("current_phase", todo.get("currentPhase", "PHASE_1"))
    overview_path = config.get("overview_path")
    goal = config.get("goal")
    summary = config.get("summary") or goal
    stack = ensure_list(config.get("stack"))
    commands = config.get("commands", {})
    notes = ensure_list(config.get("notes"))

    todo["lastUpdated"] = TODAY
    todo["projectName"] = project_name
    todo["projectVersion"] = project_version
    todo["currentPhase"] = current_phase

    # Phase 1 tasks assumed to exist in template
    phase1 = todo.get("phases", {}).get("PHASE_1")
    if phase1:
        todos = phase1.get("todos", [])
        if todos:
            kickoff = todos[0]
            kickoff_notes: List[str] = []
            if goal:
                kickoff_notes.append(f"Goal: {goal}")
            if summary and summary != goal:
                kickoff_notes.append(f"Summary: {summary}")
            if overview_path:
                kickoff_notes.append(f"Review project overview: {overview_path}")
            if stack:
                kickoff_notes.append("Stack: " + ", ".join(stack))
            kickoff_notes.extend(notes)
            if kickoff_notes:
                kickoff["notes"] = kickoff_notes
        if len(todos) > 1:
            workflow = todos[1]
            workflow_notes: List[str] = []
            if commands:
                for key, value in commands.items():
                    entries = ensure_list(value)
                    for idx, cmd in enumerate(entries, start=1):
                        suffix = f" ({key}#{idx})" if len(entries) > 1 else f" ({key})"
                        workflow_notes.append(f"Run: {cmd}{suffix}")
            if overview_path:
                workflow_notes.append(
                    f"Ensure tracker references stay aligned with {overview_path}."
                )
            if workflow_notes:
                workflow["notes"] = workflow_notes

    # Single-owner focus
    todo["teamMembers"] = [
        {
            "name": config.get("owner", "Project Owner"),
            "role": "Maintainer",
            "email": config.get("owner_email", "owner@example.com"),
            "assignedTodos": [todo_id for todo_id in ["P1-001", "P1-002"] if todo_id],
            "expertise": stack or ["generalist"],
            "availability": "flex"
        }
    ]

    # Update milestone description if present
    if todo.get("milestones"):
        todo["milestones"][0]["description"] = (
            f"Project goal captured: {goal}" if goal else "Project context captured."
        )

    # Risk owner alignment
    if todo.get("riskRegister"):
        todo["riskRegister"][0]["owner"] = config.get("owner", "Project Owner")

    path.write_text(json.dumps(todo, indent=2) + "\n", encoding="utf-8")


def update_user_stories(config: Dict[str, Any]) -> None:
    path = ROOT_DIR / "USER_STORIES.json"
    stories = json.loads(path.read_text(encoding="utf-8"))

    project_name = config["project_name"]
    project_version = config.get("project_version", stories.get("projectVersion", "0.0.1"))
    overview_path = config.get("overview_path")
    goal = config.get("goal")
    stack = ensure_list(config.get("stack"))
    commands = config.get("commands", {})

    stories["lastUpdated"] = TODAY
    stories["projectName"] = project_name
    stories["projectVersion"] = project_version

    story_items = stories.get("stories", [])
    if story_items:
        kickoff = story_items[0]
        kickoff["story"] = (
            "As a project sponsor, I want the project overview documented so that the"
            " AI agent and I stay aligned on goals and success measures."
        )
        kickoff_criteria: List[str] = [
            "Project name and goal recorded in tracker"
        ]
        if goal:
            kickoff_criteria.append(f"Goal captured as: {goal}")
        if overview_path:
            kickoff_criteria.append(f"Overview available at {overview_path}")
        kickoff["acceptanceCriteria"] = kickoff_criteria
        kickoff["technicalNotes"] = (
            f"Keep the overview at {overview_path}" if overview_path else kickoff["technicalNotes"]
        )
        kickoff["risks"] = ["Overview not kept in sync with tracker"]

    if len(story_items) > 1:
        workflow = story_items[1]
        workflow["story"] = (
            "As a delivery lead, I want the tracker commands configured so the agent"
            " always runs the correct validation, quick check, and test routines."
        )
        workflow_criteria: List[str] = ["./project-tracker validate succeeds"]
        if commands:
            for key, value in commands.items():
                for cmd in ensure_list(value):
                    workflow_criteria.append(f"Command executes: {cmd} ({key})")
        workflow["acceptanceCriteria"] = workflow_criteria
        workflow["technicalNotes"] = "Commands sourced from project.yaml"
        workflow["testCases"] = workflow_criteria[1:]

    # Update personas tools with stack hints
    personas = stories.get("personas", [])
    if personas:
        sponsor_tools = personas[0].setdefault("tools", [])
        personas[0]["tools"] = sorted(set(sponsor_tools + ["project overview", "project.yaml"]))
        if len(personas) > 1:
            delivery_tools = personas[1].setdefault("tools", [])
            personas[1]["tools"] = sorted(
                set(delivery_tools + stack + ["project-tracker CLI"])
            )

    path.write_text(json.dumps(stories, indent=2) + "\n", encoding="utf-8")


def replace_lines(section_lines: Sequence[str], new_lines: Sequence[str]) -> List[str]:
    return list(new_lines)


def update_handoff(config: Dict[str, Any]) -> None:
    path = ROOT_DIR / "HANDOFF.md"
    lines = path.read_text(encoding="utf-8").splitlines()

    project_name = config["project_name"]
    goal = config.get("goal", "_Describe the measurable outcome_")
    current_phase = config.get("current_phase", "PHASE_1")
    environments = config.get("environments", "TBD")
    commands = config.get("commands", {})

    # Update snapshot table
    try:
        table_start = lines.index("| Field | Value |")
    except ValueError:
        table_start = -1
    if table_start != -1:
        table_end = table_start
        while table_end < len(lines) and lines[table_end].startswith("|"):
            table_end += 1
        new_table = [
            "| Field | Value |",
            "| ----- | ----- |",
            f"| Project name | `{project_name}` |",
            f"| Primary goal | {goal} |",
            f"| Current phase | `{current_phase}` |",
            "| Contact / escalation | _Not required (single maintainer)_ |",
            f"| Environments | {environments} |",
        ]
        lines[table_start:table_end] = new_table

    # Update command block
    try:
        cmd_section = lines.index("```bash")
    except ValueError:
        cmd_section = -1
    if cmd_section != -1:
        cmd_end = cmd_section + 1
        while cmd_end < len(lines) and lines[cmd_end] != "```":
            cmd_end += 1
        default_cmds = [
            "./project-tracker validate     # Schema + consistency checks",
            "./project-tracker quick-check  # Health summary for humans/AI",
            "./project-tracker new-session  # Create guided session notes",
            "./project-tracker report markdown  # Shareable status snapshot",
        ]
        custom_cmds: List[str] = []
        if commands:
            custom_cmds.append("# Project-specific commands")
            for key, value in commands.items():
                entries = ensure_list(value)
                for idx, cmd in enumerate(entries, start=1):
                    suffix = f" ({key}#{idx})" if len(entries) > 1 else f" ({key})"
                    custom_cmds.append(f"{cmd}{suffix}")
        new_block = ["```bash", *default_cmds]
        if custom_cmds:
            new_block.append("")
            new_block.extend(custom_cmds)
        new_block.append("```")
        lines[cmd_section:cmd_end + 1] = new_block

    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Apply project.yaml configuration")
    parser.add_argument(
        "--config",
        default=str(DEFAULT_CONFIG),
        help="Path to project.yaml (default: project-docs/project-tracking/project.yaml)",
    )
    args = parser.parse_args()

    config = load_config(Path(args.config))

    update_todo(config)
    update_user_stories(config)
    update_handoff(config)

    print("Configuration applied successfully.")


if __name__ == "__main__":
    main()
