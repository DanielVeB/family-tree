# Story 003: Export the tree as a JSON file

| | |
|---|---|
| **ID** | 003 |
| **Type** | Feature story |
| **Priority** | Must have |
| **Size** | Small to medium |
| **Depends on** | Story 002 (tree data model, creating people and relations) |
| **References** | `AGENTS.md` (section 7 Import/Export), `DESIGN.md` |

## 1. User Story

**As a** user,
**I want** to export my tree as a JSON file,
**so that** I can save my work, reuse it later, and share it with other people.

## 2. Context and Intent

The app has no backend, so the exported file is the user's **only durable copy** of their work and the only way to share a tree. Export therefore has to be reliable on every browser, including iOS Safari, and the file must be clean, readable, and stable, because it is the contract with future stories (import, sharing, new fields).

This story also adds simple **unsaved-changes tracking**, so the app can tell the user when their latest work has not been exported yet. This replaces the temporary "always warn before leaving" safeguard from story 002.

> **Note for the product owner:** until the import story is done, an exported file cannot be loaded back into the app. "Reuse" is only complete after import. It is recommended to do the import story **immediately after** this one.

## 3. Scope

### In scope
1. An **Export** button available when the tree has at least one person.
2. Download of a `.json` file containing exactly the tree data from the story 002 model.
3. A clean, human-readable file format, documented for people who receive the file.
4. Tracking of whether the tree has changed since the last export, shown to the user.
5. Feedback after exporting, including a short privacy reminder.
6. Replacing the unconditional "leave site?" warning from story 002 with one that appears only when there are unexported changes.

### Out of scope (do not build)
- Import of files (next story).
- Autosave to browser storage.
- Choosing a custom filename or save location in the app.
- Native share sheet (Web Share API), email, or links.
- Other formats (PDF, image, GEDCOM, CSV).
- Encryption or password protection.
- Automatic export reminders after N edits.

## 4. File Specification

### 4.1 Content
The file contains the in-memory tree exactly as defined in story 002 (section 3.2), and nothing else:

```json
{
  "version": 1,
  "nodes": [
    { "id": "3f2c...", "data": { "firstName": "Anna", "lastName": "Testowa" } }
  ],
  "edges": [
    { "from": "3f2c...", "to": "9a1b...", "type": "marriage" }
  ]
}
```

- No timestamps, app metadata, or UI state (selection, zoom, positions). The file must be **deterministic**: exporting the same tree twice produces byte-identical files.
- Node and edge **order** is the order in the tree state (creation order), which keeps files stable and easy to compare.
- Unknown fields that exist on the tree (for example, extra fields inside `data` loaded in the future) are written back unchanged.

### 4.2 Format
- UTF-8 text, pretty-printed with 2-space indentation, and a trailing newline.
- Characters must be written as they are, **not** escaped. Names such as "Łukasz Żółtowski" must appear exactly like that in the file, not as `\u0141...`.
- MIME type `application/json`, extension `.json`.

### 4.3 Filename
- Pattern: `family-tree-YYYY-MM-DD.json`, using the user's **local** date (not UTC), for example `family-tree-2026-11-02.json`.
- The filename does not depend on the interface language or on the names in the tree (names are personal data and should not leak into filenames).
- If the browser already has a file with this name, the browser's own handling applies (for example, a "(1)" suffix).

### 4.4 Safety check before export
The serialized tree is validated with the zod schema from story 002 **before** the download starts. If validation fails (should never happen, but a bug must not produce a corrupt file), no file is downloaded and a clear error message is shown (section 6), and the problem is logged to the console.

## 5. Screens and Behavior

All visuals follow `DESIGN.md`.

### 5.1 Export button
- Location: top bar, right side, next to the language toggle.
- Style: ghost button with the label **Export** (on very narrow screens, an icon-only pill with an `aria-label` is acceptable, 44x44px minimum).
- **Hidden** when there is no tree (empty state). Visible as soon as the first person exists.
- Pressing it starts the download immediately, with no extra dialog.
- The button must not be pressable twice in quick succession, and a second press must not produce a corrupted or duplicate file in the same instant.

### 5.2 Unsaved-changes status
A small muted text (caption style, `--muted`) next to the Export button, plus an indicator on the button. Three states:

| State | When | Indicator |
|-------|------|-----------|
| Not exported yet | The tree has people but has never been exported in this session | Small dot on the Export button, text "Not exported yet" |
| Changes not exported | The tree changed after the last export | Small dot on the Export button, text "Changes not exported" |
| Exported | No changes since the last export | No dot, text "Exported at 14:32" |

- The dot uses the charcoal color (the design system has no accent colors) and is also conveyed in text for accessibility, never by the dot alone.
- On narrow screens (below 640px), the caption may be hidden visually, but the status must remain available to screen readers, and the dot stays visible.
- Time is formatted with `Intl` in the active language (24-hour format in Polish).

### 5.3 Feedback after export
- A toast appears (cream panel, `1px solid #eceae4`, 12px radius, bottom center on mobile and bottom right on desktop) with:
    - Line 1: "Exported as family-tree-2026-11-02.json"
    - Line 2 (muted): "The file contains the names from your tree. Share it only with people you trust."
- The toast stays for about 8 seconds, has a close button, announces itself to screen readers (`role="status"`, polite), and does not block interaction.
- A browser cannot confirm that the user actually saved the file (for example if they cancel a save dialog), so the wording says "exported", not "saved to your device". The status moves to "Exported at …" when the download is **started**.

### 5.4 Leaving the page
- The browser's standard "leave site?" confirmation appears on reload or close **only if** the tree has unexported changes, meaning the status is "Not exported yet" or "Changes not exported".
- No warning when the status is "Exported" or when there is no tree.

## 6. Language and Text (English / Polish)

| Key | English | Polish                                                                         |
|-----|---------|--------------------------------------------------------------------------------|
| export.button | Export | Eksportuj                                                                      |
| export.buttonLabel | Export tree as a file | Eksportuj drzewo do pliku                                                      |
| export.status.never | Not exported yet | Jeszcze nie zapisano                                                           |
| export.status.dirty | Changes not exported | Zmiany nie zostały zapisane                                                    |
| export.status.done | Exported at {{time}} | Wyeksportowano o {{time}}                                                      |
| export.toast.title | Exported as {{filename}} | Wyeksportowano jako {{filename}}                                               |
| export.toast.privacy | The file contains the names from your tree. Share it only with people you trust. | Plik zawiera dane osób z Twojego drzewa. Udostępniaj go tylko zaufanym osobom. |
| export.toast.close | Close notification | Zamknij powiadomienie                                                          |
| export.error | The file could not be created. Your tree is unchanged, please try again. | Nie udało się utworzyć pliku. Drzewo nie zostało zmienione, spróbuj ponownie.  |

All strings go through the translation layer. Switching language while a toast is visible updates the toast text immediately. The file itself never contains translated text.

## 7. Acceptance Criteria

### File content and format
- [ ] **AC1.** A pure function `serializeTree(tree): string` exists in `src/io/` and returns the JSON text as specified in section 4 (2-space indentation, trailing newline, no escaped characters).
- [ ] **AC2.** The output contains exactly `version`, `nodes`, and `edges` (plus any unknown tree fields preserved as-is), and no UI state, timestamps, or metadata.
- [ ] **AC3.** Exporting the same tree twice produces identical text.
- [ ] **AC4.** Names with Polish characters (ą ć ę ł ń ó ś ź ż) and other Unicode characters are written unescaped and are preserved exactly.
- [ ] **AC5.** The serialized output parses back with the zod schema from story 002 and deep-equals the original tree (automated round-trip test).
- [ ] **AC6.** A pure function `buildExportFilename(date)` returns `family-tree-YYYY-MM-DD.json` using the **local** date, and has tests including a date around midnight and a month or year boundary.
- [ ] **AC7.** If validation of the serialized tree fails, no download starts, the translated error message is shown, the tree is unchanged, and the error is logged to the console.

### Download behavior
- [ ] **AC8.** Pressing Export downloads a file with the correct name and content, using only broadly supported browser APIs (`Blob`, `URL.createObjectURL`, a temporary `<a download>` element). The File System Access API is not used.
- [ ] **AC9.** The temporary element is removed and the object URL is revoked after the download starts, so no memory leaks accumulate after repeated exports.
- [ ] **AC10.** Export works on: desktop Chrome, Firefox, and Edge or Safari; Android Chrome; and **iOS Safari** (verified on a real device).
- [ ] **AC11.** A tree with 1,000 people exports without noticeable delay or UI freeze.
- [ ] **AC12.** No network request is made during export.

### Button and status
- [ ] **AC13.** The Export button is not shown in the empty state and appears as soon as the first person is created.
- [ ] **AC14.** The status shows "Not exported yet" for a new tree, "Exported at HH:MM" after export, and "Changes not exported" after any further change (adding a person or relation).
- [ ] **AC15.** Status is determined by comparing a change counter (revision) in state, not by deep-comparing trees. Non-data actions (selecting a person, panning, zooming, switching language, opening forms) do **not** mark the tree as changed.
- [ ] **AC16.** The status is available as text to screen readers at all widths, and the button has an accessible name.
- [ ] **AC17.** The button and indicator follow `DESIGN.md` (ghost button, charcoal dot, no new colors) and have a touch target of at least 44x44px.

### Toast
- [ ] **AC18.** After a successful export, the toast from section 5.3 appears with the filename and the privacy note, and disappears after about 8 seconds or when closed.
- [ ] **AC19.** The toast is announced politely to screen readers, can be closed with the keyboard, and does not trap focus or block the tree.
- [ ] **AC20.** Several quick exports show one toast at a time (the newest replaces the old one).

### Leaving the page
- [ ] **AC21.** The browser's "leave site?" prompt appears on reload or close if and only if there are unexported changes (replaces story 002 AC30).
- [ ] **AC22.** After an export, with no later changes, reloading does not show the prompt.

### Language and responsiveness
- [ ] **AC23.** All new strings exist in both `en` and `pl`, none are hardcoded, and the key-parity test still passes.
- [ ] **AC24.** The top bar still fits and does not overflow at 360px in both languages with the Export button, status dot, and language toggle visible.
- [ ] **AC25.** The time in "Exported at …" uses the active language's format, and switching language updates it immediately.

### Documentation
- [ ] **AC26.** A file `docs/file-format.md` describes the file format for people receiving or hand-editing files: fields, the three relation types and their direction rules, validation rules, and a small **fictional** example. The README links to it.
- [ ] **AC27.** The README states that the exported file contains personal data and should be stored and shared carefully.

### Quality
- [ ] **AC28.** Unit tests cover `serializeTree`, `buildExportFilename`, the revision and dirty logic, and the validation-failure path.
- [ ] **AC29.** A component test covers: create a person → status "Not exported yet" → press Export → a download is triggered with the expected filename (browser APIs mocked) → status "Exported" → add a person → status "Changes not exported".
- [ ] **AC30.** `npm run lint`, `npm test`, and `npm run build` pass, and deployment still works.
- [ ] **AC31.** No real or sensitive data is added anywhere in the repo (tests, docs, and examples use fictional names).
- [ ] **AC32.** The app still makes no network requests other than loading its own static files.

## 8. Technical Notes

- Keep serialization and filename logic in `src/io/` as pure functions with no React imports. The component only calls them and triggers the download.
- Use a simple `revision` number in the state that increments on every tree-changing action, and an `exportedRevision` that is set when an export starts. `isDirty = revision !== exportedRevision`.
- Start the download from a user gesture (the button click) so that iOS Safari and other strict browsers allow it.
- For `Blob`, use type `application/json;charset=utf-8`. Revoke the object URL after a short delay (for example, a few hundred milliseconds), not synchronously, because some browsers need the URL a moment longer to begin the download.
- Do not put person names in the filename, document title, toast logs, or console output.
- Keep the toast as a small reusable component, because later stories (import errors, save confirmations) will use it.

## 9. Definition of Done

- All acceptance criteria are checked.
- Merged to `main`, GitHub Actions green, live site updated.
- Export verified on a real iPhone (Safari), an Android phone or desktop Chrome, and desktop Firefox, in both languages.
- The exported file was opened in a text editor and checked for readability, correct Polish characters, and the expected structure.
- README and `docs/file-format.md` are up to date.
- No real or sensitive data in the repo.

## 10. How the Product Owner Will Verify

1. Open the live site and start a new tree. The Export button is not visible. Create the first person. The button appears with "Not exported yet".
2. Press Export. A file named `family-tree-<today>.json` downloads, the toast shows the filename and privacy note, and the status says "Exported at <time>".
3. Open the file in a text editor. It is indented, readable, and contains exactly `version`, `nodes`, and `edges`.
4. Create a person named with Polish letters (for example "Łukasz Żółtowski") and export again. The letters appear unchanged in the file.
5. Add another person. The status changes to "Changes not exported". Select people, pan, zoom, and switch language, and confirm the status does not change.
6. Reload with unexported changes. The browser warns you. Export, then reload. No warning appears.
7. Switch to Polish and confirm that the button, status, and toast are translated.
8. Repeat steps 1 to 3 on an iPhone and on an Android phone.

## 11. Notes for Next Stories (not part of this story)

Recommended next: **import** of an exported file (validation, friendly errors, confirmation before replacing a tree with unexported changes). After that: autosave to browser storage, editing and deleting people, connecting existing people, additional person fields, optional native share on mobile, PWA.