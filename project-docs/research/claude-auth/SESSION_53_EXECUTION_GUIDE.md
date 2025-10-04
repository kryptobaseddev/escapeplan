# Session 53 Execution Guide - Orchestrator Instructions

**Purpose:** Ensure Session 53 agent follows atomic task decomposition, parallel execution, and recursive validation.

---

## Execution Methodology (MANDATORY)

### 1. You Are the Orchestrator, Not the Implementer

**Your Role:**
- ✅ Break work into atomic tasks
- ✅ Launch subagents in parallel
- ✅ Validate results with QA tasks
- ✅ Fix issues recursively until production-ready
- ❌ DO NOT implement directly (use subagents)

### 2. Parallel Execution Pattern

**Every phase follows this pattern:**

```
Phase Start
  ↓
Launch N independent tasks in PARALLEL (single message, N Task calls)
  ↓
Wait for ALL results
  ↓
Launch QA validation task
  ↓
Issues found? → Launch fix tasks in PARALLEL → Re-QA
  ↓
No issues? → Phase Complete → Next Phase
```

**Example - Phase 1 Execution:**
```typescript
// CORRECT: Single message with 4 parallel Task calls
Task(description: "Auth Implementation Analysis", ...)
Task(description: "MVP Requirements Extraction", ...)
Task(description: "Monetization Strategy Analysis", ...)
Task(description: "Integration Audit", ...)

// Wait for results

// Then QA task
Task(description: "Validate Phase 1 Outputs", ...)

// If issues found
Task(description: "Fix auth analysis gaps", ...)
Task(description: "Fix requirements conflicts", ...)

// Re-QA
Task(description: "Re-validate Phase 1 fixes", ...)
```

### 3. Atomic Task Structure

**Every Task call MUST include:**

```typescript
Task({
  description: "5-10 word summary",
  prompt: `
    ## Context
    - Techstack: Better Auth v1.3.24+, Drizzle, SQLite, Fastify, SvelteKit
    - Architecture: Offline-first, single-tenant MVP, future cloud sync
    - Project: EscapePlan escape room management system

    ## Your Task
    [Single, explicit instruction]

    ## Requirements
    - Acceptance criteria (specific, measurable)
    - Constraints (technical, architectural)
    - Success metrics

    ## Deliverables
    - [Specific output 1]
    - [Specific output 2]
    - Format: [Markdown/JSON/Code]

    ## Research/Read
    - File: path/to/file.md (sections X-Y)
    - Documentation: Better Auth organization plugin

    ## Output Format
    Provide complete, production-ready deliverable.
    NO stubs, TODOs, or placeholders.
  `,
  subagent_type: "general-purpose"
})
```

### 4. QA Validation Tasks

**After EVERY implementation phase:**

```typescript
Task({
  description: "QA Phase N Outputs",
  prompt: `
    ## Context
    [Same as implementation tasks]

    ## Your Task
    Validate the following deliverables:
    - [Deliverable 1] from Task N-A
    - [Deliverable 2] from Task N-B
    - [Deliverable 3] from Task N-C

    ## Validation Criteria
    - Completeness: All required content present
    - Accuracy: Technical details correct
    - Consistency: No conflicting information
    - Production-ready: Zero stubs/TODOs/placeholders

    ## Output
    QA Report with:
    - ✅ Items passing validation
    - ❌ Issues found (specific, actionable)
    - 🔧 Required fixes (explicit instructions)
  `,
  subagent_type: "general-purpose"
})
```

### 5. Recursive Fix Loop

**If QA finds issues:**

```
Issues Found
  ↓
Launch fix tasks in PARALLEL (one per issue)
  ↓
Wait for fixes
  ↓
Launch Re-QA task
  ↓
Still have issues? → Repeat
  ↓
No issues? → Mark phase complete
```

---

## Session 53 Phase Breakdown

### Phase 1: Document Current State
- **4 parallel analysis tasks** → QA → Fix (if needed) → Re-QA
- **Deliverables:** 4 analysis reports (auth, MVP, monetization, integrations)

### Phase 2: Analyze Future Requirements
- **5 parallel design tasks** → QA → Fix (if needed) → Re-QA
- **Deliverables:** 5 design documents (cloud sync, org model, license, plugins, schema)

### Phase 3: Gap Analysis
- **4 parallel analysis tasks** → QA → Fix (if needed) → Re-QA
- **Deliverables:** 4 impact reports (multi-tenant now/later, comparison, schema)

### Phase 4: Recommendation & Roadmap
- **3 parallel synthesis tasks** → QA → Fix (if needed) → Re-QA
- **Deliverables:** Architecture decision, roadmap, risk plan

### Phase 5: Documentation & Completion
- **4 parallel documentation tasks** → Final QA
- **Deliverables:** ADR, roadmap, session notes, updated prompt

---

## Common Mistakes to Avoid

### ❌ WRONG: Sequential Execution
```typescript
// BAD: Tasks run one at a time
await Task("Research Better Auth")
// Wait...
await Task("Design schema")
// Wait...
await Task("Create documentation")
```

### ✅ CORRECT: Parallel Execution
```typescript
// GOOD: All tasks launch together
Task("Research Better Auth")
Task("Design schema")
Task("Create documentation")
// Wait for ALL results together
```

### ❌ WRONG: No QA Validation
```typescript
Task("Implement feature")
// Done! (but not validated)
```

### ✅ CORRECT: Implementation → QA → Fix Loop
```typescript
Task("Implement feature")
// Wait for result
Task("QA validate feature")
// If issues found:
Task("Fix issue 1")
Task("Fix issue 2")
Task("Re-QA feature")
```

### ❌ WRONG: Incomplete Task Context
```typescript
Task({
  prompt: "Analyze the schema"
  // Missing: techstack, architecture, requirements, deliverables
})
```

### ✅ CORRECT: Complete Task Context
```typescript
Task({
  prompt: `
    Context: Better Auth v1.3.24+, Drizzle, SQLite, offline-first MVP
    Task: Analyze current schema for cloud-readiness
    Requirements: Identify fields needed for hub-to-cloud sync
    Deliverables: Schema analysis document with specific field additions
    Success: Actionable recommendations, zero ambiguity
  `
})
```

---

## Production-Ready Checklist

**Before marking any task complete:**

- [ ] Deliverable is 100% complete (no stubs/TODOs)
- [ ] All technical details are accurate
- [ ] No conflicting or ambiguous information
- [ ] QA validation passed
- [ ] If issues found: fixed and re-validated
- [ ] Deliverable is actionable (next person can use it immediately)

**Before marking session complete:**

- [ ] All 5 phases complete with QA passed
- [ ] All deliverables present and production-ready
- [ ] Architecture decision documented with evidence
- [ ] Growth roadmap complete with phases
- [ ] Session 54 directive includes atomic tasks
- [ ] Recursive validation confirmed no remaining issues

---

## Success Metrics

**Quantitative:**
- 100% of independent tasks launched in parallel
- 0 stubs, mocks, or TODOs in deliverables
- 100% of implementations passed QA validation
- 5/5 phases complete with recursive validation

**Qualitative:**
- Architecture decision is clear and well-justified
- Growth roadmap is detailed and actionable
- Session 54 has explicit atomic task breakdown
- No ambiguity or assumptions in documentation

---

**Remember: You orchestrate, subagents implement. Parallel execution and recursive validation are mandatory.**
