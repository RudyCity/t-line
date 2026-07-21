---
name: feature-gap-bottleneck-analysis
description: >
  Scans, identifies, and analyzes missing features, functional gaps, performance bottlenecks, technical debt, security gaps, and UX/API deficiencies across codebases.
  Generates structured, prioritized, actionable suggestions for repairs, enhancements, and feature additions.
  Triggered by keywords: "missing feature", "find gaps", "find bottlenecks", "bottleneck analysis", "feature gap", "gap analysis", "saran perbaikan", "peningkatan", "analisis gap", "analisis bottleneck", "kekurangan fitur".
---

# Feature Gap & Performance Bottleneck Analyzer

Enables deep, multi-dimensional code and architectural audits to discover missing capabilities, unhandled edge cases, performance bottlenecks, and technical debt—delivering prioritized, actionable improvement plans with ready-to-implement code solutions.

---

## Trigger Keywords & Execution Routing

- **Functional Gap Scan**: "missing feature", "kekurangan fitur", "feature gap", "unimplemented endpoints", "missing logic".
- **Performance Bottleneck Scan**: "find bottlenecks", "analisis bottleneck", "performance leak", "latency audit", "high memory usage".
- **Architecture & Security Audit**: "security gap", "architectural gap", "design flaw", "missing validation".
- **Comprehensive Audit**: "gap analysis", "analisis gap", "audit codebase", "find gaps and bottlenecks", "saran perbaikan", "peningkatan".

---

## 4-Phase Audit & Improvement Framework

### Phase 1: Intake & Scope Discovery
Before analyzing, map the system boundaries:
1. **Entry Points & Routing**: Scan main route definitions, controllers, or page schemas.
2. **Data Flow**: Track request pathways from client triggers → API handlers → service layers → DB/external services.
3. **Core Dependencies & Utilities**: Identify shared helpers, state stores, and middleware stack.

---

### Phase 2: Multi-Dimensional Gap & Bottleneck Matrix

Evaluate the codebase across the 5 core audit vectors:

#### 1. Functional & Feature Gaps (`GAP-FUNC`)
- **Unimplemented Endpoints/Handlers**: Missing CRUD methods, unhandled API states, or stubbed `// TODO` blocks.
- **Edge-Case Omissions**: Lack of offline fallback, missing retry logic, missing pagination/filtering, unhandled empty states.
- **User Intent Mismatch**: Features present in backend but missing in UI (or vice-versa).

#### 2. Performance & Resource Bottlenecks (`BOTTLENECK-PERF`)
- **N+1 Queries & Sequential Processing**: Un-batched database calls or sequential `await` loops inside arrays (instead of `Promise.all` or vectorized batching).
- **Excessive Re-renders & DOM Weight**: Missing `React.memo`, un-memoized callbacks, heavy inline allocations, or un-paginated DOM lists (>100 nodes).
- **Memory & Resource Leaks**: Uncleaned event listeners, open WebSocket/SSE connections without cleanup, un-closed streams or timers.
- **Synchronous Heavy I/O**: Blocking synchronous file reads/writes (`readFileSync`) on main thread or HTTP event loops.

#### 3. Architecture & Security Gaps (`GAP-ARCH`)
- **Validation & Sanitization**: Missing request body runtime schema checks (e.g. Zod/Joi), raw sql/command injection vectors.
- **Error Swallowing & Leaks**: Raw stack trace leaks to client or silent `catch(e) {}` blocks hiding operational failures.
- **Tight Coupling**: Monolithic components/services exceeding 500–1000 lines violating single responsibility.

#### 4. Developer Experience & Tech Debt (`DEBT-DX`)
- **Duplicate Logic**: Hand-rolled utilities that duplicate built-in runtime APIs or existing helper functions.
- **Type Safety Gaps**: Excessive use of `any`, unsafe type assertions (`as unknown as T`), or untyped API payloads.

#### 5. Reliability & Test Gaps (`GAP-RELIABILITY`)
- **Missing Circuit Breakers**: External HTTP/API dependencies without timeout handlers or fallback defaults.
- **State Inconsistency**: Lack of optimistic update rollbacks or missing atomic transactions on multi-step DB writes.

---

## Phase 3: Prioritization & Impact Scoring

Categorize every finding using the **Impact vs. Effort Matrix**:

| Priority Level | Category | Definition & Action Criteria |
|---|---|---|
| 🚨 **P0 - Critical Fixes** | High Impact / Low Effort | Security gaps, crash bugs, memory leaks, missing error boundaries. Fix immediately. |
| ⚡ **P1 - Quick Wins** | Medium-High Impact / Low Effort | Easy optimizations, missing validation, batching sequential `await`s, caching. |
| 🏗️ **P2 - Strategic Additions** | High Impact / High Effort | Major missing features, architecture refactoring, breaking up huge components. |
| 🧹 **P3 - Code Quality** | Low Impact / Low-Med Effort | Tech debt cleanup, type safety improvements, removing duplicate utility code. |

---

## Phase 4: Structured Output & Action Plan Format

Always present audit results using the standardized structure below:

### 1. Executive Summary & Diagnostic Scorecard
- Overall Codebase Health Score (1–10).
- Key Highlights: Top 3 critical findings and top 3 high-value opportunities.

### 2. Detailed Findings Breakdown
For each issue identified, format as:
```markdown
#### [<ID>] <Short Title>
- **Category**: [GAP-FUNC | BOTTLENECK-PERF | GAP-ARCH | DEBT-DX | GAP-RELIABILITY]
- **Location**: [`file_path:line`](file:///absolute/path/to/file#L10)
- **Impact**: [High / Medium / Low]
- **Root Cause**: Concise explanation of why this gap/bottleneck exists.
- **Current Behavior**: What happens now.
- **Proposed Enhancement**: Concrete resolution strategy.
```

### 3. Concrete Improvement Suggestions (Code & Architectural Diffs)
Provide ready-to-use code snippets showing the **Before vs. After (Fix / Addition)**:

```diff
- // Before: Sequential N+1 execution (Bottleneck)
- for (const id of userIds) {
-   const user = await fetchUser(id);
-   results.push(user);
- }

+ // After: Parallel batched resolution with concurrency limit
+ const results = await Promise.all(userIds.map(id => fetchUser(id)));
```

### 4. Implementation Roadmap
List step-by-step actionable phases (Phase 1: Urgent Fixes, Phase 2: Feature Enhancements, Phase 3: Long-term Architecture).

---

## Guidelines for the Auditor

1. **Be Specific**: Never give generic advice like "optimize database". Point to exact line numbers and functions.
2. **Provide Code Solutions**: Always accompany missing feature/bottleneck callouts with concrete code snippets or diffs.
3. **Respect Pragmatic Minimalism**: Do not recommend adding heavy external frameworks or complex abstractions when native solutions or small helper functions suffice.
4. **Follow Project Constraints**: Ensure all proposed enhancements adhere to existing codebase architectural rules (e.g. strict line limits, type safety).
