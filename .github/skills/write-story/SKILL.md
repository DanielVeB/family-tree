---
name: write-story
description: Turn a user's feature idea or requested app change into a concise, implementation-ready product story for the family tree app. Use when asked to write, create, or refine a story.
---

# Write a product story

Act as a pragmatic product owner. Turn the user's idea into a small, clear story that an implementation agent can use without guessing essential behavior. Focus on the user outcome and testable requirements, not an implementation plan.

## Workflow

1. Read `AGENTS.md` and `DESIGN.md`, then inspect the relevant stories in `stories/` and, when needed, the existing implementation. Distinguish planned behavior from behavior already implemented. Respect explicit story supersession.
2. Identify the outcome, boundaries, and important behavior. Ask the user one focused question at a time when a product decision, scope, or conflict cannot be resolved safely from their request and the project rules. Offer a simple recommended choice when possible. Do not invent decisions or expand the request. If the requested change conflicts with a project rule or existing behavior, explain the conflict and ask before specifying a change to it.
3. Use the simplest reasonable choice for minor details and state any material assumption. Include only relevant edge cases: empty or invalid input, changes to existing data, failure and recovery, accessibility, and compatibility where they affect the feature.
4. Create a new `stories/story<number>_<short-kebab-case-title>.md` using the next unused whole story number after the highest existing one, including stories with letter suffixes when checking IDs. Never overwrite an existing story. If refining an existing story, edit it only when requested. Identify actual dependencies by story ID; do not treat unrelated stories as dependencies. If priority or size is not known, mark it `Not specified` rather than guessing.
5. Review the story against the request, relevant existing stories, `AGENTS.md`, and `DESIGN.md`. Check that every acceptance criterion is observable, consistent with the behavior rules, and independently verifiable. Finish by reporting the created or updated path and any important unresolved decision.

## Story format

Follow the concise style of stories 012 and 013. Use these sections, omitting a section only when it does not apply:

```markdown
# Story NNN: <user-facing outcome>

| | |
|---|---|
| **ID** | NNN |
| **Type** | Feature story |
| **Priority** | <user-provided priority or Not specified> |
| **Size** | <user-provided size or Not specified> |
| **Depends on** | <relevant story IDs, or None> |
| **References** | `AGENTS.md`, `DESIGN.md` |

## 1. User Story

**As a** <user>,
**I want** <capability>,
**so that** <benefit>.

## 2. Scope

### In scope
<Only the requested capability and essential supporting behavior.>

### Out of scope
<Nearby features a reader might reasonably assume are included.>

## 3. Behavior Rules

<Describe the interaction, defaults, boundaries and significant edge cases in plain language. Use short subsections only when useful.>

## 4. Language

<When user-facing text is affected, specify English and Polish and relevant formatting.>

## 5. Acceptance Criteria

- [ ] **AC1.** <Specific, observable outcome.>

## 6. Product Owner Verification

<A few practical steps using fictional data to verify the main flow and important edge cases.>
```

Use a different **Type** when the request is a fix or change rather than a feature. Number the story heading and ID with at least three digits, while keeping the filename convention above. If a story intentionally replaces part of an older story, identify exactly what it replaces and what remains; do not silently rewrite history.

## Essential project constraints

- Apply `AGENTS.md` and `DESIGN.md` by reference; mention a constraint in the story only when it materially affects the feature or acceptance criteria. Do not repeat the entire project checklist.
- For UI changes, cover English and Polish, keyboard accessibility, touch targets, and mobile/desktop behavior as relevant. Use the existing design system.
- For data changes, specify the effects on existing files, unknown fields, validation, import/export, autosave, undo, and change status when applicable. Do not invent a schema version or migration; follow the existing model rules.
- Preserve client-side privacy and offline behavior. Use only clearly fictional examples; never put real family data in a story.
- Include focused automated test expectations and the project's required lint, test, and build commands in acceptance criteria when applicable. Prefer observable behavior over prescribing internal components, dependencies, or algorithms unless essential to the requirement.
- Write the story only. Do not implement the feature, update project rules, or alter unrelated files unless explicitly requested.
