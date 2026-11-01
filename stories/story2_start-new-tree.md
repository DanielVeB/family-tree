# Story 002: Start a new tree and add connected people

| | |
|---|---|
| **ID** | 002 |
| **Type** | Feature story |
| **Priority** | Must have |
| **Size** | Medium |
| **Depends on** | Story 001 (app skeleton, design foundation, deployment) |
| **References** | `AGENTS.md`, `DESIGN.md` |

## 1. User Story

**As a** user,
**I want** to start a new family tree, create the first person, and then add more people connected to anyone already in the tree,
**so that** I can build up my family tree step by step and see it as a graph of people and relationships.

## 2. Context and Intent

This story introduces the **core data model** (a graph of nodes and edges) and the first real interaction. It is deliberately minimal:

- A person has only a first name and last name for now. The model must make it easy to add more fields later.
- Relationships are stored as typed edges between two people.
- The tree lives in memory only. Import, export, editing, deleting, and saving come in later stories.

> **This story's data model supersedes section 5 of `AGENTS.md`** (the old model with `people`, `unions`, and `children`). See section 10 for the required `AGENTS.md` update.

## 3. Data Model

### 3.1 Concepts

- **Node** = a person. It has a unique `id` and a `data` object (only `firstName` and `lastName` for now).
- **Edge** = a connection between two nodes. It has `from`, `to` (node ids), and a relation `type`.
- The whole tree is one file of nodes plus edges, with a `version`.

### 3.2 JSON shape (version 1)

```json
{
  "version": 1,
  "nodes": [
    { "id": "3f2c...", "data": { "firstName": "Anna", "lastName": "Testowa" } },
    { "id": "9a1b...", "data": { "firstName": "Jan", "lastName": "Przykładowy" } },
    { "id": "c7d4...", "data": { "firstName": "Maria", "lastName": "Przykładowa" } }
  ],
  "edges": [
    { "from": "3f2c...", "to": "c7d4...", "type": "child" },
    { "from": "9a1b...", "to": "c7d4...", "type": "child" },
    { "from": "3f2c...", "to": "9a1b...", "type": "marriage" }
  ]
}
```

(Fictional example data only.)

### 3.3 Relation types in this story

| Type | Meaning | Direction | Stored once as |
|------|---------|-----------|----------------|
| `child` | `to` is a child of `from` (`from` is the parent) | **Directed** | `from` = parent, `to` = child |
| `sibling` | The two people are siblings | Undirected | One edge, either order |
| `marriage` | The two people are married partners | Undirected | One edge, either order |

Notes:
- The set of types must be **easy to extend** (for example, `partner`, `adoptive-child`, `step-sibling`) without changing existing files. Define the types in one place in code (a single union/enum plus its zod schema).
- For undirected types, the pair `(A, B)` and `(B, A)` is the **same** relationship. Never store both.
- The `data` object must be extensible. Unknown fields inside `data` and unknown top-level fields must be kept untouched when the file is later loaded and saved (relevant for future stories).

### 3.4 Validation rules (enforced in code, in `model/`)

- Node `id`: non-empty string, unique within the file. Generated with `crypto.randomUUID()`.
- `firstName`: required, trimmed, 1 to 100 characters.
- `lastName`: optional, trimmed, 0 to 100 characters (people with an unknown surname are allowed).
- Edge `from` and `to` must refer to existing node ids.
- No edge from a node to itself.
- No duplicate edges (same type, same pair; order ignored for undirected types).
- `child` edges must not create a cycle (nobody can be their own ancestor).
- `type` must be one of the known types.
- A zod schema describes the full file, and TypeScript types are derived from it.

### 3.5 Display name

A person is displayed as `firstName lastName` (the last name is omitted if empty). Put this in one helper function so future stories can change it (for example, to add dates or titles).

## 4. User Flow

1. The user opens the app. The tree is empty and the empty state from story 001 is shown.
2. The user taps **Start a new tree**. A form asks for the first person's **first name** and **last name**.
3. The user confirms. The empty state is replaced by the tree canvas with **one person card**.
4. The user taps the person card. It becomes **selected**, and a **detail view** opens (bottom sheet on mobile, right side panel on desktop).
5. In the detail view, the user chooses **Add relative** and picks the relationship: **Parent**, **Child**, **Sibling**, or **Partner**.
6. A form asks for the new person's first and last name. The user saves.
7. The new person appears on the canvas, connected to the selected person by the right kind of edge, and becomes the selected person.
8. The user can repeat steps 4 to 7 starting from any person in the tree.

### How UI choices map to stored edges

Selected person = **S**, new person = **N**.

| User chose | Edge created |
|------------|--------------|
| Add parent | `{ from: N, to: S, type: "child" }` |
| Add child | `{ from: S, to: N, type: "child" }` |
| Add sibling | `{ from: S, to: N, type: "sibling" }` |
| Add partner | `{ from: S, to: N, type: "marriage" }` |

Known limitations (accepted for now, handled in later stories):
- Adding a child to a married person does **not** automatically link the child to the partner as well.
- Adding a sibling does **not** automatically link the new person to the existing parents.
- There is no way to connect two **existing** people yet.

## 5. Screens and Components

All visuals follow `DESIGN.md`.

### 5.1 New tree dialog
- Modal on desktop, bottom sheet on mobile (panel style: cream, `1px solid #eceae4`, 16px radius).
- Title, two inputs (first name, last name), primary button **Create tree**, ghost button **Cancel**.
- First name field is focused when the dialog opens. Enter submits. Escape cancels.

### 5.2 Tree canvas
- Fills the area under the top bar. Cream background.
- Draws **person cards** (nodes) and **connector lines** (edges).
- Pan by dragging, zoom by pinch (touch) and Ctrl/Cmd + wheel (desktop), plus **zoom in**, **zoom out**, and **fit to screen** icon pills (44px) at the bottom-left.
- After every change (first person created, relative added), the view **fits all people on screen** automatically, unless the user has manually panned or zoomed since the last change. In that case, the view smoothly keeps the newly added person visible.

### 5.3 Person card
- Per `DESIGN.md`: cream background, `1px solid #eceae4`, 12px radius, no shadow.
- Shows a circular initials avatar (first letter of first name plus first letter of last name) and the display name (weight 600). Long names wrap onto at most two lines, then truncate with an ellipsis, and the full name is available as the accessible label.
- Hover (hover-capable devices only): border becomes `rgba(28,28,28,0.4)`.
- Selected: 2px blue ring (`--ring`).
- Focusable with the keyboard; Enter or Space selects.

### 5.4 Connector lines
- 1.5px solid lines in the `--line` color. No other colors or dashes.
- Types are distinguishable by **shape**, not color:
    - `child`: a line from the bottom of the parent to the top of the child (elbow connector).
    - `marriage`: a short horizontal line between two partners placed side by side.
    - `sibling`: a shallow bracket above the siblings, joining the tops of their cards.
- Lines never pass through a person card.

### 5.5 Detail view
- Opens when a person is selected. Closes with a close icon pill, with Escape, or by tapping an empty area of the canvas (which also deselects).
- Contents:
    - Display name as a heading (28px mobile, 36px desktop, weight 600).
    - **Relations** list (read-only), grouped by label: Parents, Children, Siblings, Partners, with display names. Empty groups are hidden.
    - **Add relative** with four buttons: Add parent, Add child, Add sibling, Add partner.
- On mobile: bottom sheet that covers at most about 50% of the screen, so the tree stays partly visible. On desktop: right panel, 360px wide.

### 5.6 Add relative form
- Opens inside the detail view area (replaces the buttons), titled with the chosen relationship, for example "Add child of Anna Testowa".
- Fields: first name (required), last name (optional). Primary **Save** and ghost **Cancel**.
- On save, the panel returns to the detail view of the **new** person.
- Inline validation messages appear under the field, in plain language, in the active language.

### 5.7 Layout rules

The tree is always connected (new people are only added next to an existing person), so the layout can be computed from the graph structure:

- **Rows = generations.** Parents are one row above their children. Siblings and partners share a row.
- Partners are placed **next to each other**. Siblings are placed **next to each other**.
- A parent (or couple) is horizontally centered above their children where possible.
- Cards never overlap, and spacing is consistent (use the 8px-based spacing scale).
- The layout is a **pure function** `computeLayout(tree) → { positions, edgePaths }` in `src/layout/`, with unit tests, so it can be replaced or improved later without touching components.
- A perfect aesthetic result is **not** required for complex families (multiple marriages, many siblings). It must be correct (no overlaps, correct generations) and stable (adding a person must not make the existing tree jump around wildly).
- You may use a small layout library (for example `dagre` or `elkjs`) if you justify it. Check that it can honor the "same row" constraints for partners and siblings, otherwise write a simple custom layered layout.

## 6. Language and Text (English / Polish)

All strings go through the translation layer, in both languages. Suggested wording:

| Key | English | Polish |
|-----|---------|--------|
| newTree.title | Start your tree | Zacznij swoje drzewo |
| newTree.intro | Who is the first person in your tree? | Kto jest pierwszą osobą w Twoim drzewie? |
| field.firstName | First name | Imię |
| field.lastName | Last name | Nazwisko |
| action.createTree | Create tree | Utwórz drzewo |
| action.save | Save | Zapisz |
| action.cancel | Cancel | Anuluj |
| action.close | Close | Zamknij |
| detail.addRelative | Add relative | Dodaj krewnego |
| relative.parent | Add parent | Dodaj rodzica |
| relative.child | Add child | Dodaj dziecko |
| relative.sibling | Add sibling | Dodaj rodzeństwo |
| relative.partner | Add partner | Dodaj partnera |
| relations.parents | Parents | Rodzice |
| relations.children | Children | Dzieci |
| relations.siblings | Siblings | Rodzeństwo |
| relations.partners | Partners | Partnerzy |
| form.addTo | Add {{relation}} of {{name}} | Dodaj: {{relation}} ({{name}}) |
| error.firstNameRequired | First name is required | Imię jest wymagane |
| error.tooLong | Maximum {{max}} characters | Maksymalnie {{max}} znaków |
| canvas.zoomIn / zoomOut / fit | Zoom in / Zoom out / Fit to screen | Powiększ / Pomniejsz / Dopasuj do ekranu |

Notes:
- The UI says "partner" while the stored type is `marriage`, because the stored type is a technical identifier and the UI wording stays neutral. A future story can add a separate `partner` type if needed.
- Keep the `form.addTo` wording flexible. If Polish grammar makes it awkward with interpolation, simplify the sentence rather than concatenating strings.
- Counted text (if any appears, such as "3 children") must use i18next plural keys with all Polish forms.
- The relation words in the UI are labels only. The JSON never contains translated text.

## 7. Acceptance Criteria

### Data model and rules
- [ ] **AC1.** The TypeScript types and zod schema for the file (`version`, `nodes`, `edges`) exist in `src/model/` and match section 3.
- [ ] **AC2.** Relation types are defined in a single place, and adding a new type requires changing only that definition (plus its UI label).
- [ ] **AC3.** Pure functions exist for: creating an empty tree, adding the first person, and adding a relative (parent, child, sibling, partner) to a selected person. They return a new tree, and never mutate the old one.
- [ ] **AC4.** All validation rules in section 3.4 are enforced in `model/`, independent of the UI. Invalid operations are rejected with a typed error, not a thrown string.
- [ ] **AC5.** The mapping in section 4 (UI choice → stored edge) is implemented exactly.
- [ ] **AC6.** A `getDisplayName(person)` helper exists and is the only place that builds display names.

### Starting a tree
- [ ] **AC7.** The **Start a new tree** button from story 001 is now enabled. The **Import a file** button stays disabled.
- [ ] **AC8.** The new tree dialog validates the first name (required) and shows the error under the field.
- [ ] **AC9.** After confirming, the empty state disappears and the canvas shows exactly one person card, and no edges.
- [ ] **AC10.** Leading and trailing spaces in names are trimmed. Names with Polish characters (ą, ć, ę, ł, ń, ó, ś, ź, ż) are stored and displayed correctly.

### Graph display
- [ ] **AC11.** Every person is drawn as a card and every edge as a connector line, following sections 5.3 and 5.4.
- [ ] **AC12.** Layout follows section 5.7: correct generation rows, partners adjacent, siblings adjacent, no overlapping cards, no lines through cards.
- [ ] **AC13.** The layout is a pure function with unit tests covering at least: single person, parent + child, two siblings, a couple with two children, three generations, and a person with two parents.
- [ ] **AC14.** Adding a person does not cause unrelated existing cards to be re-ordered or moved to the other side of the tree.
- [ ] **AC15.** The canvas supports pan, pinch zoom, Ctrl/Cmd + wheel zoom, and zoom in, zoom out, and fit buttons. Zoom is limited to a sensible range (for example 25% to 200%).
- [ ] **AC16.** The view fits automatically after changes, as described in section 5.2.

### Selecting and adding
- [ ] **AC17.** Tapping or clicking a card selects it (blue ring) and opens the detail view. Tapping an empty canvas area deselects and closes the detail view.
- [ ] **AC18.** The detail view shows the display name and the read-only relations list (section 5.5), accurately reflecting the edges.
- [ ] **AC19.** All four relative types (parent, child, sibling, partner) can be added from any person in the tree, and each produces the correct edge direction and line shape.
- [ ] **AC20.** After saving a new relative, the new person is selected and visible on screen.
- [ ] **AC21.** Cancel in any form leaves the tree unchanged.
- [ ] **AC22.** A tree of at least 30 people created by repeated adding stays responsive on a phone: no visible lag when selecting or adding.

### Responsive behavior and accessibility
- [ ] **AC23.** On mobile (360px), the detail view is a bottom sheet that leaves part of the tree visible, and all buttons are at least 44x44px.
- [ ] **AC24.** On desktop, the detail view is a 360px right panel and the canvas shrinks without distorting the tree.
- [ ] **AC25.** Everything works with the keyboard: focusing and selecting cards, opening and operating the forms, closing with Escape. Focus moves into the form when it opens and returns to the selected card when it closes.
- [ ] **AC26.** Cards and icon buttons have accessible names (for example, the card's label is the person's full name).
- [ ] **AC27.** Layouts work in both languages without text being cut off in forms and buttons at 360px width.

### Languages and text
- [ ] **AC28.** All new strings exist in both `en` and `pl` resource files, none are hardcoded in components, and the key-parity test from story 001 still passes.
- [ ] **AC29.** Switching the language while the tree, a form, or the detail view is open updates all visible text immediately and does not lose the tree or the form contents.

### Temporary safeguards (until saving exists)
- [ ] **AC30.** The tree exists only in memory. If the tree contains at least one person, the browser shows its standard "leave site?" confirmation on reload or close. This is removed in the story that adds saving.

### Quality
- [ ] **AC31.** Unit tests cover all operations and rules in `model/` (including each rejected case: self-edge, duplicate edge, unknown id, cycle, empty first name, name too long) and the layout function.
- [ ] **AC32.** A component test covers the main flow: start tree → create person → select → add child → two cards and one `child` edge exist.
- [ ] **AC33.** `npm run lint`, `npm test`, and `npm run build` pass, and the deployment from story 001 still works. The live site shows the new functionality.
- [ ] **AC34.** No real or sensitive data is added anywhere in the repo (tests use fictional names).
- [ ] **AC35.** The app still makes no network requests other than loading its own static files.

## 8. Out of Scope (do not build)

- Import and export of files, and any saving or autosave.
- Editing a person's name, and deleting people or relationships.
- Connecting two existing people, and automatically linking children to both parents.
- Undo and redo.
- Additional person fields (birth and death dates, notes, photos).
- Additional relation types beyond `child`, `sibling`, and `marriage`.
- PWA and offline support.
- Search, filtering, or multiple trees.

## 9. Technical Notes

- Folder usage: types, schema, and operations in `src/model/`, state handling in `src/state/`, layout in `src/layout/`, UI in `src/components/`. `model/` and `layout/` must not import React.
- State: a single reducer holding `{ tree, selectedId, ui }` is sufficient. Keep the tree state serializable, because the next story will export it as is.
- The in-memory tree should already be **exactly the file shape** from section 3.2, so export in the next story is just `JSON.stringify`.
- Rendering: SVG for lines, and HTML (or SVG `foreignObject`) for cards. Choose whichever gives the best text rendering and accessibility, and keep one coordinate system for pan/zoom.
- `crypto.randomUUID()` works on GitHub Pages (HTTPS) and on `localhost`.
- Do not add UI libraries. Evaluate any layout or pan/zoom library for size and justify it.

## 10. Required Update to `AGENTS.md`

As part of this story, update `AGENTS.md`:
- Replace section 5 (Data Model) with the node/edge model from section 3 of this story, including the relation type table and validation rules.
- Update the folder notes and tests lines that mention `unions`, `children`, or `people`.
- Update the "Core Features" wording where it assumes the old model (for example, "add a person as parent, partner, child, or sibling" stays valid).

## 11. Definition of Done

- All acceptance criteria are checked.
- Merged to `main`, the GitHub Actions run is green, and the live site is updated.
- Verified on a real phone and a desktop browser, in both languages.
- `AGENTS.md` is updated as in section 10.
- No real or sensitive data in the repo.

## 12. How the Product Owner Will Verify

1. Open the live site. Tap **Start a new tree**, enter a fictional name, and confirm that one card appears.
2. Tap the card. Confirm the ring, the detail view, and the empty relations.
3. Add a **child**, then from the child add a **sibling**, then add a **partner** to the first person, then a **parent** to the first person. Confirm that rows, line shapes, and the relations lists look right at every step.
4. Keep adding people until there are about 15. Pan, zoom, and use the fit button.
5. Switch to Polish in the middle of the flow. Confirm that the text updates and nothing is lost.
6. Try an empty first name, and a name with Polish characters.
7. Try to reload the page and confirm the browser warns about leaving.
8. Repeat the main flow on a phone.

## 13. Notes for Next Stories (not part of this story)

Likely next: export and import of the JSON file with autosave, editing and deleting people, connecting two existing people, linking children to both parents, additional person fields, undo/redo, PWA.