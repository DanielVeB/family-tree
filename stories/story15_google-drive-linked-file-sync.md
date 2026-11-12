# Story 015: Open and save a shared Google Drive tree file by link

| | |
|---|---|
| **ID** | 015 |
| **Type** | Feature story |
| **Priority** | Not specified |
| **Size** | Not specified |
| **Depends on** | Story 004 (import flow and replacement safety), Story 008 (export target behavior and local export fallback) |
| **References** | `AGENTS.md`, `DESIGN.md` |

## 1. User Story

**As a** user,  
**I want** to open a family-tree JSON file from a Google Drive link and save changes back to that same Drive file,  
**so that** multiple people with access can keep one shared up-to-date file while still being able to export locally.

## 2. Scope

### In scope
1. A way to provide a Google Drive file link and load that file as the current tree.
2. In-app Google OAuth sign-in for Drive access; save to Drive is allowed only when the signed-in user can edit that file.
3. Saving updates back to the same Drive file instead of downloading when the current source is Drive.
4. Keeping local export available at all times as an explicit separate action.
5. Recording save-history metadata in the JSON file whenever a save succeeds (Drive or local export).

### Out of scope
- Real-time co-editing, merge conflict resolution, locking, or presence indicators.
- Browsing Drive files inside the app; this story starts from a pasted link only.
- Sharing-permission management; users configure Drive sharing outside the app.
- Any backend service for proxying Drive calls.

## 3. Behavior Rules

### 3.1 Policy and compatibility boundary

- This story intentionally updates the current "no user-data network calls" rule by adding one explicit exception: user-authorized Google Drive read/write for this feature.
- The app remains client-side only (no project backend).
- Existing local import/export behavior remains supported.

### 3.2 Supported link and access

- The user can paste a Google Drive file link that resolves to one JSON file (extracting file ID from supported Drive URL forms).
- If the link is invalid, unsupported, inaccessible, or not JSON matching the tree schema, loading fails with a friendly translated error and the current tree stays unchanged.
- Saving to Drive requires in-app Google OAuth. If not signed in, the save flow prompts sign-in first.
- If signed in but lacking edit permission, show a translated "read-only/no edit access" message and keep the tree loaded without overwriting Drive.

### 3.3 Source-aware save behavior

- When the current tree was loaded from a Drive link, the primary save action writes to that same Drive file ID.
- A successful Drive save updates export/change status as a successful save target, consistent with existing status behavior.
- If Drive save fails (network/API/auth), show a friendly translated error and keep in-memory edits intact.
- Local export remains available as a separate action and does not remove the Drive source unless the user explicitly opens another source.

### 3.4 Save-history metadata in JSON

- Add top-level metadata for save history while preserving unknown fields:
  - `metaData.saveHistory` as an array of entries.
  - Each entry includes at minimum:
    - `savedAt` (ISO 8601 timestamp),
    - `target` (`"googleDrive"` or `"localExport"`).
- On every successful save (Drive overwrite or local export), append one new history entry.
- Existing files without this metadata remain valid; metadata is created on first successful save.
- Unknown existing top-level, node, `data`, and edge fields are still preserved unchanged.

### 3.5 Safety and UX details

- If there are unexported/unpersisted changes, opening a different Drive link follows the same replacement-confirmation safety pattern used by file import.
- The app clearly indicates when the current source is Drive and shows the connected state (signed in / not signed in / read-only) in accessible text, without exposing private user data beyond what is already visible in Google sign-in UI.
- Keyboard and touch behavior follow existing patterns from `DESIGN.md` (44x44 targets, accessible focus, mobile-first layout).

## 4. Language

Add English and Polish translations for:
- Open from Google Drive link action and field label.
- Link validation errors and inaccessible-file errors.
- Sign-in required, permission denied/read-only, save success, and save failure messages.
- Source indicator text (Drive vs local).

All text must come from i18n resources; no hardcoded user-facing strings.

## 5. Acceptance Criteria

- [ ] **AC1.** A user can paste a supported Google Drive file link, and the app loads the referenced JSON tree when access and schema validation pass.
- [ ] **AC2.** Invalid link, inaccessible file, non-JSON content, or schema-invalid JSON each show a friendly translated error and do not alter the current tree.
- [ ] **AC3.** Drive save requires Google OAuth sign-in in the app; without sign-in, the app prompts sign-in before save.
- [ ] **AC4.** When signed in without edit access, the app blocks overwrite, shows a translated read-only/permission message, and keeps edits in memory.
- [ ] **AC5.** When the current source is Drive and the user has edit access, save overwrites that same Drive file (by file ID), not a new local download.
- [ ] **AC6.** Local export remains available as a separate action even for Drive-loaded trees.
- [ ] **AC7.** On every successful save, one new `metaData.saveHistory` entry with `savedAt` and `target` is appended to the JSON; failed saves append nothing.
- [ ] **AC8.** Files without `metaData.saveHistory` import normally; unknown fields continue to round-trip unchanged.
- [ ] **AC9.** If replacing the current tree with a different Drive link while changes are unsaved, the existing confirmation pattern prevents silent data loss.
- [ ] **AC10.** New Drive-related UI text exists in both `en` and `pl`; keyboard accessibility and 360px mobile layout remain usable.
- [ ] **AC11.** Automated tests cover: link parsing, load success/failure paths, auth-required save, permission-denied save, successful Drive overwrite behavior, save-history append rules, and local-export fallback.
- [ ] **AC12.** `npm run lint`, `npm test`, and `npm run build` pass.

## 6. Product Owner Verification

1. Use a fictional sample tree file in Google Drive shared for editing, paste its link, and load it in the app.
2. Edit one person, save to Drive, then reopen the file and confirm both content changes and a new `metaData.saveHistory` entry with target `googleDrive`.
3. Trigger a local export and confirm another history entry with target `localExport`.
4. Test with a user account that can view but not edit; confirm save is blocked with a translated permission message.
5. Switch app language between English and Polish and confirm all Drive-related actions/messages update correctly.
