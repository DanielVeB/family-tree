# Story 009: Stored position (level and order) and moving people in two directions

| | |
|---|---|
| **ID** | 009 |
| **Type** | Feature and bug-fix story (data, layout, interaction) |
| **Priority** | Must have |
| **Size** | Large |
| **Depends on** | Story 002 (model, canvas), 003 (export), 004 (import), 005 (relationship helpers, add relative), 006 (layout), 007 (edit, delete, Undo, several parts) |
| **References** | `AGENTS.md`, `DESIGN.md` |

## 1. User Story

**As a** user,
**I want** to drag a person to any place in the tree, up, down, left, or right, and have their ancestors, descendants, and partners move along,
**so that** I can arrange the tree the way my family really looks, and fix any case where the automatic placement is not what I want.

## 2. Context and Problem

Today the position of every person is **derived** from the structure of the tree every time it is drawn. This causes two problems:

1. **A visible bug (fictional example).** Dariusz's side has three known generations: grandparents Stefan and Helena, parents Marek and Ewa, then Dariusz. Celina's side has only her parents, Jan and Maria. Dariusz and Celina are married, so they are on the same level. But Jan and Maria are drawn on the top row, next to Stefan and Helena, instead of next to Marek and Ewa.
2. **No control.** The user cannot change the order of people in a row, or move a family elsewhere.

This story makes position **data that the app stores and the user controls**, in two directions:

- **Level** (`layer`): the row, counted from 0 at the top. This is the vertical direction.
- **Order** (`order`): the place in the row, counted from 0 at the left. This is the horizontal direction.

The app still calculates the exact pixel positions and the line routes (spacing, centering, lanes from story 006), but it now follows the stored level and order instead of deriving them.

> **No migration.** The app is not public and no existing tree has to keep working. A file without the new fields is **not accepted** (see 4.1). Existing test files must be recreated or exported again from the new version.

### What changes in earlier stories

| Earlier story | Change |
|---|---|
| 004 (import) | `metaData` with `layer` and `order` is required in the file. A file without it gets the generic error toast |
| 006 (layout) | Phase 1 (generations) and phase 3 (blocks and order, rules O1 to O5) are **replaced** by the stored level and order. Rules G1 to G6 and O1 to O5 are now used only to choose where a **new** person is placed (section 4.4). Spacing, centering, buses, brackets, lanes, and the geometric invariants stay. AC7 and AC24 are updated as described in section 5.8 |
| 007 (Undo) | Undo is extended from deletions to moves (still one snapshot only) |

The words "level" and "layer" mean the same. The UI says **level**, the file says `layer`.

## 3. Scope

### In scope
1. `metaData.layer` and `metaData.order` on every person: kept in memory, always exported, required on import.
2. Placement of new people, and cleanup after deleting.
3. Moving a person in any direction by drag and drop (desktop and touch), plus buttons and keyboard shortcuts as an accessible alternative.
4. A question about moving the connected people (ancestors, descendants, partners), with a pre-selected answer.
5. Undo for a move.
6. A layout that follows the stored positions and draws connections that span several levels.
7. Documentation and fixtures.

### Out of scope (do not build)
- Free pixel positions. Only the level and the order in the row are stored, never coordinates.
- Moving a person into another separate part of the tree, or moving a whole part.
- Creating a new empty level between or above existing levels.
- Typing a level or position number, multi-select, a "tidy up the whole tree" command.
- Any change to relation types, the two-parent rule, or other parts of the file format.
- Migrating files without `metaData`.
- Animating the move beyond a simple fade.

## 4. Behavior Rules

### 4.1 Data
Each node gets `metaData`, next to `id` and `data`:

```json
{ "id": "3f2c...", "data": { "firstName": "Anna", "lastName": "Testowa" }, "metaData": { "layer": 0, "order": 2 } }
```

- `data` holds facts about the person. `metaData` holds how the app shows them. Key order on export: `id`, `data`, `metaData`, and inside `metaData`: `layer`, `order`, then unknown fields.
- `layer`: integer, 0 or more, **0 = top level**, +1 for every level down.
- `order`: integer, 0 or more, **0 = leftmost** in the row.
- `metaData`, `layer`, and `order` are **required** in the zod schema. A missing field, or a value that is not an integer or is negative, makes the file "wrong shape" and gives the generic error toast from story 004. The version stays **1**.
- Unknown fields inside `metaData` are preserved on import and export (zod `passthrough`).
- Export always writes both values. Export stays deterministic, and export → import → export stays byte-identical.
- **Repair on import (not an error):** within each part (story 007), the levels are made consecutive from 0, and in each row the people are sorted by (`order`, creation order) and renumbered 0, 1, 2, … without gaps or duplicates. This is not a user change: the status is "Loaded from file". A file exported by the app is already in this form, so the repair changes nothing.
- Other inconsistencies (for example a child above its parent) are **not** checked on import (the limitation from story 004 stays). The layout must not crash on them, and must skip what it cannot place.

### 4.2 Position rules
These hold for every tree the app produces:

- **L1.** `layer` is an integer of 0 or more.
- **L2.** For every `child` edge, the parent's layer is **less** than the child's layer. The gap may be more than 1.
- **L3 (soft).** The two people of a `marriage` edge, and of an explicit `sibling` edge, are normally on the **same** layer. The app keeps it that way when it places people. Only a "move only this person" action (4.5) can break it. Such an edge is then drawn as a cross-layer elbow (5.8).
- **L4.** Within one part of the tree, the used levels are **consecutive from 0**. Different parts are independent, and each starts at 0 (this keeps story 007's "top rows aligned").
- **O1.** In each row of a part, `order` is 0, 1, 2, … without gaps or duplicates.

A **row** is all people of one part with the same layer.

### 4.3 When values are set or changed

| Moment | Rule |
|---|---|
| **First person** | `layer` 0, `order` 0 |
| **Add parent** of S | `layer` = S's layer − 1. If S is on layer 0, everyone in S's part moves down one level first, so the new parent gets layer 0 |
| **Add child** of S | `layer` = (largest layer among the new person's selected parents) + 1 |
| **Add sibling** or **partner** of S | S's layer |
| **`order` of the new person** | Chosen by the placement rules in 4.4. Everyone to the right of the chosen slot in that row gets `order` + 1 |
| **After the add** | If the result breaks L2 (possible after manual moves, for example when an extra link joins people on very different levels), the levels of that **part** are recalculated with `assignLayers` (4.6), the orders are kept where possible, and a toast says so (section 7) |
| **Edit person** | Unchanged |
| **Delete person** | Others keep their `layer` and `order`. Then L4 and O1 are restored for each resulting part (consecutive levels, consecutive orders in every row), keeping the existing order. Undo restores the exact snapshot |
| **Move** | Section 4.5 |

### 4.4 Where a new person is placed in the row
Pure function in `src/model/`. It receives the tree and the **current layout** (the center x of every card) and returns the new person's `order`. It never changes the order of existing people. It only shifts their numbers.

**General rule:** the new person is inserted **before the first person in the row whose center is to the right of the wanted position**, or at the end of the row if there is none. The wanted position and special cases:

| Relation | Wanted position and special cases |
|---|---|
| **Partner** of S | Immediately **right** of S. If S already has a partner on the right, immediately **left** of S. If both sides are taken, immediately right of the rightmost partner. If S sits in the **middle** of a sibling run, the partner is still placed immediately beside S (the sibling bracket passes above, as in story 006 rule O4) |
| **Sibling** of S | Immediately **right** of the last member of S's sibling run. A partner who stands beside that last member counts as part of the run |
| **Child** of S (and the selected other parent, if any) | After the last existing child of the **same parents**. If there is none: under the center of the parents' couple point (or under the single parent). If this slot falls inside a couple or a sibling run of other people, the nearest edge of that couple or run is used |
| **Parent** of S | In the row above, at S's center (or the center of S's sibling run), using the same "not inside a couple or run" rule. If S already has one parent P, the new parent goes immediately right of P |
| **First person** | `order` 0 |

### 4.5 Moving a person

**Definitions.** The moved person is **X** on level **L**. The user drops X on a target level **T** (an existing level in X's part, T = L is allowed) at a horizontal position. The vertical shift is **d = T − L**, and the horizontal shift is **dx**, the distance between X's center now and at the drop.

- **Connected set C(X):**
    - X,
    - all **ancestors** of X (parents, grandparents, and so on, through `child` edges),
    - all **descendants** of X (children, grandchildren, and so on),
    - and the **partners** (`marriage` edges, including chains of partners) of everyone in the list above.
    - Siblings and relatives by marriage (a partner's parents, a partner's other children) are **not** included.
- **Option A, "only this person":** only X moves.
- **Option B, "with connected people":** everyone in C(X) moves. All of them get the same vertical shift d and the same horizontal shift dx.

**Validity (vertical moves only).** An option is valid when, after the move, L2 still holds for every `child` edge between a moved and a non-moved person (the parent's level stays less than the child's). A move with d = 0 is always valid. Edges inside the moved set shift together and cannot break.

**Which UI appears:**

| Case | What happens |
|---|---|
| C(X) is only X | The move is applied at once (option A), if valid |
| C(X) has more people, A and B both valid | The **move dialog** (5.4) opens with the checkbox "Also move connected people" **pre-checked** |
| A valid, B invalid | The dialog opens with the checkbox **unchecked and disabled**, with the reason |
| A invalid, B valid | The dialog opens with the checkbox **checked and disabled**, with the reason |
| Both invalid | The level is **unavailable**: it is dimmed during the drag and nothing happens on drop |

**Applying a move** (set S = the people that move):
1. Each person in S gets `layer` + d.
2. For every row of the part, collect its people with a **sort key**: a person in S gets (current center x) + dx, any other person gets their current center x. Sort by key. Ties keep the previous order, then creation order. Renumber `order` 0, 1, 2, … in each row.
3. Restore L4 and O1 (no empty level, consecutive orders).
4. The layout is recomputed. The order is what the user controls. The exact x positions come from the layout rules (spacing, centering of children under parents), so they may differ slightly from the drop position.

**After the move:**
- If layers and orders are identical to before (for example a drop that does not pass anyone), **nothing changes**: no toast, no change counter, no status change.
- Otherwise the change counter increases (status "Changes not exported"), and a toast "Moved {{name}}" (or "Moved {{name}} and {{count}} connected people") appears with **Undo** for 10 seconds, following story 007 section 4.5: one snapshot only, cleared by any other change or when the toast closes.
- Selection is not changed by dragging. The view is not refitted, except that the moved person is kept visible (same rule as story 002 after a manual pan).
- Other parts are never affected. A person cannot be dropped outside the horizontal extent of their part's row: a drop beyond the left or right end puts them first or last in the row.

### 4.6 Recalculating levels (fallback only)
`assignLayers` is a pure function in `src/model/`, used only by the fallback in 4.3 and by tests. Per part:

1. Join people connected by `marriage` or explicit `sibling` edges into groups. Skip a join that would put a person in a group with one of their own ancestors (the skipped edge is drawn as a cross-layer elbow).
2. A group without parent groups gets level 0, any other group gets (largest parent level) + 1.
3. Go through the groups from the bottom up. A group with child groups gets (smallest child level) − 1. This moves parents down to just above their children.
4. Everyone gets their group's level. Restore L4.

Worked example (section 2): Stefan–Helena 0, Marek–Ewa 1, Dariusz–Celina 2, Jan–Maria 1.

## 5. Screens and Components

All visuals follow `DESIGN.md`. No new colors, no new button styles.

### 5.1 Dragging a card
- **Desktop:** press on a card and move more than 6px to start a drag. A click without movement still selects, as before. Dragging empty canvas still pans.
- **Touch:** touch and hold a card for about 400ms (the card's border becomes `--border-strong` as a cue). Moving the finger before that pans the canvas as before. While dragging, the page must not scroll.
- The card follows the pointer in **both directions**.
- Escape, or a drop outside the canvas, cancels the drag.
- Coordinates are converted correctly at any zoom and pan.

### 5.2 Level bands during a drag
- When a drag starts, a horizontal band appears behind the tree for each level of **the dragged person's part**, with a small label "Level {{n}}" (n = layer + 1) at the left edge.
- Bands use `--tint-faint`. The band under the pointer uses `--tint-hover` with a 2px `--ring` outline. **Unavailable levels are dimmed** (opacity 0.4) and have no outline.
- Availability of every level (option A or B valid) is computed **once** at the start of the drag.

### 5.3 Preview during a drag
- **Insertion line:** in the target row, a thin vertical line (2px, `--ring`) shows where the dragged person will be placed in the order.
- **Connected people:** when option B is valid for the level under the pointer, outlines of the connected people (border only, `--border-strong`, opacity 0.5) follow the pointer, moving by the same amount as the dragged card.
- A simple fade (about 150ms) is the only animation. Everything disappears when the drag ends.

### 5.4 Move dialog
- Opens after a drop that needs the question (4.5). Same style as other dialogs (modal on desktop, bottom sheet on mobile).
- Title: "Move {{name}}?"
- One **checkbox**: "Also move {{count}} connected people" (plural forms in both languages). Below it, the hint "Connected people are the ancestors, descendants, and partners."
- Pre-checked when B is valid. When the checkbox is disabled, the reason text appears under it, linked with `aria-describedby`.
- Buttons: primary **Move**, ghost **Cancel**. Focus starts on the checkbox. Escape cancels. Focus returns to the moved card afterwards. Checkbox style as in story 005 (native input, 44px row).

### 5.5 Position controls in the detail view
- Under the person's name: the caption "Level {{level}}" and **four icon pills** (44px): move up one level, move down one level, move left one place, move right one place.
- Up and down use T = L ∓ 1 with dx = 0. Left and right keep the level and act as if the card were dropped just past its left or right neighbor in the same row.
- A pill is disabled, with an explanation for screen readers too, when there is no level or neighbor in that direction, or when the level is unavailable.
- Each pill starts the same flow as a drag (including the dialog).
- Hidden while the edit or add-relative form is open.

### 5.6 Keyboard
- On a focused card, **Alt + Arrow keys** do the same as the four pills.
- After a move, a polite screen-reader message says "{{name}} moved to level {{level}}" when the level changed, and "{{name}} moved" otherwise.

### 5.7 Undo
Uses the toast and Undo from story 007. After Undo, a short toast "Move undone" appears, the tree and status return to exactly what they were, and the selection is restored.

### 5.8 Layout changes
The layout keeps story 006's rules for spacing (constants in `src/layout/config.ts`), couple points, buses, brackets, lanes, highlighting, and the geometric invariants. These changes apply:

- **Rows and order come from `metaData`.** Phase 1 (generations) and phase 3 (blocks and order) read the stored level and order. Rows are the levels of each part.
- **Positions follow the order.** Phase 4 places each row left to right in the stored order. Gaps depend on the relation of neighbors: the partner gap between married neighbors, the sibling gap inside a sibling group, otherwise the block gap. Children are centered under their parents' couple point (or single parent) where the order allows, and parents are centered above their children, with neighbors pushed apart as in story 006 rule G5. The order is never changed by the layout.
- **Row bands:** the layout also returns the vertical band of every row of every part, and the center x of every card, for the drag.
- **Children on a different level than the parents' next row:** the children bus is in the gap **directly above the children's level**. The vertical line from the couple point (or single parent) goes down to it, and if it would cross a card in an intermediate row, it is routed through a free vertical channel next to the cards with short horizontal steps in the gaps, each in its own lane (8px spacing). If an intermediate row has no free channel at that position, the gap there is widened only as much as needed.
- Children of the same parents on **different** levels get one bus per level.
- A `marriage` or `sibling` edge between people on **different** levels is drawn as an orthogonal elbow from the lower edge of the upper card to the upper edge of the lower card, in the normal line style, never through a card.
- Partners on the same level who are not adjacent are linked as in story 006, rule 6.1 (a line below the row, in its own lane).
- **Story 006 AC7** now reads: the layout depends on the tree structure and the stored level and order only. **AC24** now reads: adding one person never changes the left-to-right order of existing people in any row and never changes anyone's level, except the whole-part shift of 4.3 when a parent is added on level 0.

## 6. Scenario Catalogue

All fixtures use **fictional names**.

| ID | Given | When | Then |
|----|-------|------|------|
| **M1** | **The bug.** Jan–Maria have a child Celina. Add partner Dariusz to Celina. Add parents Marek–Ewa to Dariusz. Add parents Stefan–Helena to Marek | Each step is saved | After the last step: Stefan–Helena 0, Marek–Ewa 1, Dariusz and Celina 2, **Jan–Maria 1** (same row as Marek–Ewa). The whole part moved down when Stefan was added |
| **M2** | A file without `metaData`, or with a missing `layer` or `order`, a non-integer, or a negative number | Import | Generic error toast. The current tree is unchanged |
| **M3** | A file with duplicate or gapped orders and a gap in the levels | Import | Loads without error. Levels and orders are repaired as in 4.1. Status "Loaded from file" |
| **M4** | A person with no relatives in the set (C = only X) in a row with three people | Drag to the right of the last one | Moves at once, no dialog. The order of the row changes |
| **M5** | X has a partner, two children, a grandchild, and parents. All valid | Drag X to the right past some unrelated people | Dialog, checkbox pre-checked. **Checked:** X, the partner, the children, the grandchild, the parents, and the parents' partners get new orders so that each row reflects the same shift |
| **M6** | M5, but the checkbox is unchecked | Confirm | Only X moves. The partner stays, so the couple is no longer adjacent and is linked by a line below the row (story 006 rule 6.1) |
| **M7** | Anna on level 1 has a child Mia on level 2 | Drag Anna to level 2 | Option A is invalid (Mia would be level with her parent). Option B is valid (Mia moves too). Dialog with the checkbox **checked and disabled** and the reason. Anna goes to 2 and Mia to 3 |
| **M8** | X has a child directly below and a parent directly above. A child of X's parents (X's sibling) sits one level below the parents | Drag X's parents (with B) down by one level | Both options invalid (the sibling would be level with the parents). The level is dimmed and nothing happens on drop |
| **M9** | Option B would put a child of the partner's other relationship level with its parent, option A is fine | Drop | Dialog with the checkbox **unchecked and disabled**, and the reason. The move applies to X only |
| **M10** | A person and a drop on another level, further left | Drop | The level changes **and** the order changes in one step (diagonal move) |
| **M11** | Part 1 and part 2 on screen | Move someone in part 1 | Part 2 is unchanged. Each part keeps levels 0..k |
| **M12** | A drop far right of the part | Drop | The person becomes the last in the row. Dropping far left makes them first |
| **M13** | A move that leaves a level empty | Confirm | Levels are made consecutive and the picture shows no empty row |
| **M14** | After any move | Press Undo within 10 seconds | The tree is identical, and the export before the move and after Undo is byte-identical |
| **M15** | A drop on the same level that does not pass anyone | Drop | Nothing changes: no toast, no status change |
| **M16** | Co-parents Anna (layer 1) and Tomek (layer 2, moved manually), no marriage | Add a child to Anna with Tomek as other parent | The child gets level 3 |
| **M17** | A tree after manual moves where an added relative would break L2 | Save the new relative | The part's levels are recalculated, the person is added, and a toast says so |
| **M18** | Delete a person in the middle of a row, and the only top-level person of a part | Confirm | Orders in that row are consecutive, and the part's levels start at 0 with no empty row (extends story 007 D5) |
| **M19** | A person with a child two levels below | Draw | The line from the parents goes around the cards in the middle row and crosses none of them |
| **M20** | Keyboard and buttons | Focus a card, press Alt + Arrow Right, or press "Move right one place" | Same result as dropping the card just past its right neighbor, announced to screen readers |
| **M21** | **Placement fixtures:** (a) partner added to the last member of a sibling run, (b) partner added to a middle member, (c) a second partner, (d) a sibling added to a run whose last member has a partner, (e) a child added after existing children, (f) a first child added under a couple in a row that already has other families, (g) a second parent added | Add each | The new person lands as described in 4.4 and the existing people keep their relative order |
| **M22** | Any tree | Export, import, export | Byte-identical, and the same picture each time |
| **M23** | A person married to their own niece (fixture) | Import and layout | No crash. L2 holds. The marriage line is drawn as a cross-layer elbow, never through a card |

## 7. Language and Text (English / Polish)

Names use interpolation. Polish counted texts need all four plural forms.

| Key | English | Polish |
|-----|---------|--------|
| layers.level | Level {{level}} | Poziom {{level}} |
| layers.up | Move up one level | Przenieś o poziom wyżej |
| layers.down | Move down one level | Przenieś o poziom niżej |
| layers.left | Move left one place | Przenieś o jedno miejsce w lewo |
| layers.right | Move right one place | Przenieś o jedno miejsce w prawo |
| layers.unavailable | Not possible here: a child would end up level with or above a parent. | Niemożliwe: dziecko znalazłoby się na tym samym poziomie co rodzic lub wyżej. |
| layers.noNeighbor | There is nobody in this direction. | W tym kierunku nikogo nie ma. |
| layers.move.title | Move {{name}}? | Przenieść osobę {{name}}? |
| layers.move.also_one | Also move {{count}} connected person | Przenieś też {{count}} powiązaną osobę |
| layers.move.also_few | | Przenieś też {{count}} powiązane osoby |
| layers.move.also_many | | Przenieś też {{count}} powiązanych osób |
| layers.move.also_other | Also move {{count}} connected people | Przenieś też {{count}} powiązanej osoby |
| layers.move.hint | Connected people are the ancestors, descendants, and partners. | Powiązane osoby to przodkowie, potomkowie i partnerzy. |
| layers.move.reasonNeeded | They must move too, otherwise a child would end up level with or above a parent. | Muszą przenieść się razem, inaczej dziecko znalazłoby się na tym samym poziomie co rodzic lub wyżej. |
| layers.move.reasonBlocked | They cannot move to this level: a child would end up level with or above a parent. | Nie mogą przejść na ten poziom: dziecko znalazłoby się na tym samym poziomie co rodzic lub wyżej. |
| layers.move.confirm | Move | Przenieś |
| layers.toast.moved | Moved {{name}} | Przeniesiono osobę {{name}} |
| layers.toast.movedMany_one | Moved {{name}} and {{count}} connected person | Przeniesiono osobę {{name}} i {{count}} powiązaną osobę |
| layers.toast.movedMany_few | | Przeniesiono osobę {{name}} i {{count}} powiązane osoby |
| layers.toast.movedMany_many | | Przeniesiono osobę {{name}} i {{count}} powiązanych osób |
| layers.toast.movedMany_other | Moved {{name}} and {{count}} connected people | Przeniesiono osobę {{name}} i {{count}} powiązanej osoby |
| layers.toast.undone | Move undone | Cofnięto przeniesienie |
| layers.toast.recalculated | Levels were recalculated to fit the new relative. | Poziomy zostały przeliczone, aby pasowały do nowej osoby. |
| layers.announceLevel | {{name}} moved to level {{level}} | Osoba {{name}} przeniesiona na poziom {{level}} |
| layers.announce | {{name}} moved | Osoba {{name}} została przeniesiona |

Reused: `action.cancel`, the Undo label from story 007 (`delete.undo`), the toast close label. Users see level numbers starting at 1 (layer + 1). The file always stores `layer` starting at 0 and contains no translated text.

## 8. Acceptance Criteria

### Data and file
- [ ] **AC1.** `metaData` with `layer` and `order` exists in the zod schema and TypeScript types, is required on read and write, and unknown fields inside `metaData` are preserved.
- [ ] **AC2.** Export always writes `metaData` for every person, with the key order from 4.1. The `version` stays 1.
- [ ] **AC3.** A file with a missing `metaData`, a missing `layer` or `order`, a non-integer, or a negative value gets the generic error toast and changes nothing (M2). No migration code exists.
- [ ] **AC4.** Import repairs gaps and duplicates in levels and orders as in 4.1 (M3), silently, with the status "Loaded from file".
- [ ] **AC5.** Round trip export → import → export is byte-identical, including trees with several parts and long connections (M22).
- [ ] **AC6.** `docs/file-format.md` and the README describe `metaData`, rules L1 to L4 and O1, and state that files without it are not accepted.

### Placement and cleanup
- [ ] **AC7.** Add-relative operations set the level as in 4.3 and the order as in 4.4, atomically, and never change the order of existing people in a row (only shift their numbers) (M1, M15 to M17, M21).
- [ ] **AC8.** Adding a parent on level 0 moves the whole part down by one level (M1).
- [ ] **AC9.** If an add would break L2, the part's levels are recalculated with `assignLayers`, the person is added, and the toast from section 7 is shown (M17).
- [ ] **AC10.** `assignLayers` is pure, deterministic, has no React imports, and gives Stefan–Helena 0, Marek–Ewa 1, Dariusz–Celina 2, Jan–Maria 1 for fixture M1. It is unit-tested for a single person, two parts, a person with two partners, unmarried co-parents, and fixture M23 (no crash, L2 holds).
- [ ] **AC11.** After delete, L4 and O1 hold for every resulting part (M18), no other value changes, and Undo restores the exact snapshot.

### Moving: rules
- [ ] **AC12.** Pure functions in `src/model/` compute C(X), the validity of options A and B, the available levels for a person, and the move result. They have no React imports and are unit-tested for M4 to M10 and M12.
- [ ] **AC13.** C(X) contains exactly X, all ancestors, all descendants, and the partners (including chains of partners) of those, and never siblings or relatives by marriage (unit test with a fixture).
- [ ] **AC14.** A move applies atomically, returns a new tree, never mutates the old one, follows the three steps in 4.5, and leaves L1, L4, and O1 true (M13).
- [ ] **AC15.** A move changes only `layer` and `order`. It does not change `data`, edges, node order, or other parts (M11).
- [ ] **AC16.** A move that leaves all layers and orders identical (a cancelled drag, a cancelled dialog, M15) changes nothing, including the change counter and the status.
- [ ] **AC17.** A successful move increases the change counter, so the status shows "Changes not exported" and the leave-site warning behaves as in story 003.
- [ ] **AC18.** Dropping far outside a part's row end places the person first or last (M12).

### Moving: interaction
- [ ] **AC19.** On desktop, a press-and-move of more than 6px on a card starts a drag, a plain click still selects, and dragging the empty canvas still pans.
- [ ] **AC20.** On touch, a hold of about 400ms starts a drag. Moving earlier pans. The page does not scroll during a drag.
- [ ] **AC21.** During a drag, level bands with labels are shown for the person's part only, the target level is highlighted, unavailable levels are dimmed, and availability is computed once when the drag starts.
- [ ] **AC22.** The insertion line and the outlines of connected people follow section 5.3, and the outlines appear only when option B is valid for the level under the pointer.
- [ ] **AC23.** Escape and a drop outside the canvas cancel the drag. Dragging works at any zoom and pan, and on a 360px wide screen.
- [ ] **AC24.** Dragging does not change the selection or open the detail view.
- [ ] **AC25.** The detail view shows "Level {{level}}" and the four icon pills (44px) with accessible names and a disabled state and reason when a direction is not available (M20).
- [ ] **AC26.** Alt + Arrow keys on a focused card behave like the pills, and a polite announcement confirms the move.

### Moving: dialog and Undo
- [ ] **AC27.** The dialog appears only in the cases of the table in 4.5. The checkbox is pre-checked when both options are valid, checked and disabled when only B is valid, unchecked and disabled when only A is valid, each with the right reason text (M7, M9).
- [ ] **AC28.** The dialog follows section 5.4: title, counted checkbox label with correct plural forms, hint, Move and Cancel, focus on the checkbox, Escape cancels, focus returns to the moved card.
- [ ] **AC29.** Checked and unchecked results match M5, M6, and M7 exactly.
- [ ] **AC30.** After a move, the toast "Moved …" (or "Moved … and N connected people") offers Undo for 10 seconds, and Undo follows story 007 (one snapshot, cleared by any other change, closes with the toast). Export before the move and after Undo is byte-identical (M14).
- [ ] **AC31.** The plural forms of the counted texts are correct in English (1, 2, 5) and Polish (1, 2, 5, 12, 22), and tested automatically.

### Layout and drawing
- [ ] **AC32.** The layout places people by `metaData` (section 5.8), never changes the stored order, and all story 006 invariants hold (no card overlap, no line through a card, no overlapping lines closer than 8px, every relationship drawn once, deterministic). Story 006 AC7 and AC24 are updated as in 5.8, and every other changed earlier test is explained in the commit message.
- [ ] **AC33.** Fixture M1 is drawn with Jan–Maria in the same row as Marek–Ewa, and with the Dariusz–Celina children centered below their couple point.
- [ ] **AC34.** Children whose level is more than one below their parents are connected by a bus in the gap above their level, with the vertical line routed through a free channel (M19). Children of the same parents on different levels have one bus per level.
- [ ] **AC35.** Marriage and sibling edges between people on different levels are drawn as elbows. Partners on the same level who are not adjacent are linked as in story 006 rule 6.1 (M6, M23).
- [ ] **AC36.** The layout returns the vertical band of each row and the center x of each card, and the drag uses them.
- [ ] **AC37.** Layout stays a pure function, memoized by the tree (including `metaData`), and is not recomputed when only the selection, zoom, or pan changes. A 300-person tree lays out in under 150 ms in the test environment, and pan, zoom, and drag stay smooth with 100 people.

### Language and quality
- [ ] **AC38.** All new strings exist in both `en` and `pl`, none are hardcoded, plural forms exist for each language, and the key-parity test passes. Texts and controls work in both languages at 360px width without cut-off text. Switching language while the dialog or toast is open updates it immediately without losing the checkbox state or the Undo option.
- [ ] **AC39.** Component tests cover: import a valid file → move a person with the dialog (checked and unchecked) → Undo → export and compare the files. A second test covers the generic error for a file without `metaData`.
- [ ] **AC40.** A randomized test with a fixed, printed seed runs at least 200 sequences (up to 60 operations each) of add-relative, edit, delete, move, and Undo, and after every step checks: schema valid, L1, L2, L4, and O1 hold, no dangling or duplicate edges, the layout invariants hold, the same sequence gives the same result, and export → import → export is byte-identical.
- [ ] **AC41.** `npm run lint`, `npm test`, and `npm run build` pass, and deployment still works.
- [ ] **AC42.** No new dependency is added, no network request is made, no names are logged, and no real or sensitive data is added to the repo.

## 9. Technical Notes

- Put `assignLayers`, the placement function (4.4), C(X), the validity checks, and `moveSelection` in `src/model/`. The dialog, the bands, the preview, and the pills only render what these return. They contain no rules.
- The placement and move functions take the **layout output** (card centers) as input. The model stays free of React and of layout code: pass plain numbers in.
- Re-ranking in 4.5 is a sort per row. It is cheap, so it can also run on every pointer move for the insertion line (throttle to one run per animation frame).
- Phase 4 of the layout (positions in the stored order) can be done row by row from the top, with a left-to-right sweep that enforces the minimum gaps, followed by a bottom-up pass that centers parents above their children. Repeat for a fixed small number of passes. Do not add a layout library.
- The vertical channels for long connections follow the same lane logic as horizontal lanes (interval scheduling, 8px spacing).
- Prefer pointer events with `setPointerCapture`. Set `touch-action` only on the cards. Use a timer for the 400ms hold.
- A person with three or more parents, a dangling edge, or an L2 violation from an imported file must not crash the layout. Skip what cannot be placed.
- Do not add dependencies.

## 10. Required Update to `AGENTS.md`

- **Data model:** add `metaData: { layer: number; order: number; [key: string]: unknown }` to `PersonNode`, state that it is required and always exported, and add rules L1 to L4 and O1. Add that files without it are rejected.
- **Tree layout:** replace the derived generations and block order with the stored level and order, keep the spacing and line rules, and add the long-connection and elbow rules from 5.8 and the placement rules from 4.4.
- **Features:** add "move a person in any direction, with connected people" to the core features (section 6), and extend the Destructive actions and Undo wording to include moves.
- **Tests:** add the position tests and the extended randomized test to the testing requirements.

## 11. Privacy Note

Fixtures M1 to M23 are fictional. The product owner checks a real tree **locally** by building or re-exporting it with the new version. Real files, their names, and screenshots of them must not be committed (story 006, section 11, still applies).

## 12. Definition of Done

- All acceptance criteria are checked.
- Merged to `main`, GitHub Actions green, live site updated.
- The product owner built or re-created their real tree locally and confirmed that both families' parents on the two sides of a marriage are on the same level.
- Dragging was tried on a real phone (touch) and on desktop (mouse and keyboard), in both languages.
- `AGENTS.md`, README, and `docs/file-format.md` are updated.
- No real or sensitive data in the repo.

## 13. How the Product Owner Will Verify

1. Rebuild your family tree in the new version (a rough version is enough). Add a partner to someone on the lowest generation, then add parents to that partner, then add parents to those parents. Both spouses' parents end up on the same level.
2. Export and open the file. Every person has `"metaData": { "layer": n, "order": n }`. Import it again and export again. The two files are identical. Try importing an older file without `metaData`. The error toast appears and nothing changes.
3. Drag a person with no ancestors, descendants, or partners to the right past two others. They move at once, with no question.
4. Drag a person with a partner, children, and parents to the right. The dialog asks about connected people with the box ticked. Confirm. The whole line of the family follows in every row. Press Undo. Repeat with the box unticked. Only the person moves and the couple line goes below the row.
5. Drag a parent down onto the level of their child. The dialog shows the box ticked and disabled, with the reason, and both move down.
6. Drag someone so that a child would end up level with a parent when moving up. That level is dimmed and nothing happens on drop.
7. Drop a person diagonally (a different level and a different place). Both change in one step.
8. Select a person and use the four buttons, then Alt + Arrow keys on a focused card.
9. Move a child two levels below its parents. The line from the parents goes around the cards in between and crosses none of them.
10. Delete a person in the middle of a row and the only top person of a part. No gap and no empty top row remain.
11. On a phone, touch and hold a card to drag it, and drag the empty canvas to pan. Both work without scrolling the page.
12. Switch to Polish and check the dialog with 1, 2, and 5 connected people.

## 14. Notes for Next Stories (not part of this story)

Likely next: connecting two existing people (which also helps rejoin parts), a "tidy up" command that recalculates all levels and orders, dragging a person between parts, editing and deleting single connections, autosave, deeper import validation, more person fields, other parent types (adoptive, step), general undo/redo.