# Story 008: Name the export file and overwrite it on repeat exports

| | |
|---|---|
| **ID** | 008 |
| **Type** | Feature story |
| **Priority** | Should have |
| **Size** | Medium |
| **Depends on** | Story 003 (export, status, toast), Story 004 (import, "Loaded from file" status) |
| **References** | `AGENTS.md` (section 7), `DESIGN.md` |

## 1. User Story

**As a** user,
**I want** to choose the name of the exported file, and have later exports replace that same file instead of creating more copies,
**so that** I always have one up-to-date file with a name I recognize.

## 2. Context and Intent

Today every export downloads `family-tree-YYYY-MM-DD.json`. After a working session the user has a pile of `family-tree-2026-11-08 (1).json`, `(2)`, `(3)` and no obvious "latest" file.

**Important browser limitation (read this first).** A normal web page cannot overwrite a file in the Downloads folder. The `<a download>` mechanism always creates a new file, and the browser adds a number if the name exists. Only browsers that implement the **File System Access API** (desktop Chrome, Edge, Opera) let a page write to a file the user picked, again and again. Firefox, Safari (including iOS) and Android Chrome do not.

So this story has two paths, chosen by **feature detection** (never by browser name):

| Path | Browsers | Naming | Repeat exports |
|---|---|---|---|
| **Enhanced** | Those that provide `showSaveFilePicker` | Native "Save as" dialog | **Overwrite the same file** silently |
| **Fallback** | All others | Small in-app dialog | Download again with the **same name** (the browser may add a number) |

This respects `AGENTS.md` section 7: the File System Access API is an optional enhancement and is never required. The fallback must remain fully working.

The file **content and format do not change**. Only naming and the way the file is written change.

## 3. Scope

### In scope
1. Choosing the file name at the first export of a session.
2. Remembering the chosen file for the rest of the session, so later exports reuse it (overwriting it where the browser allows).
3. An **Export as…** action to choose a new name or location.
4. Pre-filling the name from the imported file's name after an import.
5. Updated feedback texts, and documentation of the per-browser behavior.

### Out of scope (do not build)
- Remembering the file across page reloads (storing the file handle in IndexedDB). After a reload the first export asks again.
- Overwriting the **imported** file directly (this would need `showOpenFilePicker` and would change story 004, which uses only `<input type="file">`).
- Autosave, scheduled exports, cloud storage, the Web Share API.
- Choosing a folder in the fallback path (the browser decides).
- Any change to the file content, version, or other formats.

## 4. Behavior Rules

### 4.1 The export target (in memory only)
The app keeps one optional **export target** for the session: `{ name: string, handle?: FileSystemFileHandle }`. It is never written to `localStorage`, the file, or the console.

| Event | Effect on the target |
|---|---|
| First successful export | Target is set (name, plus handle in the enhanced path) |
| Export as… (successful) | Target is replaced |
| Successful import | Target becomes **name only**, taken from the imported file's name (see 4.5). Any handle is dropped |
| Start a new tree (from the empty state) | Target is cleared |
| Import fails, export fails, or the user cancels | Target unchanged (but see 4.4 for a failed write) |
| Deleting people, editing, language change | Target unchanged |

A target with a name but no handle counts as "no file chosen yet" for the flow in 4.3, and only supplies the suggested name.

### 4.2 File name rules
Implemented as a pure function `normalizeFileName(input): { ok: true, name } | { ok: false, reason }` in `src/io/`.

- Normalize to Unicode **NFC**. Polish letters (ą ć ę ł ń ó ś ź ż) and other Unicode letters are kept exactly.
- Each character that is invalid in file names (`\ / : * ? " < > |` and control characters) is **replaced by a space**. Then repeated whitespace is collapsed and the result is trimmed. Trailing dots are removed.
  Example: `Rodzina: Łukasz/Żółtowski?` becomes `Rodzina Łukasz Żółtowski`.
- A trailing `.json` (any letter case) is accepted and not doubled. The saved file always ends with lowercase `.json`.
- The part before `.json` must be 1 to 100 characters after cleaning. Otherwise `{ ok: false, reason: "empty" | "tooLong" }`.
- Windows reserved names (`CON`, `NUL`, `COM1`, …) get an underscore appended.
- **Default suggested name:** the target's name if there is one, otherwise `buildExportFilename(date)` from story 003 (`family-tree-YYYY-MM-DD.json`, local date).

### 4.3 The export flow

| Situation | Enhanced path | Fallback path |
|---|---|---|
| **No target with handle yet** (first export, or after an import) | Native save dialog opens with the suggested name. On confirm, the file is written and the handle is kept | In-app **Name your file** dialog (see 5.2). On confirm, the file is downloaded under that name |
| **Target exists** (a later export) | The tree is written **directly to the same file**. No dialog | The file is downloaded immediately with the **same name**. No dialog |
| **Export as…** | Native save dialog again. The chosen file becomes the target | In-app dialog again. The name becomes the target |
| **User cancels** (closes the native dialog or presses Cancel) | Nothing happens: no toast, no status change | Same |

Rules that apply to all rows:
- The tree is serialized and validated with zod **before** anything starts (story 003, AC7). On failure there is no dialog, no write, and the existing error message is shown.
- The file text is exactly `serializeTree(tree)`. The bytes written are identical to what the download path produces.
- The export button ignores presses while an export is in progress (dialog open or write running).
- The status becomes "Exported at HH:MM" when the write has **completed** (enhanced) or the download has **started** (fallback). A cancelled dialog changes nothing.

### 4.4 Enhanced path details
- Detect with `typeof window.showSaveFilePicker === "function"`. If it is missing, use the fallback. No user-agent checks.
- Call `showSaveFilePicker({ suggestedName, types: [{ description, accept: { "application/json": [".json"] } }] })`. The description comes from the translation layer.
- If the user picks an existing file, the operating system's own "replace?" confirmation applies. The app adds no extra confirmation.
- The name the user actually picked (`handle.name`) is what the app stores and shows, even if it differs from the suggestion.
- Write with `createWritable()`, one `write(text)`, then `close()`. The browser commits the file on `close()`, so a failed write leaves the old file intact.
- Before writing to a stored handle, check `queryPermission({ mode: "readwrite" })`. If it is not `granted`, call `requestPermission` (inside the click). If it is still not granted, **forget the handle and open the native dialog instead**.
- `AbortError` (user cancelled the dialog) is a silent cancel. Any other error shows the existing error toast (`export.error`), logs only the error name (never the file name or content), changes no status, and **forgets the handle**, so the next export opens the dialog.

### 4.5 Name from an imported file
- After a successful import, if the imported file's name ends with `.json` (any case), the target name becomes that name after normalization. Otherwise the target stays empty.
- This lets the user import `my-tree.json`, edit, press Export, and get a save dialog already suggesting `my-tree.json`. In the enhanced path they confirm the replacement in the native dialog. From then on, exports are silent.
- Only the file **name** is read (`File.name`). No new file API is used, so story 004 AC3 stays true.

### 4.6 Feedback
The toast from story 003 is reused (one at a time, about 8 seconds, polite announcement).

| Result | Line 1 | Line 2 |
|---|---|---|
| New file or new name | "Exported as {{filename}}" | Privacy note (unchanged) |
| Existing file overwritten (enhanced) | "Updated {{filename}}" | Privacy note |
| Fallback, a target already existed | "Exported as {{filename}}" | "Your browser may add a number if a file with this name already exists." Then the privacy note |

## 5. Screens and Components

All visuals follow `DESIGN.md`. No new colors.

### 5.1 "Export as…" menu
- Next to the Export button: an **icon pill** (44x44px, chevron-down, `aria-label` "More export options") that opens a small popover (panel style: cream, `1px solid --border`, radius 16px, no shadow).
- The popover has one item, **Export as…** (a ghost-style row, 44px high), and, when a target exists, a muted caption line "Current file: {{filename}}".
- Closes with Escape, with a tap outside, or after choosing the item. Focus returns to the pill. Arrow keys are not required; Tab order is enough.
- At 360px the top bar must still fit in both languages with Import, Export, the pill, the status dot, and the language toggle. If space runs out, the wordmark may shorten with an ellipsis. Nothing else may be removed.
- The pill and popover are hidden when there is no tree, like the Export button.

### 5.2 Name your file dialog (fallback path only)
- Same style as other dialogs (modal on desktop, bottom sheet on mobile).
- Title "Name your file". One text input labeled "File name", with the suggested name (without `.json`) pre-filled and fully selected, followed by a static `.json` suffix. A muted caption shows the duplicate-name hint from 4.6.
- Buttons: primary **Export** (reuses `export.button`), ghost **Cancel**. Enter submits, Escape cancels. Focus starts in the input. Focus returns to the Export button afterwards.
- Validation under the field, in plain language: empty name, or too long (reuses `error.tooLong`).
- On submit the name goes through `normalizeFileName`. The cleaned name is what the toast shows.

## 6. Scenario Catalogue

| ID | Given | When | Then |
|----|-------|------|------|
| **X1** | Enhanced browser, tree with people, no target | Press Export | Native dialog suggests `family-tree-<today>.json`. After confirming, the file is written, toast "Exported as …", status "Exported at …" |
| **X2** | X1 done, then a person is added | Press Export | No dialog. The same file is overwritten. Toast "Updated …". Status "Exported at …" |
| **X3** | Enhanced browser | Press Export, then close the native dialog | Nothing changes: no toast, status unchanged |
| **X4** | X1 done | Export as… and pick another name | Native dialog opens with the current name. The new file becomes the target. The next Export writes to it |
| **X5** | Fallback browser, no target | Press Export | In-app dialog opens. After confirming `Rodzina Testowa`, `Rodzina Testowa.json` is downloaded |
| **X6** | X5 done, then a change | Press Export | Download starts at once with the same name. Toast includes the duplicate-name hint |
| **X7** | Any browser, file `my-tree.json` imported | Press Export | Suggested name is `my-tree.json` (dialog or native dialog). No silent write yet |
| **X8** | Enhanced browser, target exists, but the file's permission is revoked or the write throws | Press Export | Permission is requested once. If refused or the write fails: the error toast, the handle is forgotten, and the next Export opens the native dialog |
| **X9** | Fallback dialog | Type `Rodzina: Łukasz/Żółtowski?` and confirm | File is `Rodzina Łukasz Żółtowski.json`, diacritics intact |
| **X10** | Target exists | Press Start a new tree (after deleting all people), then create a person and export | Treated as a first export: the dialog or native dialog appears with the default dated name |
| **X11** | Any | Export, then import the saved file, then export again | Both exported files are byte-identical |

## 7. Language and Text (English / Polish)

| Key | English | Polish |
|-----|---------|--------|
| export.as | Export as… | Eksportuj jako… |
| export.moreLabel | More export options | Więcej opcji eksportu |
| export.currentFile | Current file: {{filename}} | Bieżący plik: {{filename}} |
| export.name.title | Name your file | Nazwij plik |
| export.name.label | File name | Nazwa pliku |
| export.name.errorEmpty | Enter a file name | Wpisz nazwę pliku |
| export.name.pickerType | Family tree file | Plik drzewa rodzinnego |
| export.duplicateHint | Your browser may add a number if a file with this name already exists. | Przeglądarka może dodać numer, jeśli plik o tej nazwie już istnieje. |
| export.toast.updated | Updated {{filename}} | Zaktualizowano plik {{filename}} |

Reused: `export.button`, `export.toast.title`, `export.toast.privacy`, `export.error`, `action.cancel`, `error.tooLong`. The file name is inserted by interpolation. The file itself never contains translated text.

## 8. Acceptance Criteria

### File name rules
- [ ] **AC1.** `normalizeFileName` exists in `src/io/` as a pure function with no React imports and follows section 4.2.
- [ ] **AC2.** Unit tests cover: Polish and other Unicode letters kept, each invalid character replaced by a space, whitespace collapsed, a doubled `.json` avoided (including `.JSON`), empty and too-long names rejected, trailing dots removed, a reserved Windows name, and NFC normalization.
- [ ] **AC3.** The default suggested name is the target's name, otherwise `family-tree-YYYY-MM-DD.json` using the local date (story 003 function unchanged).

### Enhanced path
- [ ] **AC4.** The path is chosen only by feature detection of `showSaveFilePicker`. There are no user-agent checks, and the API is never required.
- [ ] **AC5.** The first export opens the native dialog with the suggested name and the JSON file type filter. Confirming writes the file and stores the handle.
- [ ] **AC6.** A later export writes to the same handle with no dialog, and the toast says "Updated {{filename}}".
- [ ] **AC7.** Cancelling the native dialog (`AbortError`) changes nothing: no toast, no status change, no console output.
- [ ] **AC8.** If the stored handle's permission is missing, it is requested once. If refused, or if the write fails, the handle is forgotten, the error toast is shown, the tree and status are unchanged, and only the error name (never a file name or content) is logged.
- [ ] **AC9.** The stored name is the name the user actually picked (`handle.name`).
- [ ] **AC10.** The bytes written equal `serializeTree(tree)` encoded as UTF-8 (automated test with a mocked picker and writable).

### Fallback path
- [ ] **AC11.** Without `showSaveFilePicker`, the first export shows the in-app dialog from 5.2, and the download uses the cleaned name.
- [ ] **AC12.** A later export downloads immediately with the same name and no dialog. The toast includes the duplicate-name hint.
- [ ] **AC13.** The download mechanism is unchanged from story 003 (`Blob`, temporary `<a download>`, object URL revoked after a short delay).
- [ ] **AC14.** The dialog follows 5.2: input focused and selected, Enter submits, Escape cancels, validation under the field, focus returns to the Export button.

### Export as… and the target
- [ ] **AC15.** The icon pill and popover follow 5.1, are keyboard accessible, and are hidden when there is no tree.
- [ ] **AC16.** Export as… always asks for a name or file again (native dialog or in-app dialog) and replaces the target only after a successful export.
- [ ] **AC17.** The target follows the table in 4.1 (set on export, replaced by Export as…, name-only after import, cleared by Start a new tree).
- [ ] **AC18.** After an import of a file named `*.json`, the suggested name is that file's name, no silent write happens, and no new file API is used. Other file names leave the target empty.
- [ ] **AC19.** The target is never persisted (`localStorage`, IndexedDB, file) and never logged.

### Status and safety
- [ ] **AC20.** The status "Exported at …" is set when the write completes (enhanced) or the download starts (fallback), and never after a cancel or error. Selecting, panning, zooming, and language changes still do not affect it.
- [ ] **AC21.** The leave-site warning (story 003) behaves exactly as before. A successful overwrite clears it.
- [ ] **AC22.** Pressing Export repeatedly while a dialog is open or a write is running starts only one export.
- [ ] **AC23.** The serialization validation from story 003 AC7 still runs first, and a failure shows the existing error with no dialog and no write.
- [ ] **AC24.** No network request is made, and the exported file content is byte-identical to story 003's output for the same tree.

### Language and responsiveness
- [ ] **AC25.** All new strings exist in both `en` and `pl`, none are hardcoded, and the key-parity test passes. The file name is always interpolated.
- [ ] **AC26.** Switching language while the dialog, the popover, or the toast is open updates the text immediately without losing the typed name.
- [ ] **AC27.** The top bar fits at 360px in both languages (section 5.1), and all touch targets are at least 44x44px.

### Documentation and quality
- [ ] **AC28.** The README and `docs/file-format.md` explain, per browser type, what Export does: native overwrite in Chrome, Edge, and Opera on desktop, and a new download with the same name elsewhere. They also state that a reload forgets the file.
- [ ] **AC29.** Component tests cover X1 to X3 with a mocked `showSaveFilePicker`, and X5, X6, and X9 with the picker undefined. Unit tests cover X7, X8, X10, and X11.
- [ ] **AC30.** `npm run lint`, `npm test`, and `npm run build` pass, deployment still works, no new dependency is added, and no real or sensitive data is added to the repo. Minimal local TypeScript declarations for the File System Access API are acceptable.

## 9. Technical Notes

- Put the logic behind a small interface in `src/io/`, for example `exportTree({ text, target, forcePicker, env })`, where `env` provides `showSaveFilePicker` and the download function. Both can then be replaced by mocks. The functions have no React imports.
- Keep the target in the app state next to `revision` and `exportedRevision`. It is not part of the tree and never reaches `serializeTree`.
- The write must happen **inside the click handler's user gesture** (or directly after the picker resolves) so strict browsers allow it.
- The file name is personal data now. Do not put it in `document.title`, the console, error messages, or test snapshots with real names. Tests use fictional names.
- Do not add dependencies. The platform APIs are enough.

## 10. Required Update to `AGENTS.md`

- Section 6, item 2 (Export): replace the fixed filename pattern with "default `family-tree-YYYY-MM-DD.json`, user-chosen name, overwrite where the browser supports it".
- Section 7: state that the File System Access API is now used as an optional enhancement behind feature detection, with the download path as the guaranteed fallback.
- Note that story 008 supersedes story 003's "no custom filename" scope and AC8's "File System Access API is not used".

## 11. Definition of Done

- All acceptance criteria are checked.
- Merged to `main`, GitHub Actions green, live site updated.
- Verified on desktop Chrome or Edge (overwrite works), desktop Firefox, a real iPhone (Safari), and an Android phone, in both languages.
- The overwritten file was opened in a text editor and checked for correct content and Polish characters.
- README and `docs/file-format.md` are up to date.
- No real or sensitive data in the repo.

## 12. How the Product Owner Will Verify

1. On desktop Chrome, create a tree and press **Export**. A save dialog suggests `family-tree-<today>.json`. Rename it to a name of your choice and save.
2. Add a person and press **Export** again. No dialog appears, the toast says "Updated …", and the file in your folder now contains the new person. Check that there is no `(1)` copy.
3. Open the small menu next to Export and choose **Export as…**. Pick another name. Add a person, export again, and confirm the new file is the one that changes.
4. Reload the page, import your file, change something, and press Export. The dialog suggests the imported file's name. Confirm the replacement in the system dialog. The next export is silent.
5. Open the live site in Firefox. Press Export. The in-app dialog asks for a name. Type `Rodzina: Łukasz/Żółtowski?` and confirm. The file is named `Rodzina Łukasz Żółtowski.json`. Export again. It downloads at once, and the toast mentions a number may be added.
6. Repeat step 5 on an iPhone.
7. Close a dialog without saving. Nothing changes and the status stays as it was.
8. Switch to Polish and check all new texts, then check that the top bar fits on a 360px-wide phone.

## 13. Notes for Next Stories (not part of this story)

Likely next: keeping the file handle across reloads (IndexedDB), overwriting the imported file directly where supported, autosave to browser storage, drag-and-drop import, deeper import validation.