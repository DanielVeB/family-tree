# Story 004: Import a JSON file and load the tree

| | |
|---|---|
| **ID** | 004 |
| **Type** | Feature story |
| **Priority** | Must have |
| **Size** | Small |
| **Depends on** | Story 002 (data model, schema), Story 003 (export, unsaved-changes status, toast) |
| **References** | `AGENTS.md` (section 7), `DESIGN.md` |

## 1. User Story

**As a** user,
**I want** to import a tree file I exported earlier (or received from someone),
**so that** I can continue working on it, view it, and share it.

## 2. Context and Intent

This story completes the save-and-reuse loop: **export → import**. It is intentionally **simple**:

- The user picks a file, the app loads it, and the tree appears.
- **No extra validation for now.** The only check is the existing zod schema from story 002 (the file must be valid JSON with the expected shape). If the file does not pass, the user sees one generic error and nothing changes.
- Detailed error messages, deep checks, and migrations come in a later story.

## 3. Scope

### In scope
1. An **Import** action using a standard file picker.
2. Loading the file into the app, replacing the current tree.
3. A confirmation before replacing a tree that has **unexported changes** (to prevent accidental data loss).
4. One generic error message for any file that cannot be loaded.
5. A success message.
6. Preserving unknown fields from the file, so they survive the next export.

### Out of scope (do not build)
- Detailed validation and specific error messages (which field is wrong, which line).
- Semantic checks such as cycles, duplicate edges, edges pointing to unknown people, or duplicate ids.
- Migrations between file versions.
- Drag-and-drop of files.
- Merging an imported file into an existing tree.
- Autosave, file size limits, importing several files at once.
- Importing from other formats (GEDCOM, CSV).

## 4. User Flow

1. The user presses **Import a file**:
    - on the empty state (the button from story 001 is now enabled), or
    - in the top bar, when a tree already exists (new ghost button next to Export).
2. The system file picker opens (only `.json` files are suggested).
3. The user chooses a file.
4. The app reads the file and checks it against the schema.
    - **If it is not valid:** an error toast is shown and the current tree is untouched. Flow ends.
    - **If it is valid and the current tree has unexported changes:** a confirmation dialog asks whether to replace the current tree. Cancel keeps the current tree.
    - **Otherwise** (valid, and the current tree is empty or has no unexported changes): the tree is replaced right away.
5. The tree appears on the canvas, fitted to the screen, with nothing selected and the detail view closed.
6. A success toast shows how many people were loaded.

If the user closes the file picker without choosing a file, nothing happens.

## 5. Behavior Details

### 5.1 What happens to the app state on a successful import
- The imported file becomes the current tree, exactly as it is in the file.
- Selection is cleared, the detail view and any open forms are closed, and the view fits the whole tree.
- The unsaved-changes status becomes a new state: **"Loaded from file"** (no dot). It stays this way until the user changes the tree, after which it becomes "Changes not exported" as defined in story 003.
- The "leave site?" browser warning behaves according to this status (no warning while the status is "Loaded from file" or "Exported at …").
- A file with no people loads as an empty tree and the empty state is shown.

### 5.2 Confirmation dialog (only when there are unexported changes)
- Same style as the other dialogs (modal on desktop, bottom sheet on mobile).
- Title: "Replace your current tree?"
- Text: "You have changes that were not exported. They will be lost."
- Buttons: primary **Replace tree**, ghost **Cancel**. Escape cancels. Focus starts on Cancel (the safe option).

### 5.3 Error toast
- One generic message for every failure (empty file, not JSON, wrong shape, unsupported version, unreadable file):
    - "This file could not be loaded. Please choose a family tree file exported from this app."
- Uses the toast component from story 003. The current tree and status stay exactly as they were.
- The app must never crash or show a blank screen because of a failed import.

### 5.4 Success toast
- "Loaded {{count}} people" with proper plural forms in both languages (see section 6).
- Does not show the file name or any person's name.

### 5.5 Unknown fields
- Extra fields in the file that the app does not know about (at the top level, inside nodes, inside `data`, or inside edges) are **kept in memory and written back** on the next export. They are not shown anywhere in the UI.
- The schema must therefore allow unknown fields (for example, zod `passthrough`) instead of stripping or rejecting them.

## 6. Language and Text (English / Polish)

| Key | English | Polish |
|-----|---------|--------|
| import.button | Import a file | Importuj plik |
| import.buttonLabel | Import a tree from a file | Importuj drzewo z pliku |
| import.confirm.title | Replace your current tree? | Zastąpić obecne drzewo? |
| import.confirm.text | You have changes that were not exported. They will be lost. | Masz zmiany, które nie zostały wyeksportowane. Zostaną utracone. |
| import.confirm.replace | Replace tree | Zastąp drzewo |
| import.error | This file could not be loaded. Please choose a family tree file exported from this app. | Nie udało się wczytać pliku. Wybierz plik drzewa wyeksportowany z tej aplikacji. |
| import.success_one | Loaded {{count}} person | Wczytano {{count}} osobę |
| import.success_few | | Wczytano {{count}} osoby |
| import.success_many | | Wczytano {{count}} osób |
| import.success_other | Loaded {{count}} people | Wczytano {{count}} osoby |
| export.status.loaded | Loaded from file | Wczytano z pliku |

Notes:
- English needs `one` and `other`. Polish needs `one`, `few`, `many`, and `other`. The key-parity test must account for the different plural forms per language (see `AGENTS.md` section 11).
- The file contents are never translated or changed by the language setting.

## 7. Acceptance Criteria

### Import action
- [ ] **AC1.** The **Import a file** button on the empty state is enabled and opens the system file picker.
- [ ] **AC2.** When a tree exists, an **Import** ghost button is in the top bar next to Export and works the same way. At 360px, the top bar still fits in both languages (icon-only pill with an accessible name is acceptable).
- [ ] **AC3.** The file picker is a standard `<input type="file">` (hidden and triggered by the button) with `accept=".json,application/json"`. No other file APIs are used.
- [ ] **AC4.** The input is reset after every attempt, so choosing the **same file twice in a row** works.
- [ ] **AC5.** Cancelling the picker changes nothing and shows nothing.

### Loading
- [ ] **AC6.** A valid file exported by the app (story 003) loads and the tree is displayed exactly as exported: the same people, the same relationships, and the same line shapes.
- [ ] **AC7.** **Round trip:** export → import → export produces **byte-identical** files (automated test).
- [ ] **AC8.** Names with Polish characters (ą ć ę ł ń ó ś ź ż) load and display correctly.
- [ ] **AC9.** After import, nothing is selected, the detail view and forms are closed, and the whole tree is fitted to the screen.
- [ ] **AC10.** A file with an empty `nodes` list loads as an empty tree and shows the empty state.
- [ ] **AC11.** Unknown fields (top level, node, `data`, edge) survive import → export unchanged (automated test with a fictional fixture).
- [ ] **AC12.** The file is read locally in the browser. No network request is made during import.

### Errors and safety
- [ ] **AC13.** Each of these produces the generic error toast and leaves the current tree, selection, and status unchanged: an empty file, a file that is not JSON, JSON with the wrong shape, a file with an unsupported `version`, and a file the browser cannot read.
- [ ] **AC14.** The app does not crash, freeze, or show a blank screen for any of the cases in AC13 (automated tests with fixtures).
- [ ] **AC15.** No file content or person names are written to the console or shown in error messages.

### Replacing the current tree
- [ ] **AC16.** If the current tree has unexported changes (status "Not exported yet" or "Changes not exported") and a **valid** file is chosen, the confirmation dialog is shown **after** the file has been checked. An invalid file shows only the error toast, never the dialog.
- [ ] **AC17.** Cancel in the dialog keeps the current tree and status unchanged. Replace loads the file.
- [ ] **AC18.** If the current tree is empty, or its status is "Exported at …" or "Loaded from file", the file loads without any dialog.
- [ ] **AC19.** The dialog is keyboard accessible: focus starts on Cancel, Escape cancels, focus returns to the Import button afterwards, and the dialog has a proper accessible title.

### Status and leaving the page
- [ ] **AC20.** After a successful import, the status shows "Loaded from file" with no dot. After any tree change, it becomes "Changes not exported".
- [ ] **AC21.** The browser's "leave site?" prompt does not appear after import until the tree is changed.

### Messages and language
- [ ] **AC22.** The success toast shows the number of people with correct plural forms: English 1 / 2 / 5, and Polish 1 ("osobę"), 2 to 4 ("osoby"), 5 ("osób"), and 22 ("osoby") (automated test).
- [ ] **AC23.** All new strings exist in both `en` and `pl`, none are hardcoded, and the key-parity test passes with the language-specific plural forms.
- [ ] **AC24.** Switching the language while a toast or dialog is open updates its text immediately.

### Quality
- [ ] **AC25.** Import logic lives in `src/io/` as a pure function (for example `parseTreeFile(text) → { ok: true, tree } | { ok: false }`) with no React imports.
- [ ] **AC26.** Test fixtures contain **fictional** data only: a valid file, a file with unknown fields, an empty-nodes file, an empty file, a non-JSON file, a wrong-shape file, and a wrong-version file.
- [ ] **AC27.** A component test covers: start with an empty app → import a valid fixture → tree shown and status "Loaded from file" → change the tree → import again → confirmation dialog appears → cancel keeps the tree.
- [ ] **AC28.** The README explains how to import and export files, and `docs/file-format.md` notes that unknown fields are preserved.
- [ ] **AC29.** `npm run lint`, `npm test`, and `npm run build` pass, and deployment still works.
- [ ] **AC30.** No real or sensitive data is added anywhere in the repo.

## 8. Known Limitations (accepted for this story)

- A file that has the right structure but inconsistent content (for example, an edge pointing to a person who does not exist, a cycle of parents, or duplicate ids) **passes the check** and may display incorrectly or break the layout. Files exported by this app are always consistent. A later story will add deeper validation, helpful error messages, and migrations.
- Files edited by hand or created by other tools are therefore at the user's own risk until that story is done.

## 9. Technical Notes

- Read the file with `file.text()` (or `FileReader` as a fallback). Parse with `JSON.parse` inside a try/catch, then run the existing zod schema. Any failure returns the same generic result.
- Reuse the toast and dialog components from stories 2 and 3. Do not create new variants.
- On import, set the tree and reset the revision counters so that "Loaded from file" is considered clean. Do not treat import as a user change.
- Keep the file input out of the visual layout (visually hidden but present in the DOM), and trigger it from the button's click handler so that iOS Safari allows it.
- Do not add dependencies.

## 10. Definition of Done

- All acceptance criteria are checked.
- Merged to `main`, GitHub Actions green, live site updated.
- Verified on a real iPhone (Safari), an Android phone or desktop Chrome, and desktop Firefox, in both languages, including the round trip between devices (export on desktop, import on phone, and the other way around).
- No real or sensitive data in the repo.

## 11. How the Product Owner Will Verify

1. Open the live site, start a tree, add four or five fictional people, and export the file.
2. Reload the page and press **Import a file** on the empty state. Choose the file. The same tree appears, and the toast says how many people were loaded.
3. Export again and compare the two files. They should be identical.
4. Add a person, then press **Import** in the top bar and choose the file again. The confirmation appears. Press Cancel and confirm that the new person is still there. Repeat and choose Replace. The tree goes back to the file's state.
5. Try to import an image, a text file renamed to `.json`, and an empty file. Each shows the generic error and the tree stays as it was.
6. Switch to Polish and repeat steps 2 and 4. Check the plural forms with trees of 1, 2, and 5 people.
7. Send the exported file to your phone (email or messaging) and import it there. Then export from the phone and import on the desktop.

## 12. Notes for Next Stories (not part of this story)

Likely next: autosave to browser storage, editing and deleting people, connecting existing people, deeper validation with helpful messages, drag-and-drop import on desktop, additional person fields, undo/redo, PWA.