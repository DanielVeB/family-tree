# Story 007: Edit and delete a person

| | |
|---|---|
| **ID** | 007 |
| **Type** | Feature story |
| **Priority** | Must have |
| **Size** | Medium to large |
| **Depends on** | Story 002 (model, detail view, add relative), 003 (change status, toast), 005 (parent and sibling rules). New children already get `sibling` edges to their siblings, so removing a parent does not break those links. Story 006 (layout) is strongly recommended first. |
| **References** | `AGENTS.md`, `DESIGN.md` |

## 1. User Story

**As a** user,
**I want** to correct a person's first and last name, and to remove a person from the tree together with all their connections,
**so that** I can fix mistakes and keep my tree accurate.

## 2. Context and Intent

Until now the tree could only grow. This story adds the two basic corrections:

- **Edit** a person's first name and last name.
- **Delete** a person. Every connection (edge) that refers to that person, in either direction and of any type, is deleted with them.

Deleting is destructive and has a side effect that did not exist before: **the tree can fall apart into separate, unconnected parts** (for example, deleting the only link between two families). The app has no way yet to connect two existing people, so such parts cannot be rejoined. This story therefore adds two safeguards:

1. A **confirmation** that explains exactly what will be removed and whether the tree will split.
2. A one-step **Undo** right after deleting.

Note: children who were added to a parent already have `sibling` edges to each other, so deleting the parent does not scatter them. The tree can still split when a deleted person was the only link between two groups (for example, a spouse joining two families).

The layout also has to **draw unconnected parts** side by side.

## 3. Scope

### In scope
1. **Edit person:** change first name and last name from the detail view.
2. **Delete person** from the detail view, with confirmation, removal of all related edges, and clear feedback.
3. A single-step **Undo** for the last deletion.
4. **Disconnected parts:** the layout, fit-to-screen, and adding relatives all work when the tree consists of several unconnected parts.
5. Correct change tracking (status, "leave site?" warning) for edit, delete, and undo.

### Out of scope (do not build)
- Editing or deleting a single connection (edge), or changing a relation type or direction.
- Connecting two existing people (this is what would rejoin separate parts).
- Deleting a whole branch (a person together with all descendants) in one step.
- Undo and redo for other actions, keyboard undo shortcuts, or a history list.
- Selecting and deleting several people at once.
- Editing any field other than first and last name.
- Detecting duplicate names or merging people.

## 4. Behavior Rules

### 4.1 Editing
- Same rules as in story 002: first name required (1 to 100 characters after trimming), last name optional (0 to 100), leading and trailing spaces trimmed.
- Only `firstName` and `lastName` change. The person's `id`, any unknown fields inside their `data`, and every connection stay exactly as they are.
- Saving without any real change (after trimming, the values are the same) closes the form and changes nothing, including the change status.

### 4.2 Deleting
- Removing person **X** means:
    - X is removed from the nodes.
    - **Every** edge where `from` is X **or** `to` is X is removed, regardless of type (`child`, `sibling`, `marriage`) and direction.
    - Nothing else changes: other people, their data, and the order of the remaining nodes and edges stay as they are, so exports stay stable.
- "Relationships removed" in the dialog means the **number of edges removed**. Sibling relationships that existed only because X was a shared parent (and have no `sibling` edge) are not edges and are not counted. `sibling` edges **between other people** are never removed, so siblings of a deleted parent stay linked to each other.
- After a deletion, the tree must still be valid under all earlier rules (no edge to a missing person, at most two parents per person, and so on).

### 4.3 Children and siblings when a parent is deleted
- Children of the same parent already have explicit `sibling` edges between them (the app creates them when a child is added). Deleting the parent removes only the edges that refer to the parent, so the sibling edges stay and the children remain connected to each other.
- Each child also stays connected to their other parent, if they have one.

### 4.4 Disconnected parts
- A **part** is a group of people connected to each other by any edges.
- The tree can have one part (as before) or several. It can also be empty (after deleting the last person).
- The number of parts that will exist after deletion is calculated by the model and shown in the dialog if it is **2 or more**.
- Parts cannot be rejoined in this story. The dialog says so.

### 4.5 Undo
- After a deletion, the app offers **Undo** for a limited time (10 seconds), in the toast.
- Undo restores the tree **exactly** as it was before the deletion (nodes, edges, and their order), restores the person's selection, and restores the change status to what it was before.
- Undo is offered only for the **last deletion**, and only **until the tree is changed again** in any way (adding, editing, deleting, importing) or the toast closes.
- There is no redo.

## 5. Screens and Components

All visuals follow `DESIGN.md`. There are no red or other new colors: destructive actions use the normal button styles and clear wording.

### 5.1 Detail view changes
- **Edit:** an icon pill (pencil, 44px, accessible name "Edit {{name}}") next to the person's name heading.
- **Delete person:** a ghost button at the very **bottom** of the detail view, separated from the other actions by a divider and at least 24px of space, so it is not tapped by accident.
- While the edit form or the add-relative form is open, Edit and Delete are not shown.

### 5.2 Edit form
- Replaces the heading area inside the detail view: first name and last name fields, filled with the current values, with the first name focused.
- Primary **Save** and ghost **Cancel**. Enter saves, Escape cancels. Validation messages as in story 002.
- After saving, the card and the heading show the new name immediately. A screen-reader announcement confirms the change. No toast is needed.

### 5.3 Delete confirmation dialog
- Modal on desktop and bottom sheet on mobile, as the other dialogs, with `role="alertdialog"`.
- Title: "Delete {{name}}?".
- Text, in this order:
    1. What is removed: "{{count}} relationship(s) will be removed along with this person." If there are none and this is the last person, the text is "This is the only person in the tree. The tree will be empty afterwards."
    2. Only if the result will have two or more parts: "The tree will split into {{count}} separate parts. Parts cannot be reconnected yet."
- Buttons: primary **Delete**, ghost **Cancel**. Focus starts on **Cancel** (the safe option). Escape cancels.

### 5.4 After deleting
- The dialog closes. Nothing is selected, the detail view closes, and the view fits the whole tree.
- A toast shows "Deleted {{name}}" with an **Undo** action and a close button, for 10 seconds, announced politely to screen readers.
- Focus moves to the first remaining person card, or to **Start a new tree** if the tree is now empty.
- After **Undo**, a short toast confirms "Restored {{name}}", and the person is selected again.

### 5.5 Drawing separate parts
- Each part is laid out on its own using the rules of story 006.
- Parts are placed **left to right**, ordered by the earliest-created member of each part, with their **top rows aligned**, and with a gap between parts of at least 96px (larger than the gap between blocks).
- Fit-to-screen includes all parts. Selecting people, panning, zooming, and highlighting work as before. There are no lines between parts.

## 6. Scenario Catalogue

Fictional examples. Each is an automated test.

| ID | Given | When | Then |
|----|-------|------|------|
| **E1** | Anna Testowa | Edit to "Anna Nowak" | Name changes in the card, heading, and relations lists of connected people. Edges and `id` unchanged. Status "Changes not exported" |
| **E2** | Anna Testowa | Clear the first name, Save | Error under the field. Nothing changes |
| **E3** | Anna Testowa | Open edit, change nothing (or only add spaces), Save | Form closes. Nothing changes, including the status |
| **E4** | A person whose `data` has an unknown extra field (fixture) | Edit the last name | The unknown field is still there after saving and after export |
| **D1** | A child (one parent) | Delete the child | Child and one edge removed. Tree is still one part. No warning |
| **D2** | A couple with two children | Delete one partner | Partner, the marriage edge, and that partner's child edges removed. Children stay connected to the other parent. One part |
| **D3** | One parent with two children who are linked to each other by a `sibling` edge (as the app creates them, see story 005 and the sibling edges added for new children) | Delete the parent | The dialog says 2 relationships will be removed and shows **no** split warning. After deleting, the two children are still connected by their sibling edge, so there is one part |
| **D4** | Two families joined by one marriage (like fixture L1 of story 006) | Delete one of the spouses | Warning "split into 2 separate parts". After deleting, both parts are drawn side by side, each laid out correctly |
| **D5** | A top-generation couple with three children | Delete one grandparent-level person | Edges removed. The remaining generation numbering is recalculated, so the top row has no empty rows above it |
| **D6** | A tree with only one person | Delete | Special text in the dialog. After deleting: empty state shown, Export hidden, no "leave site?" warning |
| **D7** | After any deletion | Press Undo within 10 seconds | The tree is identical to before, and export before and after is byte-identical |
| **D8** | After a deletion | Add a person (or edit, or import) before pressing Undo | Undo is no longer offered |
| **D9** | A person with 1, 2, 5, 12, and 22 relationships (five fixtures) | Open delete in Polish | Correct plural forms in the dialog text (see section 7) |
| **D10** | A person who is a parent of two children linked by a `sibling` edge, where each child also has a different second parent | Delete that person | Only the person's own edges are removed. The sibling edge between the children stays, and each child stays connected to their other parent. One part, no warning |

## 7. Language and Text (English / Polish)

Counted texts need all plural forms (English: one, other. Polish: one, few, many, other). Names are inserted with interpolation, and Polish text avoids declining names by using "osoby" before them.

| Key | English | Polish |
|-----|---------|--------|
| detail.edit | Edit | Edytuj |
| detail.editLabel | Edit {{name}} | Edytuj osobę {{name}} |
| edit.title | Edit person | Edytuj osobę |
| edit.announce | Name updated | Zaktualizowano imię i nazwisko |
| detail.delete | Delete person | Usuń osobę |
| delete.title | Delete {{name}}? | Usunąć osobę {{name}}? |
| delete.relations_one | {{count}} relationship will be removed along with this person. | Wraz z tą osobą zostanie usunięta {{count}} relacja. |
| delete.relations_few | | Wraz z tą osobą zostaną usunięte {{count}} relacje. |
| delete.relations_many | | Wraz z tą osobą zostanie usuniętych {{count}} relacji. |
| delete.relations_other | {{count}} relationships will be removed along with this person. | Wraz z tą osobą zostanie usuniętych {{count}} relacji. |
| delete.onlyPerson | This is the only person in the tree. The tree will be empty afterwards. | To jedyna osoba w drzewie. Po usunięciu drzewo będzie puste. |
| delete.split_one / _other | The tree will split into {{count}} separate parts. Parts cannot be reconnected yet. | Drzewo rozpadnie się na {{count}} oddzielne części. Części nie można jeszcze ponownie połączyć. |
| delete.split_few | | Drzewo rozpadnie się na {{count}} oddzielne części. Części nie można jeszcze ponownie połączyć. |
| delete.split_many | | Drzewo rozpadnie się na {{count}} oddzielnych części. Części nie można jeszcze ponownie połączyć. |
| delete.confirm | Delete | Usuń |
| delete.toast | Deleted {{name}} | Usunięto osobę {{name}} |
| delete.undo | Undo | Cofnij |
| delete.restored | Restored {{name}} | Przywrócono osobę {{name}} |

Notes:
- The "split" message is only shown for two or more parts, but all plural forms must still exist so the key-parity test passes.
- The existing keys (Save, Cancel, field labels, validation messages) are reused.

## 8. Acceptance Criteria

### Model
- [ ] **AC1.** Pure functions exist in `src/model/` for `updatePerson` and `deletePerson` plus a preview function that returns, for a given person: the number of edges that would be removed and the number of parts that would remain. None of them import React or mutate their input.
- [ ] **AC2.** `updatePerson` follows section 4.1, preserves unknown fields, and does not touch edges or other people. An unknown person id returns a typed error and changes nothing.
- [ ] **AC3.** `deletePerson` removes the person and **every** edge that references them as `from` or `to`, for all three relation types, and changes nothing else. Order of remaining nodes and edges is unchanged.
- [ ] **AC4.** Deleting a person never creates, changes, or removes edges between other people (section 4.3). `sibling` edges between the deleted person's children stay (scenarios D3 and D10).
- [ ] **AC5.** After any deletion the tree satisfies all earlier rules: no edge refers to a missing person, no duplicate edges, no person with more than two parents (for trees that satisfied this before).
- [ ] **AC6.** Deleting the last person gives a valid empty tree.
- [ ] **AC7.** The number of parts is computed with a tested function (connected components over all edge types), and handles zero, one, and many parts.

### Editing (UI)
- [ ] **AC8.** The Edit pill appears in the detail view with an accessible name, and opens the form from section 5.2 with the current values and the first name focused.
- [ ] **AC9.** Validation matches story 002, errors are translated and shown under the field, and Enter saves while Escape cancels.
- [ ] **AC10.** Scenarios E1 to E4 pass. After saving, the card, the heading, and the relations lists of connected people show the new name, and the person stays selected.
- [ ] **AC11.** Saving without a real change does not change the change counter or the export status.
- [ ] **AC12.** Editing a name does not move any card or line (positions are identical before and after, apart from the text).
- [ ] **AC13.** Polish characters work in edited names, and long names wrap or truncate as in story 002.

### Deleting (UI)
- [ ] **AC14.** The Delete button is at the bottom of the detail view, separated by a divider and space, is hidden while a form is open, and has a touch target of at least 44px.
- [ ] **AC15.** The confirmation dialog shows the title, the number of relationships (section 5.3), and the split warning (only when two or more parts will result).
- [ ] **AC16.** The relationship count and the split warning (with its part count) come from the model's preview function, so the dialog contains no rule logic of its own.
- [ ] **AC17.** The dialog uses `role="alertdialog"`, has an accessible title and description, traps focus, starts focus on Cancel, closes on Escape, and returns focus to the Delete button on cancel.
- [ ] **AC18.** Cancel and Escape change nothing.
- [ ] **AC19.** Confirming deletes the person and their edges. The dialog closes, nothing is selected, the detail view closes, the view fits the whole tree, and focus goes to the place described in section 5.4.
- [ ] **AC20.** Scenarios D1 to D6 and D10 pass.
- [ ] **AC21.** The dialog and buttons use only the styles from `DESIGN.md` (no red or other new colors), and the primary confirm button is the normal charcoal primary button.

### Undo
- [ ] **AC22.** After deleting, a toast with an **Undo** action appears for 10 seconds, can be closed, and is announced politely to screen readers. Undo can be used by keyboard.
- [ ] **AC23.** Undo restores nodes, edges, and their order exactly, restores selection to the restored person, and restores the change status and "leave site?" behavior to what they were before the deletion. A test shows export before the deletion and after Undo is byte-identical (D7).
- [ ] **AC24.** Undo is no longer offered after any other change to the tree, after a new deletion replaces it, or after the toast closes (D8).
- [ ] **AC25.** After Undo, the toast "Restored {{name}}" appears.

### Change tracking
- [ ] **AC26.** Editing (with a real change) and deleting set the status to "Changes not exported", and the "leave site?" warning behaves as defined in story 003.
- [ ] **AC27.** When the tree becomes empty after deletion, the Export button is hidden and no "leave site?" warning is shown.

### Disconnected parts and layout
- [ ] **AC28.** The layout function handles trees with several parts (and an empty tree) without error. Each part is laid out by the story 006 rules, parts are placed left to right by the earliest-created member, top rows are aligned, and the gap between parts is at least 96px (scenario D4).
- [ ] **AC29.** Layout unit tests for separate parts cover: two parts, three parts, a part consisting of a single person, and parts of very different sizes. The geometric invariants from story 006 (no overlapping cards, no line through a card, no overlapping lines) hold across all parts.
- [ ] **AC30.** Fit-to-screen, pan, zoom, selection, and highlighting work with several parts.
- [ ] **AC31.** Adding a relative to a person in any part works, and does not join parts or change other parts.
- [ ] **AC32.** After deleting (scenario D5), generation numbering is recalculated so there are no empty rows above the topmost people of each part.
- [ ] **AC33.** A tree with several parts exports and imports unchanged (round trip is byte-identical), and no edge refers to a deleted person.

### Language and text
- [ ] **AC34.** All new strings exist in both `en` and `pl`, none are hardcoded, and the key-parity test (with plural forms per language) passes.
- [ ] **AC35.** The relationships text uses the correct plural form for counts 0, 1, 2, 5, 12, and 22 in both languages (scenario D9), tested automatically.
- [ ] **AC36.** Switching language while the edit form, the dialog, or the toast is open updates the texts immediately without losing typed values or the Undo option.
- [ ] **AC37.** Dialog and form layouts work in both languages at 360px width without cut-off text.

### Quality
- [ ] **AC38.** A randomized test applies at least 200 random sequences (up to 60 operations each) of add-relative, edit, delete, and undo to a tree, and after every step checks: the file passes the schema, there are no dangling edges, no duplicate edges, no person has more than two parents (when it could not be avoided), the layout invariants hold, and the same sequence always produces the same result. The random seed is fixed and printed on failure.
- [ ] **AC39.** A component test covers: build a small tree → edit a name → delete a parent → check the tree and edges (the sibling edge between the children remains) → Undo → check the tree is restored.
- [ ] **AC40.** Fixtures with **fictional** data exist for D3, D4, and E4.
- [ ] **AC41.** `npm run lint`, `npm test`, and `npm run build` pass, and deployment still works.
- [ ] **AC42.** No real or sensitive data is added to the repository, names are not written to the console or logs, and the app makes no network requests.

## 9. Technical Notes

- Keep `deletePerson`, `updatePerson`, the preview, and the part counting in `model/`. The dialog calls the preview function to display numbers, so the UI never recomputes rules.
- Undo can store a snapshot of the previous tree and the change counters in the state at the moment of deletion. It is cleared on any other tree-changing action. Keep it to one snapshot only.
- Part counting is generic graph logic (connected components). Put it in a helper module that the layout can reuse.
- The layout of separate parts is a loop over parts followed by horizontal placement. Do not change the single-part algorithm to support it.
- Do not add dependencies.

## 10. Required Update to `AGENTS.md`

- Replace any statement that "the tree is always connected" with: the tree can consist of several unconnected parts, and can be empty. Add the layout rule for parts (section 5.5).
- Add a short **Destructive actions** principle: always confirm with a clear summary of consequences, offer a pre-selected safe option where possible, and offer a single-step Undo.
- Add `updatePerson` and `deletePerson` to the list of model operations and note the "cascade delete" rule (section 4.2).

## 11. Definition of Done

- All acceptance criteria are checked.
- Merged to `main`, GitHub Actions green, live site updated.
- Every scenario in section 6 was tried manually on the live site, on a real phone and on desktop, in both languages.
- `AGENTS.md` is updated as in section 10.
- No real or sensitive data in the repository.

## 12. How the Product Owner Will Verify

1. Select a person and press the pencil. Change the first name and save. The card and heading update. The status says "Changes not exported". Try saving with an empty first name and see the error.
2. Open the edit form and press Save without changing anything. Nothing changes, and the status stays the same.
3. Build a small tree with one parent and three children (added one after another to the parent). Select the parent and press **Delete person** (at the bottom of the detail view). The dialog says how many relationships will be removed and shows no split warning. Delete. The three children remain together, connected by their sibling edges.
4. Press **Undo** in the toast. Everything returns. Delete again, then add a person. The Undo option is gone.
5. Delete someone who links two families (a spouse). The dialog warns about two parts. After deleting, the two parts appear side by side, each nicely grouped. Fit-to-screen shows both.
6. Add a relative to someone in one of the parts. It works and the parts stay separate.
7. Delete everyone until one person is left, then delete that last person. The empty state returns and Export disappears.
8. Switch to Polish in the middle of the delete dialog and check the plural forms with 1, 2, and 5 relationships.
9. Export, reload, and import a tree that has separate parts. It looks the same.

## 13. Notes for Next Stories (not part of this story)

Likely next: **connecting two existing people** (needed to rejoin parts and to fix wrong or missing links), editing and deleting single connections, autosave to the browser, deeper import validation, more person fields (dates, notes), other parent types (adoptive, step), and general undo/redo.