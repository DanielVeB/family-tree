# Story 012: Add a wedding date to a partner connection

| | |
|---|---|
| **ID** | 012 |
| **Type** | Feature story |
| **Priority** | Should have |
| **Size** | Small |
| **Depends on** | Story 002 (tree model and schema), 005 (partner connections), 006 (tree layout), 011 (partial date rules) |
| **References** | `AGENTS.md`, `DESIGN.md` |

## 1. User Story

**As a** user,  
**I want** to save a wedding date on a partner connection,  
**so that** I can remember and see when the partners got married.

## 2. Scope

### In scope
1. An optional wedding date on a marriage connection.
2. Adding or editing the date without changing either person's details or other connections.
3. Showing a saved date beside the marriage connection.
4. English and Polish text, import/export compatibility, and tests.

### Out of scope
- Engagement, divorce, separation, or other relationship dates.
- A date range, ceremony location, notes, or multiple wedding dates.
- Changing who is connected or changing a connection's type.

## 3. Behavior Rules

### 3.1 Data and compatibility

The optional `dateOfMarriage` field is stored on the `marriage` edge:

```json
{
  "from": "person-a",
  "to": "person-b",
  "type": "marriage",
  "dateOfMarriage": "2001-06-23"
}
```

- Use the same partial date formats and calendar validation as Story 011: `YYYY`, `YYYY-MM`, or `YYYY-MM-DD`.
- The date is optional. When cleared, omit `dateOfMarriage` from the edge; never write an empty string or `null`.
- Edges without a wedding date remain valid and unchanged on import and export. Keep the tree version at `1`.
- Preserve unknown edge fields and their order. A wedding date must not alter edge endpoints, type, or array position.
- Reject an invalid `dateOfMarriage` during import with the existing friendly import error. Do not change the current tree on failure.
- `dateOfMarriage` is valid only on a `marriage` edge.

### 3.2 Adding and editing

- When adding a partner, offer an optional wedding-date field in the partner form.
- For an existing partner connection, provide an accessible action to add, change, or clear its date. The action is available from either partner's view.
- Use the existing partial-date input and validation from Story 011; do not add a date picker or dependency.
- Save the connection update as one tree change. If the date is unchanged, do not mark the tree as changed.
- Undo, autosave, export status, and leave-page warnings follow the existing tree-change behavior.

### 3.3 Display

- Show a saved wedding date beside its marriage connector in the caption style from `DESIGN.md`. Show the year for year-only dates and the available precision for month or full dates, formatted for the active locale.
- Show nothing beside a marriage connector when no date is set.
- The label must remain readable without overlapping cards or other relationship lines. The layout remains deterministic, and cards do not change size.
- The tree data stays language-neutral; only the displayed date is locale-formatted.

## 4. Language

Provide translated English and Polish strings for the field label, the action to edit the date, and any validation or save feedback. Use interpolation and the existing partial-date validation messages where applicable. Do not hardcode user-facing text in components.

## 5. Acceptance Criteria

- [ ] **AC1.** Marriage edges may contain an optional, schema-validated `dateOfMarriage`; non-marriage edges may not.
- [ ] **AC2.** A marriage edge without a date remains valid and round-trips unchanged; unknown edge fields are preserved.
- [ ] **AC3.** A user can enter a partial wedding date while adding a partner, or later add, edit, and clear it from either partner's view.
- [ ] **AC4.** Empty dates are omitted, invalid dates block saving, and invalid imported dates leave the current tree untouched.
- [ ] **AC5.** Editing a wedding date changes no person data or unrelated edges. An unchanged value does not mark the tree dirty; Undo restores the previous date.
- [ ] **AC6.** A saved date appears beside the marriage connector in the active locale and caption style; an unset date shows no label.
- [ ] **AC7.** All new user-facing strings exist in English and Polish, and the UI works at 360px without obscuring cards or relationship controls.
- [ ] **AC8.** Tests cover date validation, add/edit/clear, import/export compatibility, Undo, and deterministic layout with and without a displayed date.
- [ ] **AC9.** `npm run lint`, `npm test`, and `npm run build` pass; no dependency or network request is added.

## 6. Product Owner Verification

1. Add two fictional partners and enter a full wedding date. Save and confirm the date appears by their marriage connection.
2. Edit the same date to year-only, then clear it; confirm the display updates and the exported edge omits the field when cleared.
3. Import an older file with a marriage edge but no date, then export it. It remains valid and has no new date field.
4. Try an impossible date and confirm saving/import is rejected without changing the existing tree.
5. Switch between English and Polish and confirm the date uses the active locale without changing the exported value.
