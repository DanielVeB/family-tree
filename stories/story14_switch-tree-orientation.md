# Story 014: Switch between horizontal and vertical tree views

| | |
|---|---|
| **ID** | 014 |
| **Type** | Feature story |
| **Priority** | Not specified |
| **Size** | Not specified |
| **Depends on** | Story 002 (tree model and canvas), 006 (tree layout), 009b (stored levels and order) |
| **References** | `AGENTS.md`, `DESIGN.md` |

## 1. User Story

**As a** user,  
**I want** to switch between horizontal and vertical tree views,  
**so that** I can choose a layout that is easier to view on my screen.

## 2. Scope

### In scope
1. Horizontal and vertical presentations of the same family tree.
2. A responsive default and a user-controlled orientation switch.
3. Remembering the user's chosen orientation on this browser.

### Out of scope
- Changing people, relationships, stored levels or order, or the tree file format.
- Adding other views, layout editing, or a new way to arrange people.

## 3. Behavior Rules

### 3.1 Orientation and default

- In **horizontal** view, generations progress from left to right. In **vertical** view, generations progress from top to bottom.
- Keep each person's stored `metaData.layer` and `metaData.order` unchanged. The view changes only how the tree is presented; it does not recalculate or save tree data.
- On the first visit without a saved orientation, use vertical view below 640px viewport width and horizontal view at 640px or wider.
- Provide a switch that lets the user choose either orientation at any viewport width. Save a manual choice in browser storage and use it on later visits, even if the viewport width changes. The responsive default applies again only when there is no saved choice.
- Keep disconnected parts intact and deterministically arranged in either view. Preserve existing relationship grouping and routing rules, including readable connectors that do not pass through unrelated cards.

### 3.2 Switching views

- Switching orientation does not change the tree, selection, undo history, autosave state, or export status.
- Keep the selected person selected. Reposition the canvas as needed so the selected person remains visible; when no person is selected, keep the tree centered in the canvas.
- An empty tree remains usable and does not show a misleading tree layout.
- The view choice is a local display preference, not part of imported or exported family data. It requires no network request and works offline.

## 4. Language

Provide translated English and Polish labels and accessible names for the orientation control. Keep the control keyboard accessible, with a visible focus style and a touch target of at least 44x44px. Follow `DESIGN.md` for all visual styling and ensure the tree remains usable at 360px in both languages.

## 5. Acceptance Criteria

- [ ] **AC1.** Horizontal view presents generations from left to right; vertical view presents generations from top to bottom, with every person and relationship represented in both.
- [ ] **AC2.** On a first visit with no saved preference, a viewport below 640px uses vertical view and a viewport of 640px or wider uses horizontal view.
- [ ] **AC3.** A user can switch views at any viewport width. Their choice remains active after refresh and takes precedence over the responsive default.
- [ ] **AC4.** Switching views does not alter tree data, stored `layer` or `order`, selection, undo history, autosave state, or export status. It does not add fields to imported or exported tree data.
- [ ] **AC5.** Both views preserve disconnected parts, existing relationship grouping, and clear, non-overlapping connectors. The same tree produces a deterministic layout in either orientation.
- [ ] **AC6.** The selected person remains selected and visible after switching; with no selection, the tree remains centered. An empty tree remains usable.
- [ ] **AC7.** The control is accessible by keyboard and touch, follows the existing design system, and works at 360px in English and Polish.
- [ ] **AC8.** Tests cover both layout orientations, responsive defaults, saved and changed preferences, and unchanged tree state. All new user-facing text is translated in English and Polish.
- [ ] **AC9.** `npm run lint`, `npm test`, and `npm run build` pass; no dependency or network request is added.

## 6. Product Owner Verification

1. With no saved orientation, open the app at a phone-width viewport and confirm the vertical view; open it at desktop width and confirm the horizontal view.
2. Switch views at each viewport width. Confirm that people and relationships remain visible, then refresh and confirm the chosen view is remembered.
3. Select a fictional person, switch views, and confirm the person stays selected and visible. Confirm the tree's data and export status do not change.
4. Switch to Polish and check that the orientation control remains understandable and usable at 360px.
