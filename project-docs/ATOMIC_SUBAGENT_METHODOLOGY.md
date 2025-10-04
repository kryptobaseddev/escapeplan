# Atomic Subagent Methodology
## Complete Guide to Task Decomposition, Orchestration, and Validation

**Version**: 1.0
**Last Updated**: 2025-10-03
**System**: Claude Code Sub-agent Orchestration Framework
**Alignment**: October 2025 Industry Best Practices

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Core Principles](#core-principles)
3. [The Atomic Task Paradigm](#the-atomic-task-paradigm)
4. [Task Decomposition Methodology](#task-decomposition-methodology)
5. [Full Context Passing Strategy](#full-context-passing-strategy)
6. [Recursive Validation Loops](#recursive-validation-loops)
7. [Subagent Architecture](#subagent-architecture)
8. [Orchestration Patterns](#orchestration-patterns)
9. [Handoff Protocols](#handoff-protocols)
10. [Quality Gates and Checkpointing](#quality-gates-and-checkpointing)
11. [Implementation Workflows](#implementation-workflows)
12. [Best Practices and Anti-Patterns](#best-practices-and-anti-patterns)
13. [Metrics and Success Indicators](#metrics-and-success-indicators)

---

## Executive Summary

This document defines our **Atomic Subagent Methodology** – a rigorous approach to building production-ready software using Claude Code's sub-agent orchestration capabilities. The methodology is built on three foundational pillars:

### The Three Pillars

```
┌─────────────────────────────────────────────────────────────┐
│                  ATOMIC SUBAGENT METHODOLOGY                 │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────┐│
│  │  ATOMIC TASK       │  │  FULL CONTEXT      │  │RECURSIVE││
│  │  DECOMPOSITION     │  │  PASSING           │  │VALIDATION││
│  │                    │  │                    │  │  LOOPS  ││
│  │ Every task is a    │  │ Sub-agents always  │  │         ││
│  │ single, explicit   │  │ receive complete   │  │ Impl →  ││
│  │ instruction with   │  │ context:           │  │ QA →    ││
│  │ zero ambiguity     │  │ • techstack.yaml   │  │ Fix     ││
│  │                    │  │ • project.yaml     │  │ (max 3) ││
│  │ One agent =        │  │ • requirements     │  │         ││
│  │ One purpose        │  │ • dependencies     │  │ Ensures ││
│  └────────────────────┘  └────────────────────┘  └────────┘│
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Why This Matters

Traditional AI-assisted development fails when:
- Tasks are vague or multi-faceted
- Context is lost between steps
- Quality validation is manual or skipped
- Code ships with placeholders and stubs

Our methodology eliminates these failure modes through:
- **Zero-ambiguity instructions**: Every task is explicit and testable
- **Context isolation**: Each sub-agent has complete information
- **Automated quality gates**: No code advances without validation
- **Production-ready enforcement**: Stubs and placeholders are forbidden

---

## Core Principles

### 1. Atomic Task Decomposition

**Definition**: Every task assigned to a sub-agent must be a single, self-contained unit of work with explicit requirements and clear acceptance criteria.

**Rationale**:
- Sub-agents operate in isolated contexts
- Complex tasks lead to assumption-making
- Single-purpose tasks are easier to validate
- Atomic tasks enable parallelization

**Implementation**:
```json
{
  "id": "P2-003",
  "title": "Implement password reset",
  "subAgentInstruction": {
    "instruction": "Implement password reset functionality. Users enter email, system sends reset token via email, user clicks link to set new password. Validate email, generate secure token with 1-hour expiry, store token in database, send email using EmailService, provide endpoint to validate token and update password.",
    "acceptanceCriteria": [
      "User can request password reset via email",
      "System generates secure 32-byte reset token",
      "Token expires after 1 hour",
      "Reset email sent with link containing token",
      "User can set new password using valid token",
      "Invalid/expired tokens rejected with clear error",
      "Rate limiting prevents abuse (5 attempts/hour/IP)"
    ]
  }
}
```

### 2. Full Context Passing

**Definition**: Every sub-agent receives 100% of the context needed to complete its task without assumptions or external queries.

**Rationale**:
- Sub-agents cannot ask clarifying questions mid-task
- Missing context leads to wrong implementations
- Explicit context prevents scope creep
- Complete context enables autonomous execution

**Required Context Elements**:
1. **Technical Standards**: `@techstack.yaml` (technologies, versions, code style)
2. **Architecture Patterns**: `@project.yaml` (components, design patterns, integration points)
3. **Task Requirements**: Explicit instruction with acceptance criteria
4. **Dependencies**: Results or references to prerequisite tasks
5. **Constraints**: Hard rules (no stubs, specific libraries, patterns to follow)

### 3. Recursive Validation Loops

**Definition**: Every implementation goes through automated QA validation, with fixes re-validated up to 3 times before human escalation.

**Rationale**:
- Human review doesn't scale
- Automated checks are consistent and fast
- Multiple fix attempts handle edge cases
- Escalation prevents infinite loops

**Loop Structure**:
```
Implementation → QA Validation → Decision Point
                       ↓              ↓
                    PASS ✓         FAIL ✗
                       ↓              ↓
                  Next Task      Fix Sub-agent
                                     ↓
                            Re-run QA (attempt 1)
                                     ↓
                                  PASS/FAIL?
                                     ↓
                            (repeat max 3 times)
                                     ↓
                          Still failing? → Human Review
```

---

## The Atomic Task Paradigm

### What Makes a Task "Atomic"?

An atomic task meets ALL of these criteria:

#### ✓ Single Responsibility
```
GOOD: "Implement user authentication with email/password"
BAD:  "Build the auth system" (too broad - includes signup, login, reset, sessions, etc.)
```

#### ✓ Clear Boundaries
```
GOOD: "Create POST /api/auth/login endpoint that validates credentials and returns JWT"
BAD:  "Handle user login" (unclear - frontend? backend? both?)
```

#### ✓ Explicit Requirements
```
GOOD:
- Accept email and password as JSON
- Validate email format (RFC 5322)
- Check password against bcrypt hash
- Return JWT with 24-hour expiry on success
- Return 401 with error message on failure
- Rate limit: 5 attempts per 15 minutes per IP

BAD: "Make login secure" (vague - what does "secure" mean?)
```

#### ✓ Testable Outcomes
```
GOOD:
- POST with valid credentials returns 200 + JWT
- POST with invalid credentials returns 401
- POST with malformed email returns 400
- 6th attempt in 15min window returns 429

BAD: "Login should work correctly" (not testable)
```

#### ✓ Complete Context
```
GOOD:
Context: @techstack.yaml (uses JWT, bcrypt), @project.yaml (REST API pattern)
Dependencies: User model (P1-002), Database connection (P1-001)

BAD: "Use appropriate authentication" (which approach?)
```

### Task Size Guidelines

| Size | Description | Estimable Hours | Lines of Code | Sub-agents |
|------|-------------|-----------------|---------------|------------|
| **Atomic** | Single function/endpoint/component | 2-4 hours | 50-200 LOC | 1 implementation |
| **Molecular** | Multiple related atomic tasks | 4-8 hours | 200-500 LOC | 2-3 sequential |
| **Complex** | Feature with multiple components | 1-3 days | 500-2000 LOC | 5+ parallel |

**Rule**: If a task takes more than 4 hours, decompose it into atomic sub-tasks.

---

## Task Decomposition Methodology

### Step-by-Step Process

#### Step 1: Identify the Feature or Goal

Start with the high-level objective:
```
EXAMPLE: "Users need to reset forgotten passwords"
```

#### Step 2: Break Down into Components

Identify distinct technical components:
```
1. Password reset request (API endpoint)
2. Token generation and storage (security logic)
3. Email sending (notification system)
4. Token validation (verification logic)
5. Password update (data persistence)
```

#### Step 3: Define Atomic Tasks

For each component, create explicit instructions:

```json
{
  "id": "P2-010",
  "title": "Create password reset request endpoint",
  "subAgentInstruction": {
    "instruction": "Implement POST /auth/reset-password endpoint. Accept email in JSON body. Validate email format. Check if user exists in database. If exists, generate secure 32-byte token using secrets.token_urlsafe(). Store token with 1-hour expiry in user record. Call EmailService.send_reset_email(email, token). Return 200 with message 'Reset email sent'. If user not found, still return 200 (security - don't leak user existence). Rate limit: 5 requests per hour per IP using Redis.",
    "context": [
      "@techstack.yaml - Use Flask, SQLAlchemy, Redis",
      "@project.yaml - REST API pattern, EmailService interface",
      "P2-001 - User model with reset_token and reset_token_expiry fields",
      "P1-005 - EmailService.send_reset_email() method"
    ],
    "constraints": [
      "NO stub code - complete implementation required",
      "Use secrets module for token generation (cryptographically secure)",
      "Token must be stored as hash (bcrypt) in database",
      "Rate limiting must use Redis (not in-memory)",
      "Return 200 even if user not found (prevent user enumeration)",
      "Include comprehensive error handling for DB and Redis failures"
    ],
    "acceptanceCriteria": [
      "POST /auth/reset-password with valid email returns 200",
      "Token is 32 bytes, URL-safe, cryptographically random",
      "Token stored in DB with 1-hour expiry timestamp",
      "Email sent via EmailService with token in URL",
      "Returns 200 even if email not found (security)",
      "6th request in 1 hour from same IP returns 429",
      "Database errors return 500 with logged error",
      "Redis errors fall back gracefully (log warning, allow request)"
    ],
    "outputRequirements": [
      "src/api/auth.py - reset_password_request() route handler",
      "tests/api/test_auth_reset.py - comprehensive test suite",
      "pytest coverage >= 80% for new code",
      "All tests pass",
      "Passes flake8, black, mypy"
    ]
  }
}
```

#### Step 4: Map Dependencies

Create dependency graph:
```
P2-001 (User Model)
  ↓
P1-005 (EmailService) ─────┐
  ↓                        ↓
P2-010 (Reset Request) ←───┘
  ↓
P2-011 (Token Validation)
  ↓
P2-012 (Password Update)
```

**Parallel Execution**: Tasks with no dependencies can run simultaneously.

#### Step 5: Validate Atomicity

For each task, ask:
- [ ] Can one sub-agent complete this in 2-4 hours?
- [ ] Are requirements 100% explicit?
- [ ] Can success be objectively validated?
- [ ] Is all required context provided?
- [ ] Are constraints and edge cases covered?

If any answer is "no", decompose further.

---

## Full Context Passing Strategy

### Context Architecture

Every sub-agent invocation includes three context layers:

```
┌─────────────────────────────────────────────────────────┐
│              SUB-AGENT CONTEXT ARCHITECTURE              │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Layer 1: GLOBAL CONTEXT (Same for all agents)          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ • @CLAUDE.md - Project memory & hard rules         │ │
│  │ • @techstack.yaml - Tech standards & dependencies  │ │
│  │ • @project.yaml - Architecture & design patterns   │ │
│  └────────────────────────────────────────────────────┘ │
│                         ↓                                │
│  Layer 2: TASK CONTEXT (Specific to this task)          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ • TODO task with subAgentInstruction               │ │
│  │ • Acceptance criteria & constraints                │ │
│  │ • Output requirements & validation checklist       │ │
│  └────────────────────────────────────────────────────┘ │
│                         ↓                                │
│  Layer 3: DEPENDENCY CONTEXT (Results from prior work)  │
│  ┌────────────────────────────────────────────────────┐ │
│  │ • Referenced task implementations                  │ │
│  │ • Shared models, services, utilities               │ │
│  │ • API contracts & integration points               │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Context Delivery Mechanism

#### 1. Global Context Files

**CLAUDE.md**:
```markdown
@CLAUDE.md

Contains:
- Project overview and goals
- Hard rules (NO stubs, NO assumptions)
- Sub-agent orchestration patterns
- Common troubleshooting scenarios
- Architectural decision records (ADRs)
```

**techstack.yaml**:
```yaml
@techstack.yaml

Contains:
- Language versions (Python 3.11)
- Frameworks (Flask 3.0)
- Libraries (SQLAlchemy, bcrypt, redis)
- Code style rules (Black, flake8, mypy)
- Quality standards (80% coverage)
```

**project.yaml**:
```yaml
@project.yaml

Contains:
- System components (API, Database, Cache)
- Design patterns (REST API, Repository pattern)
- Directory structure (src/, tests/)
- Integration points (external services)
```

#### 2. Task Context Embedding

Passed directly in sub-agent invocation:

```markdown
Implement: Password Reset Request Endpoint

Specification:
{full instruction from subAgentInstruction}

Tech Stack Reference:
{content of techstack.yaml}

Architecture Reference:
{content of project.yaml}

Current Phase Context:
TODO.json > PHASE_2 > P2-010

Requirements:
{specific requirements list}

Constraints:
{hard constraints - NO stubs, specific patterns}

Acceptance Criteria:
{testable criteria}

Output Requirements:
{exact deliverables}
```

#### 3. Dependency Context

Reference previous work:

```markdown
Dependencies:
- P2-001 Implementation:
  Location: src/models/user.py
  Key elements: User class, reset_token field, reset_token_expiry field

- P1-005 Implementation:
  Location: src/services/email_service.py
  Interface: EmailService.send_reset_email(email: str, token: str) -> bool

Integration Points:
- Database: Use app.db session for User queries
- Cache: Use app.redis for rate limiting
- Email: Call email_service.send_reset_email()
```

### Context Validation Checklist

Before invoking sub-agent, verify:
- [ ] All @ references resolve to actual files
- [ ] Dependency task IDs exist and are completed
- [ ] Constraints are explicit (no "good quality" or "secure")
- [ ] Acceptance criteria are testable
- [ ] Output requirements specify exact file paths
- [ ] Edge cases and error conditions documented

---

## Recursive Validation Loops

### The Validation Pipeline

```
┌──────────────────────────────────────────────────────────────┐
│                   RECURSIVE VALIDATION LOOP                   │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────┐                                         │
│  │ IMPLEMENTATION  │  Implementation sub-agent writes code   │
│  │   SUB-AGENT     │  with tests, docs, type hints          │
│  └────────┬────────┘                                         │
│           │                                                   │
│           ↓                                                   │
│  ┌─────────────────┐                                         │
│  │  QA VALIDATION  │  QA sub-agent runs 8 validation checks:│
│  │   SUB-AGENT     │  1. No placeholders/stubs              │
│  └────────┬────────┘  2. Error handling complete            │
│           │           3. Type hints present                  │
│           ↓           4. Tests passing (≥80% coverage)       │
│     ┌─────────┐      5. Architecture compliance             │
│     │PASS/FAIL│      6. Tech stack compliance               │
│     └────┬────┘      7. Code quality standards              │
│          │           8. Documentation complete               │
│    ┌─────┴─────┐                                             │
│    │           │                                             │
│  PASS ✓      FAIL ✗                                          │
│    │           │                                             │
│    │      ┌────▼────────┐                                    │
│    │      │ FIX         │  Fix sub-agent addresses issues   │
│    │      │ SUB-AGENT   │  from QA report (surgical fixes)  │
│    │      └────┬────────┘                                    │
│    │           │                                             │
│    │           ↓                                             │
│    │      Re-run QA Validation                               │
│    │           │                                             │
│    │      ┌────▼────────┐                                    │
│    │      │  Attempt 1  │                                    │
│    │      │  PASS/FAIL? │                                    │
│    │      └────┬────────┘                                    │
│    │           │ FAIL ✗                                      │
│    │           ↓                                             │
│    │      Fix Again → QA (Attempt 2)                         │
│    │           │ FAIL ✗                                      │
│    │           ↓                                             │
│    │      Fix Again → QA (Attempt 3)                         │
│    │           │                                             │
│    │      ┌────▼────────┐                                    │
│    │      │ Still FAIL? │                                    │
│    │      └────┬────────┘                                    │
│    │           │                                             │
│    │           ↓                                             │
│    │   ┌───────────────┐                                     │
│    │   │ HUMAN REVIEW  │  Escalate to human with full       │
│    │   │   (HITL)      │  context, issue log, attempts      │
│    │   └───────────────┘                                     │
│    │                                                         │
│    ↓                                                         │
│  ┌─────────────────┐                                         │
│  │  CHECKPOINT     │  Document completion, update metrics   │
│  │  & NEXT TASK    │  Move to next task in phase            │
│  └─────────────────┘                                         │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### QA Validation Checks (8 Required)

#### Check 1: No Placeholder/Stub Code

**Search for**:
```bash
grep -rn "TODO" src/
grep -rn "FIXME" src/
grep -rn "pass$" src/ --include="*.py"
grep -rn "\.\.\.$" src/
grep -rn "NotImplementedError" src/
```

**Pass Criteria**: Zero matches in production code (tests excluded)

#### Check 2: Error Handling Complete

**Verify**:
- All database operations in try/except
- All external API calls have error handling
- All file I/O operations protected
- Specific exception types (not bare `except:`)
- Descriptive error messages

**Pass Criteria**: All I/O operations have comprehensive error handling

#### Check 3: Type Hints Present

**Verify**:
```bash
mypy src/ --strict
```

**Pass Criteria**:
- All function parameters typed
- All return types specified
- No `Any` types without justification
- mypy passes with --strict

#### Check 4: Tests Passing (≥80% Coverage)

**Run**:
```bash
pytest tests/ -v --cov=src --cov-report=term-missing
```

**Pass Criteria**:
- All tests pass (exit code 0)
- Coverage ≥ 80% for new code
- Edge cases tested
- Error conditions tested

#### Check 5: Architecture Compliance

**Verify against project.yaml**:
- Files in correct directories
- Uses defined design patterns
- Follows component structure
- Integration points match spec

**Pass Criteria**: No architectural violations

#### Check 6: Tech Stack Compliance

**Verify against techstack.yaml**:
```bash
black --check src/
flake8 src/
```

**Pass Criteria**:
- Uses approved libraries
- Follows code style
- Linters pass

#### Check 7: Code Quality

**Check**:
- Functions < 50 lines
- Clear variable names
- No code duplication
- Cyclomatic complexity < 10

**Pass Criteria**: No code smells detected

#### Check 8: Documentation Complete

**Verify**:
- Docstrings on public functions
- Complex logic explained
- API changes documented
- README updated if needed

**Pass Criteria**: All public interfaces documented

### Fix Sub-agent Protocol

When QA validation fails, fix sub-agent receives:

```markdown
Fix Issues in: {task_name}

Original Implementation: {code}

QA Validation Results:
{
  "status": "fail",
  "issues": [
    {
      "file": "src/auth.py",
      "line": 42,
      "check": "no_placeholders",
      "severity": "critical",
      "description": "Function reset_password has only 'pass' statement"
    }
  ]
}

Instructions:
For each issue:
1. Locate exact problem (file:line)
2. Implement surgical fix
3. Verify fix resolves issue
4. Maintain all working code
5. Update tests if behavior changes

Constraints:
- Fix ONLY identified issues (no scope creep)
- NO new placeholders
- Maintain code quality
- Don't break existing tests
```

**Fix Attempt Tracking**:
- Attempt 1: First fix after initial QA fail
- Attempt 2: Second fix if first didn't resolve all issues
- Attempt 3: Final automated attempt
- Attempt 4+: Human escalation required

### Human Escalation Criteria

Escalate to human when:
1. **Max attempts reached**: 3 fix attempts still failing QA
2. **Ambiguous requirements**: Sub-agent identifies unclear specification
3. **Architectural conflict**: Task requires architectural decision
4. **Missing dependencies**: Required service/component doesn't exist
5. **Impossible constraint**: Conflicting requirements

**Escalation Report Format**:
```markdown
🚨 Human Review Required: {task_name}

Issue: QA validation failing after 3 fix attempts

Validation Status:
- Attempt 1: 3/8 checks failed
- Attempt 2: 2/8 checks failed
- Attempt 3: 1/8 checks failed (still not passing)

Persistent Issue:
{description of issue that won't resolve}

Context:
- Task: {task_id} - {task_title}
- Original instruction: {instruction}
- Files involved: {file_list}

Options:
1. Revise task requirements (if spec was unclear)
2. Make architectural decision (if design conflict)
3. Relax validation criteria (if criteria too strict)
4. Manual fix (if automated fix not possible)

Recommendation: {what you recommend}
```

---

## Subagent Architecture

### Subagent Roles

```
┌────────────────────────────────────────────────────────┐
│                 SUBAGENT ARCHITECTURE                   │
├────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────┐                                      │
│  │ MAIN AGENT   │  (Orchestrator - You)                │
│  │  (Sonnet 4)  │                                      │
│  └──────┬───────┘                                      │
│         │                                               │
│         ├──────────┬──────────────┬─────────────┐      │
│         ↓          ↓              ↓             ↓      │
│  ┌─────────────┐ ┌──────────┐ ┌────────┐ ┌─────────┐ │
│  │IMPLEMENTATION│ │    QA    │ │  FIX   │ │ARCHITECT│ │
│  │  SUB-AGENT  │ │VALIDATION│ │SUB-AGENT│ │SUB-AGENT│ │
│  │  (Sonnet 4) │ │SUB-AGENT │ │(Sonnet)│ │ (Opus)  │ │
│  └─────────────┘ └──────────┘ └────────┘ └─────────┘ │
│                                                         │
│  Builder          Gatekeeper    Surgeon     Designer   │
│  Writes code      Validates     Fixes       Designs    │
│  Creates tests    Runs checks   issues      systems    │
│  Documents        Reports       Surgically  Docs APIs  │
│                                                         │
└────────────────────────────────────────────────────────┘
```

### Implementation Sub-agent

**File**: `.claude/agents/implementation.json`

**System Prompt** (Summary):
```
You are an Implementation Sub-agent. Build production-ready code for a single atomic task.

HARD RULES:
- NO stubs/placeholders/TODOs
- NO assumptions - clarify ambiguities
- Follow techstack.yaml exactly
- Follow project.yaml patterns
- Include comprehensive error handling
- Add type hints (100% coverage)
- Write tests (≥80% coverage)
- Document all public functions

WORKFLOW:
1. Read context (techstack, architecture, task)
2. Clarify ambiguities (if any)
3. Implement production code
4. Write comprehensive tests
5. Add documentation
6. Deliver complete implementation
```

**Tools**: Read, Write, Edit, Grep, Bash
**Model**: claude-sonnet-4-5
**Context Window**: Independent (doesn't share main agent context)

### QA Validation Sub-agent

**File**: `.claude/agents/qa-validation.json`

**System Prompt** (Summary):
```
You are a QA Validation Sub-agent. Execute 8 validation checks strictly.

CHECKS (ALL must pass):
1. No placeholders (grep for TODO, pass, ...)
2. Error handling (all I/O in try/except)
3. Type hints (mypy --strict passes)
4. Tests passing (pytest ≥80% coverage)
5. Architecture compliance (matches project.yaml)
6. Tech stack compliance (linters pass)
7. Code quality (no smells)
8. Documentation (all public APIs documented)

WORKFLOW:
1. Load implementation and context
2. Run all 8 checks with actual tools
3. Document issues with file:line
4. Determine pass/fail (strict)
5. Return structured JSON

OUTPUT: Structured JSON with pass/fail + issues list
```

**Tools**: Read, Bash, Grep
**Model**: claude-sonnet-4-5
**Context Window**: Independent

### Fix Sub-agent

**File**: `.claude/agents/fix.json`

**System Prompt** (Summary):
```
You are a Fix Sub-agent. Resolve QA validation issues surgically.

RULES:
- Fix ONLY identified issues (no scope creep)
- Maintain all working functionality
- NO new stubs/placeholders
- Update tests if behavior changes

WORKFLOW:
1. Receive QA validation results with issues
2. For each issue:
   - Locate exact problem (file:line)
   - Understand context
   - Apply minimal fix
   - Verify fix resolves issue
3. Deliver fixed implementation

CONSTRAINTS:
- Surgical precision (minimal changes)
- No feature additions
- No unrelated refactoring
```

**Tools**: Read, Edit, Bash, Grep
**Model**: claude-sonnet-4-5
**Context Window**: Independent

### Architect Sub-agent (Optional)

**File**: `.claude/agents/architect.json`

**Purpose**: Design complex systems before implementation

**System Prompt** (Summary):
```
You are an Architect Sub-agent. Design systems and APIs before implementation.

RESPONSIBILITIES:
- Break complex features into atomic tasks
- Define component boundaries
- Specify API contracts
- Identify integration points
- Document design decisions

OUTPUT:
- Component diagram
- API specifications
- Task decomposition (atomic tasks)
- Design document
```

**Tools**: Read, Write, Grep
**Model**: claude-opus-4
**Use When**: Feature requires >5 atomic tasks or new components

---

## Orchestration Patterns

### Pattern 1: Linear Pipeline (Standard)

**Use Case**: Single feature with dependencies

```
Main Agent
  ↓
Read Context (techstack, project, TODO)
  ↓
Call Implementation Sub-agent
  ↓
Wait for completion
  ↓
Call QA Validation Sub-agent
  ↓
Decision: PASS or FAIL?
  ├─ PASS → Checkpoint → Next Task
  └─ FAIL → Call Fix Sub-agent → Loop to QA (max 3)
```

**Example**:
```bash
/build-feature name=password-reset spec=@docs/reset-spec.md phase=PHASE_2
```

**Advantages**:
- Simple, easy to debug
- Clear handoff points
- Predictable flow

**Limitations**:
- Sequential (no parallelization)
- Can be slow for independent tasks

### Pattern 2: Parallel Execution

**Use Case**: Multiple independent atomic tasks

```
Main Agent
  ↓
Read Context & Identify Independent Tasks
  ↓
Launch Multiple Implementation Sub-agents in Parallel (max 10)
  ├─ Sub-agent 1: Task A
  ├─ Sub-agent 2: Task B
  ├─ Sub-agent 3: Task C
  └─ Sub-agent 4: Task D
  ↓
Wait for All Completions
  ↓
Batch QA Validation (parallel)
  ├─ QA for Task A
  ├─ QA for Task B
  ├─ QA for Task C
  └─ QA for Task D
  ↓
Fix Any Failures (parallel)
  ↓
Checkpoint All Completed Tasks
```

**Example**:
```python
# In main agent orchestration
tasks = [
  "P2-010: Reset request endpoint",
  "P2-011: Token validation logic",
  "P2-012: Password update handler",
  "P2-013: Email template"
]

# Launch all in parallel
for task in tasks:
    launch_implementation_subagent(task)  # Non-blocking
```

**Advantages**:
- Fast (parallel execution)
- Efficient use of resources
- Good for batch work

**Limitations**:
- Requires tasks to be truly independent
- More complex coordination
- Parallel limit of 10 sub-agents

### Pattern 3: Hierarchical Orchestration

**Use Case**: Complex feature with multiple phases

```
Main Agent (Orchestrator)
  ↓
Call Architect Sub-agent
  ↓ (produces design + atomic task list)
Phase Coordinator Sub-agent
  ↓
  ├─ Phase 1: Foundation
  │   ├─ Implementation Sub-agent 1
  │   ├─ Implementation Sub-agent 2
  │   └─ QA → Fix Loop
  ↓
  ├─ Phase 2: Core Features
  │   ├─ Implementation Sub-agents (parallel)
  │   └─ QA → Fix Loop
  ↓
  └─ Phase 3: Integration
      ├─ Integration Sub-agent
      └─ End-to-End QA
  ↓
Checkpoint
```

**Example**: Building a complete authentication system

**Advantages**:
- Handles complex features
- Maintains separation of concerns
- Scalable to large projects

**Limitations**:
- More coordination overhead
- Requires careful phase boundaries

### Pattern 4: Event-Driven (NEXT_ACTION)

**Use Case**: Dynamic workflows where next step depends on results

```
Main Agent
  ↓
Implementation Sub-agent
  ↓
Returns: {
  result: {...},
  NEXT_ACTION: "qa-validation"
}
  ↓
QA Validation Sub-agent
  ↓
Returns: {
  status: "fail",
  NEXT_ACTION: "fix-issues"
}
  ↓
Fix Sub-agent
  ↓
Returns: {
  result: {...},
  NEXT_ACTION: "qa-validation"
}
  ↓
(continues until NEXT_ACTION: "checkpoint")
```

**Advantages**:
- Flexible, adaptive
- Sub-agents can influence workflow
- Emergent orchestration

**Limitations**:
- Less predictable
- Requires careful NEXT_ACTION design
- Can create infinite loops if not bounded

---

## Handoff Protocols

### Between Sub-agents

Every sub-agent handoff includes:

```json
{
  "from_agent": "implementation",
  "to_agent": "qa-validation",
  "task_id": "P2-010",
  "handoff_data": {
    "implementation_files": [
      "src/api/auth.py",
      "tests/api/test_auth_reset.py"
    ],
    "key_decisions": [
      "Used Redis for rate limiting (not in-memory)",
      "Returns 200 even if user not found (security best practice)"
    ],
    "edge_cases_handled": [
      "Database connection failure",
      "Redis unavailable (graceful degradation)",
      "Email service timeout"
    ],
    "test_results": {
      "total_tests": 12,
      "passed": 12,
      "coverage": 87
    }
  },
  "context_files": [
    "@techstack.yaml",
    "@project.yaml",
    "P2-001 User model",
    "P1-005 EmailService"
  ],
  "validation_instructions": {
    "focus_areas": [
      "Rate limiting implementation (critical)",
      "Token security (must be cryptographically secure)",
      "Error handling (DB and Redis failures)"
    ],
    "acceptance_criteria": [
      "All 8 QA checks must pass",
      "Rate limiting must work correctly",
      "Security: no user enumeration"
    ]
  }
}
```

### From Sub-agent to Human

When human escalation is required:

```markdown
## Handoff to Human: {task_id}

### Context
- Task: {task_title}
- Phase: {phase_id}
- Attempts: 3 fix attempts, still failing QA
- Time invested: ~8 hours

### What Was Attempted
1. Initial implementation: {summary}
2. QA found: {issues}
3. Fix attempt 1: {what was tried} → Still failing
4. Fix attempt 2: {what was tried} → Still failing
5. Fix attempt 3: {what was tried} → Still failing

### Persistent Issue
{detailed description of issue that won't resolve}

Example:
"QA validation requires rate limiting via Redis, but Redis connection keeps timing out in tests. Tried mocking Redis, but validation rejects mocks. Tried in-memory fallback, but violates techstack.yaml constraint. Need architectural decision: accept Redis mock in tests, or provide test Redis instance?"

### Options
1. {option 1 with pros/cons}
2. {option 2 with pros/cons}
3. {option 3 with pros/cons}

### Recommendation
{what you recommend and why}

### Files for Review
- {file1}: {purpose}
- {file2}: {purpose}

### Next Steps If Approved
{what will happen after human resolves blocker}
```

---

## Quality Gates and Checkpointing

### Quality Gate Triggers

#### Gate 1: Task Completion
**Trigger**: Implementation sub-agent completes code
**Validation**: QA sub-agent 8-check validation
**Pass**: All checks pass → proceed to next task
**Fail**: Fix sub-agent → re-validate (max 3 loops)

#### Gate 2: Phase Completion
**Trigger**: All tasks in TODO.json phase completed
**Validation**:
- All tasks have validation status "pass"
- All files committed to version control
- All tests passing
- Documentation updated

**Checkpoint Created**: Yes

#### Gate 3: Milestone Completion
**Trigger**: Major feature or component complete
**Validation**:
- Integration tests passing
- End-to-end workflows validated
- Performance benchmarks met
- Security review complete (if applicable)

**Checkpoint Created**: Yes

### Checkpoint Structure

**File**: `project-docs/checkpoints/checkpoint_{PHASE}_{TIMESTAMP}.json`

```json
{
  "checkpoint_id": "CP-PHASE2-20251003-143000",
  "timestamp": "2025-10-03T14:30:00Z",
  "phase": "PHASE_2",
  "phase_name": "Core Authentication",
  "trigger": "phase_completion",

  "completed_tasks": [
    {
      "id": "P2-010",
      "title": "Password reset request endpoint",
      "completion_timestamp": "2025-10-03T12:15:00Z",
      "implementation_time_hours": 3.5,
      "fix_attempts": 1,
      "final_status": "pass"
    },
    {
      "id": "P2-011",
      "title": "Token validation logic",
      "completion_timestamp": "2025-10-03T13:45:00Z",
      "implementation_time_hours": 2.5,
      "fix_attempts": 0,
      "final_status": "pass"
    }
  ],

  "validation_summary": {
    "total_tasks": 2,
    "tasks_passed_first_try": 1,
    "tasks_requiring_fixes": 1,
    "average_fix_attempts": 0.5,
    "validation_pass_rate": 1.0
  },

  "files_modified": [
    {
      "path": "src/api/auth.py",
      "purpose": "Password reset endpoints",
      "status": "created",
      "lines_of_code": 187,
      "test_coverage": 87
    },
    {
      "path": "tests/api/test_auth_reset.py",
      "purpose": "Password reset test suite",
      "status": "created",
      "lines_of_code": 245
    }
  ],

  "architectural_decisions": [
    {
      "id": "ADR-003",
      "title": "Redis for Rate Limiting",
      "decision": "Use Redis for API rate limiting instead of in-memory storage",
      "rationale": "In-memory doesn't work in multi-process deployments. Redis provides shared state and persistence.",
      "implications": "Requires Redis instance in all environments. Adds external dependency.",
      "alternatives_considered": [
        "In-memory (rejected - doesn't scale)",
        "Database (rejected - too slow for rate limiting)"
      ],
      "date": "2025-10-03"
    }
  ],

  "metrics": {
    "total_implementation_hours": 6.0,
    "total_fix_hours": 1.5,
    "code_lines_added": 432,
    "test_lines_added": 245,
    "test_coverage_percentage": 87,
    "linter_pass": true,
    "type_check_pass": true
  },

  "next_phase_readiness": {
    "status": "ready",
    "next_phase": "PHASE_3",
    "prerequisites_met": true,
    "blockers": [],
    "preparation_notes": "All authentication foundation complete. Ready for integration phase."
  },

  "lessons_learned": [
    "Rate limiting edge cases (Redis failure) took longer than expected",
    "Security requirement (no user enumeration) was clarified during implementation"
  ],

  "updated_artifacts": {
    "CLAUDE.md": true,
    "TODO.json": true,
    "project.yaml": false,
    "techstack.yaml": false
  }
}
```

### Post-Checkpoint Actions

1. **Update CLAUDE.md**
   ```markdown
   ### Checkpoint: Core Authentication (2025-10-03)
   - ✅ P2-010: Password reset request endpoint
   - ✅ P2-011: Token validation logic
   - Files: src/api/auth.py, tests/api/test_auth_reset.py
   - Coverage: 87%
   - Next: PHASE_3 - Integration
   ```

2. **Update TODO.json**
   ```json
   "phases": {
     "PHASE_2": {
       "status": "COMPLETED",
       "completedDate": "2025-10-03T14:30:00Z"
     }
   }
   ```

3. **Run Validation**
   ```bash
   ./project-tracker validate
   ```

4. **Git Commit**
   ```bash
   git add .
   git commit -m "checkpoint: Complete PHASE_2 - Core Authentication"
   ```

---

## Implementation Workflows

### Workflow 1: Single Task Implementation

```bash
# User runs slash command
/build-feature name=password-reset spec=@docs/reset.md phase=PHASE_2
```

**Main Agent Execution**:

```
Step 1: Load Context
  ├─ Read @CLAUDE.md
  ├─ Read @techstack.yaml
  ├─ Read @project.yaml
  ├─ Read @TODO.json (extract P2-010)
  └─ Read @docs/reset.md

Step 2: Validate Task is Atomic
  ├─ Check: Single responsibility? ✓
  ├─ Check: Clear boundaries? ✓
  ├─ Check: Explicit requirements? ✓
  └─ Check: Complete context? ✓

Step 3: Invoke Implementation Sub-agent
  ├─ Pass all context
  ├─ Pass task instruction
  ├─ Pass constraints
  └─ Wait for completion

Step 4: Implementation Sub-agent Executes
  ├─ Read context files
  ├─ Write src/api/auth.py
  ├─ Write tests/api/test_auth_reset.py
  ├─ Run tests locally
  └─ Return implementation

Step 5: Invoke QA Validation Sub-agent
  ├─ Pass implementation
  ├─ Pass original context
  └─ Execute 8 checks

Step 6: QA Validation Results
  Decision: PASS or FAIL?

  IF PASS:
    ├─ Create checkpoint
    ├─ Update TODO.json (status: COMPLETED)
    ├─ Update CLAUDE.md
    ├─ Report success to user
    └─ Return "Ready for next task"

  IF FAIL:
    ├─ Extract issues list
    ├─ Invoke Fix Sub-agent
    │   ├─ Pass implementation
    │   ├─ Pass QA issues
    │   └─ Generate fixes
    ├─ Re-run QA Validation (Attempt 1)
    └─ Repeat up to 3 times

    IF still failing after 3 attempts:
      ├─ Generate human escalation report
      ├─ Document issue and attempts
      └─ Request human review

Step 7: Summary Report
  ✅ Task P2-010 completed
  - Implementation: src/api/auth.py (187 LOC)
  - Tests: tests/api/test_auth_reset.py (245 LOC)
  - Coverage: 87%
  - Validation: All 8 checks passed
  - Fix attempts: 1
  - Time: 3.5 hours
  - Checkpoint: CP-PHASE2-20251003-143000
```

### Workflow 2: Parallel Task Execution

```bash
# User provides multiple independent tasks
/build-feature name=auth-endpoints spec=@docs/auth-batch.md phase=PHASE_2
```

**Main Agent identifies 4 independent tasks**:
- P2-010: Password reset request
- P2-011: Token validation
- P2-012: Password update
- P2-013: Email templates

**Execution**:

```
Step 1: Load Context (once)

Step 2: Validate All Tasks Are Independent
  ├─ P2-010 depends on: User model (P2-001) ✓ (completed)
  ├─ P2-011 depends on: User model (P2-001) ✓ (completed)
  ├─ P2-012 depends on: User model (P2-001) ✓ (completed)
  └─ P2-013 depends on: Nothing ✓

  No inter-dependencies → Can run in parallel

Step 3: Launch 4 Implementation Sub-agents (Parallel)
  ├─ Sub-agent 1: P2-010 (non-blocking)
  ├─ Sub-agent 2: P2-011 (non-blocking)
  ├─ Sub-agent 3: P2-012 (non-blocking)
  └─ Sub-agent 4: P2-013 (non-blocking)

Step 4: Wait for All Completions
  ├─ Sub-agent 1: Complete (2.5 hours)
  ├─ Sub-agent 2: Complete (2.0 hours)
  ├─ Sub-agent 3: Complete (3.0 hours)
  └─ Sub-agent 4: Complete (1.5 hours)

  Wall time: 3.0 hours (vs 9.0 hours sequential)

Step 5: Launch 4 QA Validation Sub-agents (Parallel)
  ├─ QA 1: P2-010 → PASS ✓
  ├─ QA 2: P2-011 → PASS ✓
  ├─ QA 3: P2-012 → FAIL ✗ (missing error handling)
  └─ QA 4: P2-013 → PASS ✓

Step 6: Fix Failed Task (P2-012)
  ├─ Invoke Fix Sub-agent for P2-012
  ├─ Re-run QA Validation → PASS ✓
  └─ All tasks now passing

Step 7: Create Batch Checkpoint
  ├─ Document all 4 tasks
  ├─ Update CLAUDE.md
  ├─ Update TODO.json
  └─ Report success

Summary:
  ✅ 4 tasks completed in parallel
  - Wall time: 4.5 hours (vs 12+ hours sequential)
  - Total LOC: 856 (432 implementation, 424 tests)
  - Average coverage: 85%
  - Validation pass rate: 75% first-try, 100% after fixes
```

### Workflow 3: Complex Feature with Architect

```bash
# User requests complex feature
/build-feature name=authentication-system spec=@docs/full-auth.md phase=PHASE_2
```

**Main Agent Determines**: This is complex (>5 atomic tasks, new components)

**Execution**:

```
Step 1: Invoke Architect Sub-agent
  Input: @docs/full-auth.md (PRD-level requirements)
  Task: Break down into atomic tasks + design system

  Architect Output:
    ├─ System Design Document
    │   ├─ Components: AuthService, TokenService, UserRepository
    │   ├─ API Contracts: /login, /logout, /reset, /verify
    │   └─ Integration Points: Database, Redis, EmailService
    │
    └─ Atomic Task List (12 tasks)
        ├─ P2-001: User model
        ├─ P2-002: AuthService interface
        ├─ P2-003: TokenService implementation
        ├─ P2-004: Login endpoint
        ├─ P2-005: Logout endpoint
        ├─ P2-006: Token refresh endpoint
        ├─ P2-007: Password reset request
        ├─ P2-008: Password reset confirm
        ├─ P2-009: Email verification
        ├─ P2-010: Rate limiting middleware
        ├─ P2-011: Integration tests
        └─ P2-012: Documentation

Step 2: Update TODO.json with Architect's Task List
  (Main agent converts architect output to TODO.json format)

Step 3: Identify Phases
  Phase 1: Foundation (P2-001, P2-002, P2-003)
  Phase 2: Core Endpoints (P2-004, P2-005, P2-006)
  Phase 3: Password Management (P2-007, P2-008)
  Phase 4: Verification (P2-009, P2-010)
  Phase 5: QA (P2-011, P2-012)

Step 4: Execute Phase 1 (Foundation)
  ├─ Sequential execution (dependencies)
  ├─ P2-001 → Implementation → QA → PASS
  ├─ P2-002 (depends on P2-001) → Implementation → QA → PASS
  └─ P2-003 (depends on P2-002) → Implementation → QA → PASS

  Checkpoint: Foundation Complete

Step 5: Execute Phase 2 (Core Endpoints)
  ├─ Parallel execution (all depend on P2-003, no inter-deps)
  ├─ Launch 3 implementation sub-agents
  ├─ QA all 3
  └─ All pass

  Checkpoint: Core Endpoints Complete

Step 6: Execute Phase 3-5 (similar pattern)

Step 7: Final Integration Checkpoint
  ├─ All 12 tasks completed
  ├─ Integration tests passing
  ├─ Documentation complete
  └─ System ready for deployment
```

---

## Best Practices and Anti-Patterns

### ✅ Best Practices

#### 1. Always Decompose to Atomic

```
✅ GOOD:
- Task: "Implement POST /auth/login endpoint"
- Estimated: 2-3 hours
- Atomic: Yes (single endpoint)

❌ BAD:
- Task: "Build authentication system"
- Estimated: 3 days
- Atomic: No (multiple components)
```

#### 2. Make Constraints Explicit

```
✅ GOOD:
constraints: [
  "NO mock/stub code - complete implementation only",
  "Use bcrypt for password hashing (min 12 rounds)",
  "Rate limit: 5 attempts per 15 minutes per IP",
  "Return 401 for invalid credentials (not 400 or 403)"
]

❌ BAD:
constraints: [
  "Implement securely",
  "Make it fast",
  "Handle errors properly"
]
```

#### 3. Provide Complete Context

```
✅ GOOD:
context: [
  "@techstack.yaml",
  "@project.yaml",
  "P2-001 User model at src/models/user.py",
  "P1-005 EmailService.send_reset_email() at src/services/email.py"
]

❌ BAD:
context: [
  "Use the user model",
  "Send emails somehow"
]
```

#### 4. Write Testable Acceptance Criteria

```
✅ GOOD:
acceptanceCriteria: [
  "POST /auth/login with valid email/password returns 200 + JWT",
  "JWT token is valid for 24 hours",
  "POST with invalid credentials returns 401",
  "6th failed attempt in 15min returns 429",
  "Response includes user ID and email in JWT claims"
]

❌ BAD:
acceptanceCriteria: [
  "Login should work",
  "Errors should be handled",
  "Security is important"
]
```

#### 5. Track Metrics

```
✅ GOOD:
- Validation pass rate: 85% (target: >80%)
- Average fix attempts: 1.2 (target: <1.5)
- Time to validation: 15 min (target: <30min)
- First-try success rate: 60% (improving)

❌ BAD:
- "We're doing well"
- "Tasks are getting done"
```

### ❌ Anti-Patterns to Avoid

#### Anti-Pattern 1: Vague Instructions

```
❌ DON'T:
"Implement authentication"

✅ DO:
"Implement POST /auth/login endpoint. Accept email and password as JSON. Validate credentials against User table using bcrypt. Return JWT with 24-hour expiry on success, 401 on failure. Rate limit: 5 attempts per 15 minutes per IP."
```

#### Anti-Pattern 2: Scope Creep in Fixes

```
❌ DON'T:
QA: "Function is missing error handling at line 42"
Fix: Adds error handling + refactors entire file + adds new features

✅ DO:
QA: "Function is missing error handling at line 42"
Fix: Adds try/except block at line 42 only
```

#### Anti-Pattern 3: Skipping Validation

```
❌ DON'T:
Implementation → "Looks good!" → Next task

✅ DO:
Implementation → QA Validation (8 checks) → Fix if needed → Next task
```

#### Anti-Pattern 4: Ignoring Context Files

```
❌ DON'T:
Sub-agent: "I'll use Django since I know it"
(But techstack.yaml specifies Flask)

✅ DO:
Sub-agent: Reads techstack.yaml, sees Flask requirement, uses Flask
```

#### Anti-Pattern 5: Accepting Placeholders

```
❌ DON'T:
def reset_password(email):
    # TODO: implement this later
    pass

✅ DO:
def reset_password(email: str) -> None:
    """Reset user password (sends reset email)."""
    user = get_user_by_email(email)
    if not user:
        raise UserNotFoundError(f"No user: {email}")
    token = generate_reset_token(user.id)
    send_reset_email(user.email, token)
```

#### Anti-Pattern 6: Infinite Fix Loops

```
❌ DON'T:
Attempt 1 → Fail
Attempt 2 → Fail
Attempt 3 → Fail
Attempt 4 → Fail
Attempt 5 → Fail
(never escalates)

✅ DO:
Attempt 1 → Fail
Attempt 2 → Fail
Attempt 3 → Fail
Escalate to Human (max 3 attempts)
```

---

## Metrics and Success Indicators

### Key Performance Indicators (KPIs)

#### 1. Validation Pass Rate

**Definition**: Percentage of implementations that pass QA validation on first try

**Formula**: `(Tasks passing first QA / Total tasks) × 100`

**Target**: ≥ 80%

**What it measures**: Quality of task decomposition and instruction clarity

```
Example:
- 10 tasks implemented
- 8 passed QA on first try
- 2 required fixes
- Validation pass rate: 80% ✓
```

#### 2. Average Fix Attempts

**Definition**: Average number of fix attempts per task

**Formula**: `Total fix attempts / Total tasks`

**Target**: < 1.5

**What it measures**: Effectiveness of QA feedback and fix sub-agent

```
Example:
- 10 tasks implemented
- 5 passed first try (0 fixes)
- 3 passed after 1 fix
- 2 passed after 2 fixes
- Total fix attempts: 0+0+0+0+0 + 1+1+1 + 2+2 = 7
- Average: 7/10 = 0.7 ✓
```

#### 3. Time to Validation

**Definition**: Average time from implementation complete to QA validation complete

**Formula**: `Sum of (QA complete time - Implementation complete time) / Total tasks`

**Target**: < 30 minutes

**What it measures**: QA sub-agent efficiency

```
Example:
- Task A: Implementation done 10:00, QA done 10:12 (12 min)
- Task B: Implementation done 11:00, QA done 11:25 (25 min)
- Task C: Implementation done 14:00, QA done 14:08 (8 min)
- Average: (12+25+8)/3 = 15 min ✓
```

#### 4. First-Try Success Rate

**Definition**: Percentage of tasks needing zero fixes

**Formula**: `(Tasks with 0 fix attempts / Total tasks) × 100`

**Target**: ≥ 60%

**What it measures**: Overall instruction quality and sub-agent capability

```
Example:
- 10 tasks
- 6 passed with 0 fixes
- First-try success rate: 60% ✓
```

#### 5. Human Escalation Rate

**Definition**: Percentage of tasks requiring human intervention

**Formula**: `(Tasks escalated to human / Total tasks) × 100`

**Target**: < 10%

**What it measures**: Completeness of task specification and validation criteria

```
Example:
- 50 tasks
- 3 escalated to human
- Escalation rate: 6% ✓
```

### Health Indicators

#### System Health Dashboard

```
┌──────────────────────────────────────────────────────┐
│           ATOMIC SUBAGENT SYSTEM HEALTH               │
├──────────────────────────────────────────────────────┤
│                                                       │
│  Validation Pass Rate:     87% ✓ (target: ≥80%)     │
│  Average Fix Attempts:     1.1 ✓ (target: <1.5)     │
│  Time to Validation:       18min ✓ (target: <30min) │
│  First-Try Success:        65% ✓ (target: ≥60%)     │
│  Human Escalation Rate:    4% ✓ (target: <10%)      │
│                                                       │
│  Tasks Completed:          47                         │
│  Tasks In Progress:        3                          │
│  Tasks Blocked:            0 ✓                        │
│                                                       │
│  Test Coverage:            84% ✓ (target: ≥80%)     │
│  Linter Pass Rate:         100% ✓                    │
│  Placeholder Code:         0 ✓                        │
│                                                       │
│  Overall Status:           🟢 HEALTHY                │
│                                                       │
└──────────────────────────────────────────────────────┘
```

#### Warning Signs

⚠️ **Attention Needed** if:
- Validation pass rate < 70%
- Average fix attempts > 2.0
- First-try success < 50%
- Human escalation rate > 15%
- Test coverage < 70%
- Any placeholder code detected

🔴 **Critical Issues** if:
- Validation pass rate < 50%
- Average fix attempts > 3.0
- Human escalation rate > 25%
- Test coverage < 60%
- Multiple tasks blocked for >24 hours

### Continuous Improvement

Track trends over time:

```
Week 1: Validation pass rate: 65%
Week 2: Validation pass rate: 72%
Week 3: Validation pass rate: 78%
Week 4: Validation pass rate: 87% ✓

Analysis: Improving as team refines task decomposition
Action: Continue current approach, document patterns
```

---

## Appendix: Quick Reference

### Atomic Task Checklist

Use this checklist before assigning a task to a sub-agent:

- [ ] **Single Responsibility**: Task has exactly one purpose
- [ ] **Clear Boundaries**: Obvious start and end points
- [ ] **Explicit Requirements**: All requirements spelled out (no "etc.")
- [ ] **Complete Context**: All @ references included
- [ ] **Testable Criteria**: Acceptance criteria are verifiable
- [ ] **Hard Constraints**: All rules stated explicitly
- [ ] **Output Requirements**: Exact deliverables listed
- [ ] **Estimable**: Can be completed in 2-4 hours
- [ ] **Dependencies Documented**: All prerequisite tasks listed
- [ ] **No Ambiguity**: Could a new team member execute this?

### QA Validation Command

```bash
# Manual QA validation
/qa-validate task=P2-010 implementation=@src/api/auth.py

# Checks performed:
# 1. No placeholders (grep)
# 2. Error handling (code review)
# 3. Type hints (mypy --strict)
# 4. Tests passing (pytest --cov)
# 5. Architecture (manual review)
# 6. Tech stack (linters)
# 7. Code quality (complexity analysis)
# 8. Documentation (docstring coverage)
```

### Checkpoint Command

```bash
# Create checkpoint after phase
/checkpoint phase=PHASE_2

# Actions performed:
# - Gather completed task data
# - Run validation checks
# - Generate checkpoint JSON
# - Update CLAUDE.md
# - Update TODO.json
# - Run ./project-tracker validate
```

### Common Patterns

**Pattern**: Request/Response API Endpoint
```json
{
  "instruction": "Implement {METHOD} {PATH} endpoint. Accept {inputs} as {format}. Validate {validations}. Query {data_source}. Return {response} on success, {error} on failure. {Additional constraints}."
}
```

**Pattern**: Service Layer Function
```json
{
  "instruction": "Implement {ServiceName}.{method_name}(). Accept {parameters}. Validate {validations}. Perform {business_logic}. Call {dependencies}. Return {output}. Raise {exceptions} on failure."
}
```

**Pattern**: Data Model
```json
{
  "instruction": "Create {ModelName} class. Fields: {field_list with types}. Relationships: {relationships}. Validations: {constraints}. Methods: {required_methods}. Use {ORM} with {database}."
}
```

---

## Conclusion

This **Atomic Subagent Methodology** represents the culmination of industry best practices (October 2025) and our project's specific requirements. By adhering to the three pillars—**Atomic Task Decomposition**, **Full Context Passing**, and **Recursive Validation Loops**—we ensure:

1. **Production-Ready Code**: Zero placeholders, comprehensive error handling, full test coverage
2. **Predictable Outcomes**: Clear instructions lead to consistent results
3. **Efficient Workflows**: Parallel execution where possible, automated validation
4. **Continuous Improvement**: Metrics track effectiveness, patterns emerge
5. **Scalable Development**: System handles 1 task or 100 with same quality

**Next Steps**:
1. Review this methodology with the team
2. Apply to first TODO.json phase
3. Track metrics and adjust as needed
4. Document new patterns as they emerge
5. Iterate on task decomposition based on results

**Remember**: The goal is not perfection, but continuous improvement. Start with atomic tasks, validate everything, and learn from each cycle.

---

**Document Status**: ✅ Complete
**Maintained By**: Project Team
**Review Schedule**: After each project phase completion

---

**Related Documents**:
- `CLAUDE.md` - Project-specific orchestration rules
- `CLAUDE_CODE_INTEGRATION_GUIDE.md` - Technical implementation details
- `TODO.json` - Atomic task definitions
- `.claude/agents/` - Sub-agent configurations
- `.claude/commands/` - Slash command implementations
