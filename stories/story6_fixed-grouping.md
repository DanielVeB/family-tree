# Story 006: Smarter grouping of people and clearer connector lines

| | |
|---|---|
| **ID** | 006 |
| **Type** | Improvement story (layout and visualization) |
| **Priority** | Must have |
| **Size** | Large |
| **Depends on** | Stories 002 (layout, canvas), 005 (parents, siblings, partners rules). Stories 003 and 004 are used for fixtures. |
| **References** | `AGENTS.md`, `DESIGN.md` |

## 1. User Story

**As a** user,
**I want** people on the same generation to be grouped by their real family relationships, and connector lines to be drawn so they never overlap or run over unrelated people,
**so that** I can see at a glance who is a sibling of whom, who is a couple, and which families are only connected through a marriage.

## 2. Context and Problem

Today, the people on one generation row are placed mostly in the order they were added, and sibling relationships are drawn as separate lines between every pair of siblings, above the row. In a real tree this gives two problems:

1. **Wrong grouping.** Two unrelated families that sit on the same generation (for example, three siblings with parents above them, and, next to them, two brothers whose parents are not in the tree) end up mixed together in one row, and are only connected by one marriage.
2. **Overlapping lines.** Sibling lines, couple lines, and parent-child lines run on top of each other. The result looks as if **everyone on the row is a sibling of everyone else**.

The product owner's own tree (kept **out of the repository**, see section 11) is the reference case: generation 1 contains the siblings of one spouse and, next to them, the brother pair and the brother's wife from the other spouse's side. They should look like two separate groups joined by one couple.

This story changes **only layout and drawing**. The data model and the file format do not change.

## 3. Goals

1. **Group by relationship, not by order added.** Siblings together, couples together, families visibly separate from each other.
2. **Visual separation.** Unrelated groups on the same row are clearly separated by space.
3. **One clear line per relationship group**, not one line per pair.
4. **Lines at different heights ("lanes")** wherever they would otherwise overlap, so each relationship can be followed by eye.
5. **Lines never run through cards.**
6. **Deterministic and stable.** The same tree always gives the same picture, and adding a person does not rearrange the rest.

## 4. Definitions

Based on story 005, section 3.1 (parents, children, partners, co-parents, siblings), plus:

- **Generation row:** all people at the same level (story 002 rules).
- **Sibling group:** all people connected by sibling relationships, either `sibling` edges or shared parents, taken together (if A–B and B–C are siblings, then A, B, and C form one group).
- **Couple:** two people connected by a `marriage` edge. A person can be in several couples.
- **Outside partner:** a partner who is **not** in the person's sibling group.
- **Block:** a sibling group together with the outside partners that are placed beside it. A person with no siblings forms a block of one.
- **Couple point:** the middle of the line between two adjacent partners. Children of the couple connect to it.
- **Lane:** a horizontal track, at a fixed vertical offset, in the space between two rows, or just above or below a row, used to draw one line segment so that segments do not overlap.

## 5. Layout Rules (grouping and order)

### 5.1 Grouping
- **G1.** Members of a sibling group are placed **next to each other** (contiguous) in the row.
- **G2.** Partners are placed **next to each other**. A person with two partners has one on each side.
- **G3.** An outside partner is placed at the **edge** of their partner's sibling group, outside the group. A partner has no relation to the group's other members and must not look like one of them.
- **G4.** The partner's own sibling group (and that group's outside partners) form a separate block next to it. The two blocks meet at the couple.
- **G5.** Children of a couple (or of a single parent) are placed **below** the parents, as a block, **centered under the couple point** (or under the single parent). If the children's block is wider than the parents' unit, the parents' unit is centered above the children and neighboring blocks are pushed apart. Blocks never overlap.
- **G6.** Children of different couples stay in separate blocks, even if they have the same parent (half-siblings): each block is under its own couple point.

### 5.2 Order of blocks within a row
- **O1.** In the top row, blocks are ordered by the creation order of their earliest member.
- **O2.** In other rows, a block with parents in the tree is placed under its parents' unit, in the same left-to-right order as the parents' units.
- **O3.** A block **without** parents in the tree (for example, a partner's family) is placed directly next to the block containing the partner, on the **right** side by default. If the right side of that edge is already taken by another partner link, it is placed on the left.
- **O4.** Inside a sibling group, members are ordered by creation order, except that a member with an outside partner moves to the matching **edge** of the group (the side facing the partner's block). At most one member per edge. If more members have outside partners, the extra partners stay directly beside their own member inside the run (the sibling group is then not interrupted by anyone except those partners, and the sibling line passes above them in its own lane).
- **O5.** All remaining ties are broken by the earliest creation order, so the result is deterministic.

### 5.3 Spacing (tunable constants in one config file)

| Constant | Value | Meaning |
|---|---|---|
| Partner gap | 32px | Between two partner cards (the visible couple line) |
| Sibling gap | 24px | Between siblings in one group |
| Block gap | 64px or more | Between different blocks on one row (at least **2.5 times** the sibling gap) |
| Row gap (minimum) | 96px | Between rows, grows when more lanes are needed |
| Lane spacing | 8px | Vertical distance between two lanes |

- Spacing follows the 8px scale from `DESIGN.md`.
- The row gap grows automatically to hold all lanes needed in that gap, so lines never crowd the cards.

## 6. Line Rules (drawing)

All lines use the single `--line` style from `DESIGN.md` (1.5px, same color), with orthogonal segments (horizontal and vertical) and corners rounded to at most 6px. Types are told apart by **shape and position**, as before.

### 6.1 Couple line
- Between **adjacent** partners: a straight horizontal line at the cards' mid-height.
- If the couple has at least one child, a small filled dot (6px) marks the **couple point** in the middle of the line. Couples without children show only the line.
- If partners cannot be adjacent (for example, a person with three partners, or two families linked by two marriages), the couple line is routed **below the row**: down from the bottom of each partner card, along its own lane under the row, and up to the other partner. It never crosses a card.

### 6.2 Children lines (bus)
- From the **couple point** (or from the bottom center of a single parent) a vertical line goes down to a **bus**: one horizontal line in a lane in the gap below the row, spanning from the leftmost to the rightmost child. Each child gets a short vertical drop from the bus to the top center of its card.
- A child with **two parents who are not adjacent** partners gets one drop from each parent's bottom center to the same bus.
- A child of only **one** parent, even if that parent has a partner, connects from that parent's bottom center, not from the couple point.
- Half-siblings: each couple point has its own bus, in separate lanes if their horizontal extents would overlap.

### 6.3 Sibling lines
- Siblings who share a parent are already shown by the children bus, so **no extra sibling line is drawn** for them.
- For a sibling group (or part of one) that is connected only by `sibling` edges and is **not** shown together by a shared-parent bus, one **bracket** is drawn **above the row** in its own lane: a single horizontal line from the leftmost to the rightmost member, with a short vertical drop to the top center of each member. There is one bracket per group, never one line per pair.
- A bracket never extends over people who are not in its group, except the partners that stay beside a member inside the run (rule O4). In that case it passes above them.

### 6.4 Lanes
- Line segments in the same gap (or above or below the same row) whose horizontal extents overlap are assigned **different lanes**, 8px apart.
- Lanes are assigned deterministically and so that the number of crossings is as small as reasonably possible. Perfect optimization is not required.
- Two lines that belong to different relationships never share a segment and never run alongside each other closer than the lane spacing.
- Lines may cross only at **right angles**. A crossing without a connection must be unambiguous: no dot and no joined corner at a crossing.
- A connection of lines (a drop meeting a bus, a drop meeting a couple point) is drawn as a clean T-shaped junction.

### 6.5 Highlighting the selected person
- When a person is selected, all lines that belong to **that person's relationships** (their couple lines, the lines to their parents and children, and their sibling bracket) are drawn in full charcoal (`--charcoal`) and 2px wide. All other lines stay in the normal `--line` style.
- This is not color-only: the line is also thicker, and the relations list in the detail view still gives the same information in text.

## 7. Scenario Catalogue (test fixtures)

All fixtures use **fictional names** and are stored as files in `src/sample/` or `tests/fixtures/`. Each is an automated layout test that checks the structure below, plus the general invariants in section 8.

| ID | Tree | Expected result |
|----|------|-----------------|
| **L1** | **Two families joined by a marriage.** Jan and Maria Testowy have three children, Adam, Beata, and Celina (all linked as siblings and as children of both). Celina is married to Dariusz Przykładowy. Dariusz has a brother Edward, who is married to Franciszka. (Dariusz and Edward have no parents in the tree.) Celina and Dariusz have two children, Halina and Ireneusz. Ireneusz has a partner, Janina. | Row 0: Jan–Maria. Row 1: **[Adam, Beata, Celina] then [Dariusz, Edward, Franciszka]**, with a clear block gap between Celina's group and Dariusz's group, and Celina next to Dariusz. Row 2: [Halina, Ireneusz, Janina] centered under the Celina–Dariusz couple point. No sibling line between Adam, Beata, and Celina (the shared-parent bus shows them). One bracket for Dariusz–Edward only, above row 1, not over Celina's group. |
| **L2** | A simple family: one couple with three children, no other relatives. | One couple point, one bus, children centered below. No regression against story 002 results. |
| **L3** | Two unrelated couples on the same row (joined only through a common ancestor three generations up), each with children. | Two separate blocks with a block gap, each child group centered under its own couple. |
| **L4** | Four siblings, three of them married to outsiders. | Two married siblings at the two edges with partners outside; the third married sibling stays inside the run with the partner beside them; one sibling line (only if not shown by a shared-parent bus) passes above that partner, in its own lane. |
| **L5** | **Cousin marriage.** Two sibling groups [X1, X2] and [Y1, Y2] linked by two marriages (X1–Y1 and X2–Y2). | One couple adjacent. The other couple line is routed **below the row** in a lane, with drops from both cards. No line crosses a card. |
| **L6** | **Half-siblings.** Person X with two partners, P1 and P2, and one child with each. | P1, X, P2 in a row with two couple points. Two separate child blocks, each under its own couple point, with separate buses in separate lanes. |
| **L7** | **Single parent with a partner who is not the other parent.** Person A with partner B and a child of A only. | The child's line comes from A's bottom center, not from the couple point of A and B. |
| **L8** | **Unmarried co-parents.** Two people share a child but have no marriage edge. | Both parents get a drop to the same bus. No couple line or couple point. |
| **L9** | **Large sibling group.** Eight siblings, all married. | No overlaps, all partners beside their siblings, all lines in distinct lanes, and the view is still fit-able. |
| **L10** | **Three generations on both sides.** Both spouses have parents and grandparents in the tree. | Two ancestor trees side by side, meeting at one couple, with grandchildren centered below. |
| **L11** | **Sibling group without parents.** Three siblings, no parents in the tree. | One bracket above all three in one lane, with drops to each. |
| **L12** | **Insertion order.** The L1 tree built in two different orders (for example, children first and parents later). | The grouping invariants hold in both. Each build is individually deterministic. |

## 8. Acceptance Criteria

### Grouping and order
- [ ] **AC1.** Rules G1 to G6 and O1 to O5 are implemented in the layout function and demonstrated by fixtures L1 to L12.
- [ ] **AC2.** In fixture L1, the order in row 1 is [Adam, Beata, Celina], then [Dariusz, Edward, Franciszka], with Celina directly next to Dariusz, and in row 2 the children are centered under the Celina–Dariusz couple point.
- [ ] **AC3.** The gap between blocks on a row is at least 2.5 times the gap between siblings in a group, and the difference is visible in the picture.
- [ ] **AC4.** Members of a sibling group are contiguous, apart from the partners allowed by rule O4. A test checks that no non-member (other than allowed partners) sits between two members of the same group.
- [ ] **AC5.** Partners are adjacent whenever adjacency is possible. A test checks this for every fixture.
- [ ] **AC6.** Children's blocks are centered under their couple point or single parent, unless pushed apart by neighboring blocks, and a test checks the offset is 0 where no push is needed.
- [ ] **AC7.** Layout depends on the tree structure and the creation order only. It does not depend on card sizes beyond the shared constants.

### Spacing
- [ ] **AC8.** All spacing values from section 5.3 live in one config file and are used everywhere, with no magic numbers elsewhere.
- [ ] **AC9.** The row gap grows to fit the lanes needed in it. A fixture with many overlapping lines still shows lanes 8px apart and no line touching a card.

### Line drawing
- [ ] **AC10.** Couple lines are drawn between adjacent partners at mid-height, with a couple point dot only for couples that have children.
- [ ] **AC11.** Children are connected with a single bus per couple point (or single parent), with drops to each child. No per-pair lines between siblings who share a parent.
- [ ] **AC12.** Sibling brackets appear only for sibling groups not already shown by a shared-parent bus, with one bracket per group and no pairwise lines (fixtures L1, L4, L11).
- [ ] **AC13.** A child with two non-adjacent parents gets a drop from each parent to the same bus (L8), and a child of one parent only connects from that parent, not from the couple point (L7).
- [ ] **AC14.** Couples that cannot be adjacent are linked by a line routed below the row in its own lane (L5).
- [ ] **AC15.** Half-siblings have separate buses under their own couple points, in separate lanes where their extents overlap (L6).
- [ ] **AC16.** Corners are rounded to at most 6px, line width and color follow `DESIGN.md`, and no new colors or dashes are added.
- [ ] **AC17.** Junctions are clean T-shapes, and non-connected lines cross only at right angles with no dot (checked in a unit test of the path geometry).

### Geometric invariants (automated for every fixture and for random trees)
- [ ] **AC18.** No two cards overlap.
- [ ] **AC19.** No line segment passes through any card rectangle, except at its own attachment point on the card's edge.
- [ ] **AC20.** No two segments that belong to different relationships overlap or run parallel closer than 8px over a shared stretch.
- [ ] **AC21.** Every relationship in the tree is drawn exactly once (no missing and no duplicate lines), and a test maps each edge or relationship group to its drawn path.
- [ ] **AC22.** A randomized test builds at least 200 random trees using the add-relative operations from stories 002 and 005 (up to 40 people each), runs the layout, and checks AC18 to AC21 on every one. The random seed is fixed and printed on failure.

### Stability and determinism
- [ ] **AC23.** The same tree always gives exactly the same layout (positions and paths), including after export and import.
- [ ] **AC24.** Adding one person never changes the relative left-to-right order of existing blocks in any row, and never moves existing people vertically between rows. Existing people may shift horizontally to make room. A test checks this over a sequence of additions.
- [ ] **AC25.** Fixture L12 shows that grouping invariants hold regardless of the order in which people were added.

### Highlighting
- [ ] **AC26.** Selecting a person draws that person's relationship lines in full charcoal at 2px, and everything else in the normal line style. Deselecting restores them.
- [ ] **AC27.** Highlighting does not move any card or line, and the detail view's relations list is unchanged.

### Performance
- [ ] **AC28.** Layout is a pure function with no React imports, memoized by tree, and not recomputed when only the selection, zoom, or pan changes. (Highlighting is applied at drawing time.)
- [ ] **AC29.** Layout of a 300-person tree takes less than 150 ms in the automated test environment, and pan and zoom stay smooth on a mid-range phone with a 100-person tree.
- [ ] **AC30.** No new dependency increases the bundle by more than a few kilobytes (gzipped). Large layout libraries (for example, `elkjs`) must not be added without checking the size budget in `AGENTS.md`. A custom algorithm for these rules is expected.

### Regression and quality
- [ ] **AC31.** All earlier tests still pass. Story 002 and story 005 layout tests are updated only where the new rules intentionally change the result, and each such change is explained in the pull request or commit message.
- [ ] **AC32.** The story's fixtures round trip: export → import → layout gives identical results.
- [ ] **AC33.** The picture is correct at 360px width and at desktop width, the fit-to-screen button still fits the whole tree, and selecting, adding, pan, and zoom still work.
- [ ] **AC34.** There are no new user-facing strings. If any are added, they exist in both English and Polish and pass the key-parity test.
- [ ] **AC35.** No real or sensitive data is added to the repository. All fixtures use fictional names (see section 11).
- [ ] **AC36.** `npm run lint`, `npm test`, and `npm run build` pass, and deployment still works.

## 9. Out of Scope (do not build)

- Dragging cards or letting the user choose the order manually.
- Collapsing or expanding branches.
- Group containers, background boxes, or text labels around families.
- Different colors or dashed styles for relationship types.
- Printing or exporting the picture.
- New relation types, changes to the file format, or automatic repair of inconsistent imported data.
- Animating card movement.

## 10. Technical Notes

- Keep `computeLayout(tree)` a pure function in `src/layout/`, returning positions, block and group information, and routed paths. Split it into clear phases that can be tested separately:
    1. generations (rows),
    2. sibling groups and couples,
    3. blocks and their order (section 5.2),
    4. horizontal positions (children centered under parents, with minimum gaps),
    5. line routing and lane assignment (section 6).
- Represent each line as a list of orthogonal segments with a relationship id, so the invariants (no overlap, no card crossing) can be tested directly on the geometry.
- Reuse the relationship helpers from story 005 (`children of`, `parents of`, `partners of`, `siblings of`). Do not recompute relationships in the layout code.
- Lane assignment is an interval-scheduling problem: sort segments by start position and assign the first lane that is free, with a deterministic tie-break.
- The test helper that checks geometric invariants should be reused for fixtures and for the randomized test.
- A person with three or more parents, an inconsistent imported file, or a dangling edge must not crash the layout. The function should skip what it cannot place and keep the rest (full validation remains a later story).
- Update only drawing code in components. Components must not contain layout decisions.

## 11. Privacy Note About the Reference File

The product owner provided an exported tree of their own real family as a reference case.

- **Do not commit that file** (or its names) to the repository, the tests, screenshots, or commit messages. The repository is public.
- Fixtures L1 to L12 are fictional versions of the same shapes.
- For manual checking, the product owner imports the real file locally on their own device through the app's Import button. The file never leaves the browser.
- Reminder: `.gitignore` should keep real exports out (`*.family.json`, `my-tree*.json`, `family-tree-*.json`). Add the last pattern if it is not there yet.

## 12. Required Update to `AGENTS.md`

- Add a **Tree layout** section with the grouping rules (section 5), the line rules (section 6), the spacing constants (section 5.3), and the geometric invariants (AC18 to AC21).
- Add `family-tree-*.json` to the privacy and `.gitignore` guidance, so exported files with real data are not committed by accident.

## 13. Definition of Done

- All acceptance criteria are checked.
- Merged to `main`, GitHub Actions green, live site updated.
- The product owner imported their real tree locally and confirmed that the two families on the same generation now look like separate groups joined by one couple, and that no lines overlap.
- Checked on a real phone and on desktop, in both languages.
- `AGENTS.md` is updated as in section 12.
- No real or sensitive data in the repository.

## 14. How the Product Owner Will Verify

1. Import the real tree file locally. Look at the generation that contains both spouses' relatives. The siblings of one spouse form one tight group under their parents. The other spouse's brothers (and the brother's wife) form a separate group next to it. The two groups are visibly apart, and meet only at the couple.
2. Check that **no line runs over a person who is not part of that line's relationship**, and that lines which would overlap are at slightly different heights.
3. Select a person. Their lines become darker and thicker. Select someone else and check again. Deselect to return to normal.
4. Check the couple dots. Couples with children show a dot, and the children's line starts from it.
5. Add a few new people in different places (a sibling, a partner, a child) and confirm that existing groups do not jump around and that the new person lands in the right group.
6. Build a small test tree with half-siblings (one person with two partners and one child each) and check that each child group sits under its own couple.
7. Switch to Polish, then use pan, zoom, and fit-to-screen on the phone and on desktop.
8. Export, reload, import, and confirm the picture is identical.

## 15. Notes for Next Stories (not part of this story)

Likely next: editing and deleting people and links (with undo/redo), connecting two existing people, autosave, deeper import validation, additional person fields (dates, notes), other parent types (adoptive, step), print or image export.