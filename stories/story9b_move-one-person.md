# Story 009b: Move one person at a time (appendix to story 009)

| | |
|---|---|
| **ID** | 009b |
| **Type** | Change to story 009 (appendix) |
| **Priority** | Must have |
| **Size** | Small (it mostly **removes** logic) |
| **Depends on** | Story 009 |
| **References** | `story9_position-and-drag.md`, `AGENTS.md`, `DESIGN.md` |

**How to read this appendix.** Read story 009 and this appendix together. Where they disagree, **009b wins**. Everything in story 009 that is not listed as removed or replaced below stays exactly as written (stored `layer` and `order`, required `metaData`, placement of new people, delete cleanup, layout rules, long connections, Undo, level bands, detail view pills, keyboard).

## 1. User Story

**As a** user,
**I want** dragging a person to move **only that person**,
**so that** moving is simple and predictable, and I arrange the family myself, one person at a time.

## 2. Context and Intent

Story 009 made a move carry the person's ancestors, descendants, and partners along, with a question dialog, two options, and rules about when each option is valid. That is a lot of logic and a lot of surprising cases.

This appendix removes all of it:

- A move changes **one person**: their level and their place in the row.
- Nobody connected to them moves. Partners, parents, and children stay where they are.
- If the user wants the rest of the family to follow, the user moves them too, one by one.

Because moving whole families is no longer automatic, the user needs to be able to make room. So a person can also be dropped on **a new level above or below** the existing ones (section 4.3).

## 3. Scope

### In scope
1. Single-person move (any direction, one rule set).
2. Drop zones for a new level above the top level and below the bottom level.
3. Removing the connected set, the options, the dialog, and the preview of connected people.
4. Updating the scenarios, texts, and acceptance criteria of story 009.

### Out of scope (do not build)
- Moving several people together, in any form (no multi-select, no "move with relatives").
- Inserting a new level **between** two existing levels.
- Any change to the stored data, the file format, the layout rules, or Undo.

## 4. Behavior Rules

### 4.1 What is removed from story 009

| Removed | Where in story 009 |
|---|---|
| The connected set C(X), options A and B, and the validity table | 4.5 |
| The move dialog and its checkbox | 5.4 |
| Outlines of connected people during a drag | 5.3 (second bullet) |
| The "also move connected people" texts and reasons, the counted toast | Section 7 (`layers.move.*`, `layers.toast.movedMany_*`) |
| Scenarios M5, M6, M7, M8, M9 | Section 6 |
| AC13, AC22 (the outlines part), AC27, AC28, AC29, AC31 | Section 8 |
| The horizontal shift `dx` and the sort-key re-ranking of everyone in the row | 4.5 "Applying a move" |
| The rule "a drop outside the existing levels is not possible" | 4.5 and 5.2 |

No code, texts, tests, or fixtures for the removed parts should remain.

### 4.2 Moving one person
The moved person is **X**, now on level **L**. The user drops X on a target level **T** at a horizontal position (T = L is allowed).

**Validity (vertical moves only).** A level T is **available** for X when:
- every **parent** of X is on a level **less than** T, and
- every **child** of X is on a level **greater than** T.

This is the story 009 rule L2, checked only for X's own edges. Partners and siblings are **not** checked: they can end up on different levels than X (rule L3 is soft). A move with T = L is always available.

**Applying a move.** Pure function `moveOne(tree, personId, targetLayer, dropX, layout)` in `src/model/`:
1. Remove X from its row and renumber that row.
2. Set X's `layer` to T.
3. In the target row (without X), insert X **before the first person whose center is to the right of `dropX`**, or at the end if there is none. Renumber the row (`order` 0, 1, 2, …). If the target is a new level, X is the only person there and gets `order` 0.
4. Restore L4 and O1 for the part: no empty level, consecutive levels from 0, consecutive orders. If a new level was created **above** the top, everyone in the part moves down one level so that X gets level 0.
5. Nobody else's `data`, edges, or relative order change. The **order of the levels** of other people is preserved. Only the numbers may shift because of step 4.

**No-op.** If the layers and orders are identical to before (a drop that does not pass anyone, or a lone person moved to a new level at the same end), **nothing changes**: no toast, no change counter, no status change.

**After a move** (unchanged from story 009): the change counter increases, a toast "Moved {{name}}" with **Undo** for 10 seconds appears (one snapshot, as in story 007), selection is not changed by dragging, the moved person is kept visible, and other parts are never affected.

**Consequences the user will see** (accepted on purpose):
- A partner left behind on another level is joined by a cross-layer elbow (story 009, 5.8). A partner left on the same level but not adjacent is joined by the line below the row (story 006, rule 6.1).
- Moving X between two partners, or into the middle of a sibling group, is allowed. The layout draws the connections as described above.
- Parents and children can be left far apart. The long-connection routing from story 009 draws them.

### 4.3 New level above or below
- While dragging, the bands from story 009 (5.2) are shown for every existing level of X's part **plus two extra bands**: one above the top level and one below the bottom level, each one card high and labeled "New level".
- A new-level band is **available** under the same rule as in 4.2. In practice: a person who has parents cannot go to a new level above, and a person who has children cannot go to a new level below. Unavailable bands are dimmed like unavailable levels.
- Dropping on a new-level band follows steps 1 to 5 of 4.2 (the target row has only X).
- The detail view pills "Move up one level" and "Move down one level" create a new level when X is on the top or bottom level. A pill is **disabled** when the move is unavailable (4.2) or would be a no-op (for example, a lone person on the top level moving up).

### 4.4 The left and right pills and keys
"Move left one place" and "Move right one place" **swap X with its neighbor** in the row. They are disabled at the ends of the row. Alt + Arrow Left and Alt + Arrow Right do the same.

### 4.5 Availability during a drag
Availability of every band (existing levels and the two new-level bands) is computed **once at the start of the drag**, from X's own parents and children only.

## 5. Screens and Components

All visuals follow `DESIGN.md`. No new colors and no new components.

- **Drag preview:** the dragged card, the level bands (including the two "New level" bands), the dimming of unavailable bands, and the insertion line (2px `--ring`) in the target row. Nothing else follows the pointer.
- **No dialog** appears for a move. A valid drop is applied immediately and the Undo toast appears.
- The detail view, the four pills, the keyboard shortcuts, and the announcements from story 009 stay.

## 6. Scenario Catalogue (replaces M5 to M9; M1 to M4 and M10 to M23 stay)

| ID | Given | When | Then |
|----|-------|------|------|
| **N1** | X has a partner, two children, and parents, in rows with other people | Drag X right, past two unrelated people in the same row | Only X's `order` changes (others are renumbered but keep their relative order). Partner, children, and parents are not moved. The couple is now linked by the line below the row. The Undo toast appears and no dialog |
| **N2** | X has parents on level 0 and a child on level 3, and X is on level 1 | Drag X to level 2 | Available, moves at once. The connections are redrawn (the parent line now spans two levels) |
| **N3** | Anna on level 1 has a child Mia on level 2 | Drag Anna to level 2 | Level 2 is unavailable (dimmed). Nothing happens on drop |
| **N4** | Mia on level 2 has a parent Anna on level 1 | Drag Mia to level 1, or to a new level above | Both are unavailable (dimmed) |
| **N5** | A person with no parents or children | Drop on another level at a place to the left of the row | Level and order change in one step, with no dialog |
| **N6** | A person on level 1 with no parents | Drop on the "New level" band above the top | A new top level exists. The whole part moves down by one level in the numbers, X gets level 0, and the picture shows X alone on the new top row |
| **N7** | A person with children | Drop on the "New level" band below the bottom | Unavailable (dimmed) |
| **N8** | X is the only person on level 1 of 3 | Drop X on level 2 | Level 1 becomes empty, so the levels are made consecutive and no empty row remains |
| **N9** | A lone person on the top level | Press "Move up one level" | The pill is disabled (it would change nothing) |
| **N10** | X in a row of four people | Press "Move right one place", or Alt + Arrow Right | X swaps with its right neighbor. Nobody else changes. Disabled at the right end |
| **N11** | Part 1 and part 2 | Move someone in part 1 | Part 2 is unchanged |
| **N12** | Any move | Press Undo within 10 seconds | The tree is identical, and the export before the move and after Undo is byte-identical |
| **N13** | A drop on the same level that does not pass anyone | Drop | Nothing changes: no toast, no status change |
| **N14** | Rebuilding by hand: Jan and Maria are on level 0 and their child Celina is on level 2, next to her partner | Drag Jan, then Maria, one by one, to level 1 | Each move is available and applies alone. After both, they are on the row of Marek and Ewa. This is the intended way to fix such cases |

## 7. Language and Text (English / Polish)

**Removed keys:** `layers.move.title`, `layers.move.also_*`, `layers.move.hint`, `layers.move.reasonNeeded`, `layers.move.reasonBlocked`, `layers.move.confirm`, `layers.toast.movedMany_*`.

**Changed key:**

| Key | English | Polish |
|-----|---------|--------|
| layers.unavailable | Not possible here: parents must stay above their children. | Niemożliwe: rodzice muszą pozostać nad swoimi dziećmi. |

**New key:**

| Key | English | Polish |
|-----|---------|--------|
| layers.newLevel | New level | Nowy poziom |

**Kept from story 009:** `layers.level`, `layers.up`, `layers.down`, `layers.left`, `layers.right`, `layers.noNeighbor`, `layers.toast.moved`, `layers.toast.undone`, `layers.toast.recalculated`, `layers.announceLevel`, `layers.announce`. The key-parity test must pass with the removed keys gone.

## 8. Acceptance Criteria

### Replaced or removed (from story 009)
- [ ] **AC1.** Everything listed in 4.1 is removed from code, texts, tests, and fixtures. A search for `connected`, `ancestor`, `descendant`, and `moveSelection` in the move code finds nothing left over.
- [ ] **AC2.** Story 009 AC12 now reads: pure functions in `src/model/` compute the availability of a level for a person and the result of `moveOne`. They have no React imports and are unit-tested for N1 to N10 and N13.
- [ ] **AC3.** Story 009 AC14 and AC15 now read: a move applies atomically, returns a new tree, never mutates the old one, follows the five steps in 4.2, leaves L1, L4, and O1 true, and changes only the `layer` and `order` values of people (never `data`, edges, or other parts).
- [ ] **AC4.** Story 009 AC21 and AC22 now read: during a drag, bands with labels are shown for the person's part (including the two "New level" bands), the target is highlighted, unavailable bands are dimmed, availability is computed once at the start of the drag, and the insertion line is shown in the target row. Only the dragged card follows the pointer.
- [ ] **AC5.** Story 009 AC25 now reads: the detail view shows "Level {{level}}" and the four icon pills (44px) with accessible names, and a pill is disabled with an explanation for screen readers when the move is unavailable, would be a no-op, or has no neighbor.
- [ ] **AC6.** Story 009 AC30 now reads: after a move, the toast "Moved {{name}}" offers Undo for 10 seconds with the story 007 behavior, and the export before the move and after Undo is byte-identical.

### New behavior
- [ ] **AC7.** Only X changes. After any move, for every other person, the left-to-right order within their row and the order of the levels are unchanged (property test over random moves).
- [ ] **AC8.** A level is available exactly under the rule in 4.2 (all parents above, all children below), for existing levels and for the two new-level bands (N2 to N4, N7). Partners and siblings are never checked.
- [ ] **AC9.** Dropping on a new level above the top shifts the numbers of the whole part by one and gives X level 0 (N6). Dropping on a new level below the bottom gives X the last level plus one. A person with parents cannot go above, and a person with children cannot go below.
- [ ] **AC10.** No dialog appears for any move. A valid drop is applied at once.
- [ ] **AC11.** Moves that leave a level empty close the gap (N8). Moves that change nothing do nothing (N9, N13).
- [ ] **AC12.** The left and right pills and Alt + Arrow Left and Right swap X with its neighbor and are disabled at the ends (N10). Up and down pills and keys create a new level at the ends when available.
- [ ] **AC13.** A partner or sibling left on another level is drawn with the cross-layer elbow. A partner left on the same level but not adjacent is drawn with the line below the row. No line goes through a card (N1, N2).
- [ ] **AC14.** The randomized test of story 009 (AC40) now uses the single-person move and its checks stay the same. The relative-order property from AC7 is added to it.
- [ ] **AC15.** All texts follow section 7 in both languages, and the key-parity test passes.
- [ ] **AC16.** `npm run lint`, `npm test`, and `npm run build` pass, deployment still works, no new dependency is added, and no real or sensitive data is added to the repo.

## 9. Technical Notes

- This change deletes more than it adds. Delete the set computation, the dialog component, the preview outlines, and their tests first, then add `moveOne`.
- `moveOne` needs the layout only for the center x of the people in the target row (to find the insertion slot). Pass plain numbers in.
- The availability check is a loop over X's parents and children. Run it for every band once at the start of the drag.
- The "New level" bands use the same component as the level bands, with a different label and height.
- Do not add dependencies.

## 10. Required Update to `AGENTS.md`

In the core features, the line added by story 009 reads "move a person to any place in the tree, **one person at a time** (nothing connected moves with them), including to a new level above or below". Remove any mention of moving connected people.

## 11. Definition of Done

- All acceptance criteria are checked.
- Merged to `main`, GitHub Actions green, live site updated.
- Verified on a real phone (touch) and on desktop (mouse and keyboard), in both languages.
- No real or sensitive data in the repo.

## 12. How the Product Owner Will Verify

1. Drag a person with a partner and children to the right, past two other people. Only that person moves. The partner, parents, and children stay. The couple is now joined by a line below the row. No question appears.
2. Press Undo in the toast. The tree returns exactly.
3. Drag a parent down onto the level of their child. That level is dimmed and nothing happens on drop. Do the same for a child going up onto the parent's level.
4. Move a child so that it is two levels below its parents. The line goes around the cards in between.
5. Drag a person who has no parents to the "New level" band above the tree. They appear alone on a new top row.
6. Drag a person who has children to the "New level" band below. It is dimmed.
7. Fix a mismatched family by hand: move the two people of the shorter family down one level, one at a time, until they stand next to the other parents.
8. Select a person and use the four buttons, then Alt + Arrow keys on a focused card. The left and right buttons swap places with the neighbor.
9. Switch to Polish and check the texts, including "Nowy poziom".

## 13. Notes for Next Stories (not part of this story)

Likely next: a command to move a person together with their relatives (as an explicit, optional action, if the one-by-one work turns out to be too slow), a "tidy up" command that recalculates all levels and orders, inserting a new level between two levels, connecting two existing people, dragging a person between parts.