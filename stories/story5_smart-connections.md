# Story 005: Smart connections when adding relatives

| | |
|---|---|
| **ID** | 005 |
| **Type** | Feature story (advanced) |
| **Priority** | Must have |
| **Size** | Large |
| **Depends on** | Story 002 (data model, add relative). Stories 003 and 004 are needed for the round-trip fixtures. |
| **References** | `AGENTS.md`, `DESIGN.md` |

## 1. User Story

**As a** user,
**I want** the app to ask, with sensible pre-selected answers, how a newly added person is connected to the people around the person I am adding them to,
**so that** I can build realistic family structures (two parents, several children, remarriages, half-siblings) quickly, without having to add every link by hand.

## 2. Context and Intent

In story 002, adding a person creates exactly one link, to the selected person. In real families a new person usually has **more** links:

- A new partner is usually also a parent of the existing children.
- A new child usually has two parents.
- A new sibling usually has the same parents as the existing sibling.

Principle for this story: **most of the time the extra link is true, so it is pre-selected**, and the user can always remove it. The app asks a question **only when there is something to ask**, and asks it in the simplest form possible:

| Number of candidates | UI |
|---|---|
| 0 | No question at all |
| 1 candidate (or a list of independent items) | Checkbox, **pre-checked** |
| 2 or more candidates for one role (the other parent) | Choice list with an explicit "No other parent" option, **nothing pre-selected** |

> **Important limitation:** deleting people and links does not exist yet (a later story). A wrong answer cannot be corrected in the app, only by starting over or re-importing a file. Because of this, the form must be clear and the defaults must be right.

## 3. Rules

### 3.1 Terms
- **Target (S):** the person the user selected and is adding a relative to.
- **New person (N):** the person being added. N is always brand new, so none of the extra links can create a cycle.
- **Parents of X:** people with a `child` edge pointing to X.
- **Children of X:** people X has a `child` edge pointing to.
- **Partners of X:** people connected to X by a `marriage` edge. The UI calls them "partners".
- **Co-parent of X:** a person who shares at least one child with X, whether or not they are linked by a `marriage` edge.
- **Siblings of X:** people connected to X by a `sibling` edge, **plus** people who share at least one parent with X. Duplicates are shown once.

### 3.2 New rule: maximum two parents
A person can have **at most two parents** (two incoming `child` edges). Enforced in `model/`: an operation that would create a third parent is rejected. A person who already has two parents is shown as **disabled** (with a short explanation) wherever they would otherwise be offered as a child of the new person. This rule keeps the questions simple. Other kinds of parents (adoptive, step) can be added later as separate relation types.

### 3.3 Questions per relation

Edges always point from parent to child. All "extra" edges involve N.

#### A. Add partner to S
Primary edge: `S — N` (`marriage`).
Question: **one checkbox per child of S**, "child is also a child of the new partner". Each is independent. Default: **checked**.
- A child who already has two parents is shown **disabled and unchecked**, with the note "Already has two parents".
- Each checked child creates `N → child` (`child`).
- No children: no question.

#### B. Add child to S
Primary edge: `S → N` (`child`).
Candidates for the **other parent** = partners of S plus co-parents of S, without duplicates, in the order they first appear in the edge list.
- **0 candidates:** no question. N has one parent.
- **1 candidate P:** one checkbox "Also a child of P", **checked**. Unchecking creates a single-parent child.
- **2 or more candidates:** a list of choices (radio buttons): each candidate, plus **"No other parent"**. **Nothing is pre-selected**, and saving without a choice is blocked with an error message. Choosing a candidate creates `P → N`.

#### C. Add sibling to S
Primary edge: `S — N` (`sibling`).
Two groups of questions, shown only when non-empty:
1. **Parents of S**: one checkbox per parent (at most two), "Also a child of P". Default: **checked** for each. The user can uncheck one (half-sibling) or both. Checked creates `P → N`.
2. **Siblings of S** (explicit or shared-parent): one checkbox per sibling D, "Also a sibling of D". Default: **checked**. Checked creates `N — D` (`sibling`).

#### D. Add parent to S
Primary edge: `N → S` (`child`). Not available if S already has two parents.
Two groups of questions, shown only when non-empty:
1. **Siblings of S**: one checkbox per sibling D, "D is also a child of this parent". Default: **checked**. A sibling who already has two parents is **disabled and unchecked** with the note "Already has two parents". Checked creates `N → D`.
2. **If S already has exactly one parent P:** one checkbox "Connect as a couple with P" (creates `N — P`, `marriage`).
    - Default **checked** when P has no partners yet.
    - Default **unchecked** when P already has one or more partners (the existing partner may be a step-parent, and the user should decide).

### 3.4 General rules
- All answers are applied in **one atomic operation**: either everything is created or nothing. Cancel creates nothing.
- Edge creation order is deterministic: primary edge first, then extra edges in the order the questions are displayed (top to bottom, items in list order). This keeps exported files stable.
- No duplicate edges, no self edges, no third parent. Violations are rejected in `model/` with a typed error, independent of the UI.
- Defaults are computed fresh each time the form opens. Nothing is remembered between forms.
- The UI says "partner" for a `marriage` edge (see story 002).

## 4. Scenario Catalogue

Each scenario is an acceptance test (section 7 refers to these IDs). Names are fictional examples.

| ID | Given | When | Then (form) | Then (saved edges, besides the primary one) |
|----|-------|------|-------------|--------------------------------------------|
| **P1** | Anna has one child, Mia (Mia's only parent is Anna) | Add partner to Anna | One checkbox for Mia, checked | Checked: `Partner → Mia`. Unchecked: none |
| **P2** | Anna has three children (Mia, Olek, Zosia), each with only Anna as parent | Add partner to Anna | Three separate checkboxes, all checked, independently changeable | One `Partner → child` edge per checked child |
| **P3** | Anna has no children | Add partner to Anna | No question section | None |
| **P4** | Anna has Mia (only Anna) and Olek (Anna and Piotr) | Add partner to Anna | Mia: checked. Olek: disabled, unchecked, "Already has two parents" | Only Mia, if checked |
| **P5** | Anna has 4 or more children | Add partner to Anna | A "Select all / Clear all" control appears above the list | Follows the selection |
| **C1** | Anna has no partners and no co-parents | Add child to Anna | No question | Child has one parent |
| **C2** | Anna has one partner, Piotr | Add child to Anna | One checkbox "Also a child of Piotr", checked | Checked: `Piotr → Child`. Unchecked: none |
| **C3** | Anna has two partners, Piotr and Marek | Add child to Anna | Radio list: Piotr, Marek, "No other parent". Nothing selected. Saving now shows an error | Selected person gets `Person → Child`. "No other parent": none |
| **C4** | Anna has one partner, Piotr, **and** a co-parent Tomek (they share child Mia, no marriage edge) | Add child to Anna | Radio list with Piotr, Tomek, and "No other parent" (two candidates) | As C3 |
| **C5** | Anna's only link to Piotr is a shared child, Mia (no marriage edge) | Add child to Anna | One checkbox "Also a child of Piotr", checked | As C2 |
| **B1** | Mia has no parents and no siblings | Add sibling to Mia | No question | None |
| **B2** | Mia has one parent, Anna | Add sibling to Mia | One checkbox "Also a child of Anna", checked | Checked: `Anna → New` |
| **B3** | Mia has two parents, Anna and Piotr | Add sibling to Mia | Two checkboxes, both checked | Both: full sibling. One unchecked: half-sibling. Both unchecked: only the sibling link |
| **B4** | Mia has siblings Olek and Zosia | Add sibling to Mia | Siblings section with Olek and Zosia, both checked | Checked: `New — Olek`, `New — Zosia` (`sibling`) |
| **B5** | Mia has two parents and one sibling | Add sibling to Mia | Both groups shown, parents first, then siblings | All checked answers applied together |
| **R1** | Mia has two parents | Open Mia's relatives | "Add parent" is disabled with the hint "Already has two parents" | Nothing can be created |
| **R2** | Mia has no parents and no siblings | Add parent to Mia | No question | None |
| **R3** | Mia has no parents and siblings Olek and Zosia | Add parent to Mia | Two checkboxes "Olek is also a child of this parent", "Zosia is...", both checked | `New → Olek`, `New → Zosia` if checked |
| **R4** | Mia has siblings Olek (no parents) and Zosia (two parents) | Add parent to Mia | Olek: checked. Zosia: disabled, unchecked, "Already has two parents" | Only Olek, if checked |
| **R5** | Mia has one parent, Anna, who has no partners | Add parent to Mia | Checkbox "Connect as a couple with Anna", **checked** | Checked: `New — Anna` (`marriage`) |
| **R6** | Mia has one parent, Anna, who has a partner, Marek | Add parent to Mia | Same checkbox, **unchecked** | Checked by the user: `New — Anna` |
| **R7** | Mia has one parent, Anna, and siblings | Add parent to Mia | Siblings group and couple checkbox both shown | All answers applied together |
| **G1** | Any | Save, then export and import | n/a | The imported tree is identical (round trip, byte for byte) |

## 5. Screens and Components

All visuals follow `DESIGN.md`.

### 5.1 Where the questions appear
- Inside the existing **Add relative** form (story 002, section 5.6), **below** the first name and last name fields and **above** the Save and Cancel buttons.
- Each group is a `<fieldset>` with a visible `<legend>` that explains the question in plain language (see section 6). The section is **hidden entirely** when there is nothing to ask, so simple cases look exactly like story 002.
- The form is scrollable on small screens. Save and Cancel stay reachable (sticky at the bottom of the sheet/panel).

### 5.2 Checkbox
- Visual box 20px, with a **44px** minimum touch target for the whole row (the label is part of the target).
- Unchecked: cream background, `1px solid rgba(28,28,28,0.4)`, 4px radius. Checked: charcoal background with an off-white check mark. Focus: the blue ring from `DESIGN.md`.
- Disabled: 50% opacity, `cursor: not-allowed`, with the explanation shown as caption text (muted) under the label. The explanation must also be read by screen readers (linked with `aria-describedby`).
- Use native `<input type="checkbox">` elements styled with CSS, so keyboard and screen reader behavior come for free.

### 5.3 Choice list (more than one candidate for the other parent)
- Native `<input type="radio">` group in a `<fieldset>`, same row size and styling as the checkboxes.
- Options: each candidate (display name), then "No other parent". **No option is selected** when the form opens.
- If Save is pressed without a choice: no data is changed, an inline error appears under the group (`role="alert"`), and focus moves to the first radio button.

### 5.4 Select all / Clear all
- When a checkbox group contains **4 or more enabled items**, a small ghost text button toggles between "Select all" and "Clear all" above the list. It affects only enabled items.

### 5.5 Long lists
- A group with many items (for example 15 children) scrolls inside the form with a maximum height of about 40% of the viewport, and remains fully keyboard accessible.

### 5.6 The "Add parent" button
- In the detail view, when S already has two parents, the **Add parent** button is disabled and shows the hint "Already has two parents" (also available to screen readers).

### 5.7 Detail view relations list (small change)
- The **Siblings** group now includes people who share a parent with the person, in addition to people linked by `sibling` edges, without duplicates.

### 5.8 Layout
- No new layout concepts are required. Existing rules from story 002 apply (generations in rows, partners adjacent, no overlaps). The new structures must be drawn correctly (see AC31 to AC34).

## 6. Language and Text (English / Polish)

Names are always inserted with interpolation, never concatenated. Polish wording avoids declining names by putting them after "osoby" (of the person).

| Key | English | Polish |
|-----|---------|--------|
| connect.partner.legend | Which of {{name}}'s children are also children of the new partner? | Które dzieci osoby {{name}} są też dziećmi nowo dodanej osoby? |
| connect.partner.item | {{child}} is also a child of the new partner | {{child}} jest też dzieckiem nowo dodanej osoby |
| connect.child.legend | Who is the other parent? | Kto jest drugim rodzicem? |
| connect.child.none | No other parent | Brak drugiego rodzica |
| connect.child.error | Choose the other parent, or "No other parent" | Wybierz drugiego rodzica lub „Brak drugiego rodzica” |
| connect.alsoChildOf | Also a child of {{parent}} | Także dziecko osoby {{parent}} |
| connect.sibling.parentsLegend | Parents of {{name}} | Rodzice osoby {{name}} |
| connect.siblingsLegend | Siblings of {{name}} | Rodzeństwo osoby {{name}} |
| connect.alsoSiblingOf | Also a sibling of {{name}} | Także rodzeństwo osoby {{name}} |
| connect.parent.siblingItem | {{name}} is also a child of this parent | {{name}} jest też dzieckiem tego rodzica |
| connect.parent.couple | Connect as a couple with {{parent}} | Połącz jako parę z osobą {{parent}} |
| connect.disabled.twoParents | Already has two parents | Ma już dwoje rodziców |
| connect.selectAll | Select all | Zaznacz wszystko |
| connect.clearAll | Clear all | Odznacz wszystko |
| relative.parent.disabled | {{name}} already has two parents | Osoba {{name}} ma już dwoje rodziców |

## 7. Acceptance Criteria

### Model and rules
- [ ] **AC1.** A pure function (for example `getConnectionQuestions(tree, targetId, relation)`) in `src/model/` returns the questions, items, and **default answers** for a given target and relation, following section 3. It has no React imports.
- [ ] **AC2.** A pure function (for example `addRelative(tree, targetId, relation, personData, answers)`) creates N, the primary edge, and all extra edges **atomically** and returns a new tree, never mutating the old one.
- [ ] **AC3.** The "maximum two parents" rule (section 3.2) is enforced in `model/`: any operation that would give a person a third parent is rejected with a typed error and changes nothing.
- [ ] **AC4.** Extra edges are created in the deterministic order from section 3.4, and exporting the same sequence of actions twice gives byte-identical files.
- [ ] **AC5.** Duplicate edges, self edges, and edges to unknown people are rejected in `model/` even if the UI sends them.
- [ ] **AC6.** Helper functions for "children of", "parents of", "partners of", "co-parents of", and "siblings of" (section 3.1) exist in `model/`, are unit tested, and are the only place these relationships are computed.
- [ ] **AC7.** When there is nothing to ask, the form and the saved result are exactly as in story 002 (no regression).

### Scenarios (each one is an automated model test, and the main ones are also component tests)
- [ ] **AC8.** Scenarios **P1 to P5** (add partner) behave exactly as in the catalogue.
- [ ] **AC9.** Scenarios **C1 to C5** (add child) behave exactly as in the catalogue.
- [ ] **AC10.** Scenarios **B1 to B5** (add sibling) behave exactly as in the catalogue.
- [ ] **AC11.** Scenarios **R1 to R7** (add parent) behave exactly as in the catalogue.
- [ ] **AC12.** Scenario **G1**: export → import → export is byte-identical for a tree built with several of the above scenarios.

### Defaults and answers
- [ ] **AC13.** Every checkbox described as "checked by default" is checked when the form opens, and every one described as "unchecked by default" is unchecked.
- [ ] **AC14.** The user can change any enabled checkbox independently of the others (for example, in P2 unchecking only Olek).
- [ ] **AC15.** In the other-parent choice (scenarios C3 and C4), nothing is preselected, saving without a choice is blocked with the error from section 6, and no person or edge is created.
- [ ] **AC16.** Choosing "No other parent" is a valid answer and creates a single-parent child.
- [ ] **AC17.** Cancel, Escape, or closing the form creates nothing, and reopening the form shows fresh defaults.
- [ ] **AC18.** A form with name fields filled in and some answers changed keeps all of them when the language is switched.

### Disabled items and limits
- [ ] **AC19.** Items that cannot be linked because they already have two parents are shown disabled, unchecked, with the note "Already has two parents", and cannot be checked with mouse, touch, or keyboard.
- [ ] **AC20.** "Add parent" is disabled for a person with two parents, with the hint from section 5.6.
- [ ] **AC21.** "Select all / Clear all" appears for groups with 4 or more enabled items, skips disabled items, and updates its label correctly.
- [ ] **AC22.** A group with 15 or more items scrolls inside the form and remains usable by keyboard and touch on a 360px wide screen.

### UI and accessibility
- [ ] **AC23.** The questions appear below the name fields and above Save and Cancel, in groups with visible legends, and the whole section is hidden when there is nothing to ask.
- [ ] **AC24.** Checkboxes and radio buttons are native inputs, each row is at least 44px high, and they follow the style in section 5.2.
- [ ] **AC25.** All groups are `<fieldset>` elements with `<legend>`. Disabled notes are connected with `aria-describedby`. The validation error is announced (`role="alert"`) and focus moves to the first radio button.
- [ ] **AC26.** The form is fully usable with the keyboard (Tab, Space, arrow keys in radio groups, Enter to save, Escape to cancel).
- [ ] **AC27.** Save and Cancel stay reachable on a 360px wide, short screen (landscape phone) when the form is long.
- [ ] **AC28.** The detail view's Siblings group includes people who share a parent, without duplicates (section 5.7), and is covered by a unit test.

### Layout and display
- [ ] **AC29.** After saving, the new person is selected and visible, the view fits as in story 002, and the detail view of the new person shows the correct relations.
- [ ] **AC30.** Layout unit tests prove no overlaps and correct generations for these shapes: (a) a couple with one child that has two parent edges, (b) a couple with three children, (c) one person with two partners, each with a child (half-siblings), (d) a child whose two parents are **not** linked by a marriage edge, (e) a person with two parents and two siblings, (f) three generations built using the new questions.
- [ ] **AC31.** A child with two parents is drawn below both of them, and the connector lines from the two parents join clearly without crossing through any card.
- [ ] **AC32.** Half-siblings (shape c) are placed so that each child is visibly attached to its own parents, and no line passes through a card.
- [ ] **AC33.** Adding a person through any of these flows does not move unrelated existing cards to the other side of the tree (stability rule from story 002).
- [ ] **AC34.** A tree of at least 30 people built with these flows remains responsive on a phone, including opening the form for a person with many children.

### Language and text
- [ ] **AC35.** All new strings exist in both `en` and `pl`, none are hardcoded, and the key-parity test passes.
- [ ] **AC36.** Polish text uses the wording in section 6 (names after "osoby", no declension of names), and long Polish labels wrap instead of being cut off at 360px width.

### Quality
- [ ] **AC37.** Unit tests cover every scenario in section 4, the two-parent limit (including rejection of a third parent at the model level), duplicate prevention, and atomicity (a failing operation leaves the tree unchanged).
- [ ] **AC38.** A component test covers the flow: create Anna → add child Mia → add partner Piotr (check that Mia is pre-checked) → add child Olek to Anna (check that Piotr's checkbox is pre-checked) → add second partner Marek → add child to Anna (the radio list appears).
- [ ] **AC39.** Fixture files with **fictional** data for the main structures (couple with children, half-siblings, unmarried co-parents) are added for tests and for manual checking.
- [ ] **AC40.** `npm run lint`, `npm test`, and `npm run build` pass, and deployment still works.
- [ ] **AC41.** No real or sensitive data is added anywhere in the repo, and no network requests are made.

## 8. Out of Scope (do not build)

- Deleting or editing people and links, and undo/redo (this is why defaults matter so much, see section 2).
- Connecting two **existing** people to each other.
- Other parent types (adoptive, step, foster) and other relation types.
- Remembering the user's earlier choices.
- Showing a live preview or summary sentence of what will be created.
- Automatic fixing of existing trees (for example, from imported files) that violate the two-parent rule.
- Any change to the file format. The file format from story 002 is unchanged.

## 9. Technical Notes

- Keep the logic in `model/` (questions, defaults, edge creation). Components only render the questions they receive and pass the answers back. This keeps every scenario testable without a UI.
- Suggested shape of the question data (adapt as needed): a list of groups, each with an `id`, a `kind` (`checkboxes`, `choice`, or `single-checkbox`), and items with `personId`, `defaultChecked`, and an optional `disabledReason` code. The UI translates reason codes into text.
- Ordering for "first appearance" in the candidate list comes from the order of edges in the tree.
- The imported files from story 004 are not validated for the two-parent rule. The UI must still not crash if a person has three or more parents (treat them as "has two or more parents": disabled for linking).
- Do not add dependencies.

## 10. Required Update to `AGENTS.md`

- In the data model section, add the "maximum two parents" rule and the definitions of children, parents, partners, co-parents, and siblings from section 3.1.
- Add a short section describing the "ask only when there is something to ask, pre-select the likely answer" principle and the questions per relation from section 3.3, so future stories follow the same pattern.

## 11. Definition of Done

- All acceptance criteria are checked.
- Merged to `main`, GitHub Actions green, live site updated.
- Every scenario in section 4 was tried manually on the live site, on a real phone and on desktop, in both languages.
- `AGENTS.md` is updated as in section 10.
- No real or sensitive data in the repo.

## 12. How the Product Owner Will Verify

1. Start a tree with Anna. Add child Mia. Add partner Piotr to Anna. Mia's checkbox is pre-checked. Save. Mia is drawn under both parents.
2. Add a second child, Olek, to Anna. The form shows "Also a child of Piotr", pre-checked. Uncheck it and save. Olek has only Anna as parent.
3. Add a third partner-to-be: add partner Marek to Anna. Mia is disabled (two parents), Olek is pre-checked.
4. Add another child to Anna. Now there are two or more other-parent candidates, so a list appears with nothing selected. Try to save without choosing, and see the error. Choose "No other parent" and save.
5. Select Mia and add a sibling. Both parents are pre-checked, and the other siblings are pre-checked. Uncheck one parent to create a half-sibling.
6. Select Mia (two parents). "Add parent" is disabled with the hint.
7. Select Olek (one parent) and add a parent. The couple checkbox appears. Check whether its default (checked or unchecked) matches whether the existing parent has other partners.
8. Switch to Polish in the middle of a form and confirm that nothing is lost and that all text is translated.
9. Export, reload, import, and confirm the tree is identical.

## 13. Notes for Next Stories (not part of this story)

Likely next: editing and deleting people and links (and undo/redo), connecting two existing people, autosave, deeper import validation, additional person fields (dates, notes), other parent types (adoptive, step).