# AGENTS.md: Family Tree App

Instructions for AI coding agents working on this project. Read this file and `DESIGN.md` before making changes. `DESIGN.md` is the source of truth for all visual styling; this file is the source of truth for requirements, architecture, and rules.

## 1. Project Summary

A simple, modern family tree web app that runs in every modern browser, on both mobile and desktop.

- Users **import a JSON file** with their family data, edit the tree in the app (add and delete people and relationships), and **export a new JSON file**.
- The app is **fully client-side**. There is no backend, no database, no accounts, and no network calls with user data.
- Supports **two languages: English (EN) and Polish (PL)**, switchable at runtime.
- Hosted for free on **GitHub Pages** from a public repository.
- Keep everything simple. Prefer fewer features, fewer dependencies, and less code.

## 2. Non-Negotiable Rules

1. **No sensitive or real family data in the repository, ever.** This includes code, tests, fixtures, screenshots, docs, commit messages, and issues. Use only clearly fake sample data (for example "Jan Przykładowy", "Anna Testowa").
2. **User data never leaves the browser.** No analytics, no telemetry, no error-reporting services, no third-party scripts, no CDN-loaded fonts or libraries at runtime. Bundle everything.
3. **No backend and no server-side code.** The build output must be plain static files.
4. **Do not add dependencies casually.** Justify each new dependency in the PR or commit message. Prefer the platform (browser APIs) over libraries.
5. **Follow `DESIGN.md` for all styling.** Do not invent new colors, fonts, shadows, or radii.
6. **No hardcoded user-facing strings.** Every label, button, message, placeholder, `aria-label`, and error goes through the translation layer, with both English and Polish provided (see section 7a).

## 3. Tech Stack

| Concern | Choice |
|---------|--------|
| Language | TypeScript (strict mode) |
| Framework | React (function components + hooks) |
| Build tool | Vite |
| State | React state + `useReducer` (or Zustand if the reducer gets unwieldy). No Redux. |
| Validation | `zod` for import validation and data schema |
| Pan/zoom | `d3-zoom` (or pointer events if simpler). Do not import all of D3. |
| Tree layout | Evaluate a small layout library (such as `relatives-tree`) before writing a custom layout. Keep the layout code isolated so it can be swapped. |
| Styling | Plain CSS with CSS variables from `DESIGN.md` (CSS modules are fine). No UI framework, no Tailwind unless asked. |
| i18n | `i18next` + `react-i18next`, with EN and PL resources bundled into the app (no runtime fetching) |
| Persistence | `localStorage` or IndexedDB autosave of the current tree |
| Offline/install | PWA via `vite-plugin-pwa` (manifest + service worker) |
| Tests | Vitest + React Testing Library |
| Lint/format | ESLint + Prettier |
| Hosting | GitHub Pages via GitHub Actions |

## 4. Hosting and Deployment (GitHub Pages)

- The site is served from `https://<username>.github.io/<repo-name>/`, so Vite must set `base: '/<repo-name>/'` in `vite.config.ts`. Never hardcode absolute paths like `/assets/...`; use relative or `import.meta.env.BASE_URL`.
- GitHub Pages has no server-side routing fallback. **Use hash-based routing** (`/#/...`) or avoid routes entirely. Deep-link refreshes must not produce a 404.
- Deploy with a GitHub Actions workflow (`.github/workflows/deploy.yml`):
    - Trigger on push to `main`.
    - Steps: checkout, setup Node (LTS), `npm ci`, `npm run lint`, `npm test`, `npm run build`, upload `dist` with `actions/upload-pages-artifact`, deploy with `actions/deploy-pages`.
    - Repo setting: Pages source = GitHub Actions.
- The PWA manifest `start_url` and `scope` and the service worker scope must match the base path.

## 5. Data Model

The JSON file is the database. Keep it flat, normalized, and versioned.

```ts
type PersonId = string;
type UnionId = string;

interface Person {
  id: PersonId;
  name: string;            // required, display name
  born?: string;           // free-form or partial date: "1948", "1948-05", "1948-05-12"
  died?: string;           // same format as born
  notes?: string;          // short free text
}

interface Union {          // a couple / partnership
  id: UnionId;
  partners: [PersonId, PersonId?];   // second partner optional (single parent)
}

interface ChildLink {
  union: UnionId;
  child: PersonId;
}

interface FamilyTreeFile {
  version: 1;              // bump on breaking schema changes, add migrations
  people: Record<PersonId, Person>;
  unions: Union[];
  children: ChildLink[];
}
```

Rules:
- IDs are generated in the browser (`crypto.randomUUID()`), never derived from names.
- A person can belong to multiple unions (remarriage) and be a child in at most one union.
- Deleting a person removes their union memberships and child links. If it would leave an orphaned branch, ask for confirmation first and explain what will be removed.
- Prevent invalid structures: self-parenting, cycles in ancestry, and duplicate links.
- Do **not** embed photos or base64 blobs in v1. Keep files small and human-readable.
- Always include `version`. When the schema changes, add a migration function from the previous version.

## 6. Core Features (v1 scope)

In scope:
1. **Import** a `.json` file (file picker and drag-and-drop on desktop). Validate with zod. On failure, show a clear, friendly error and keep the current tree untouched.
2. **Export** the current tree as a downloaded `.json` file (`Blob` plus `<a download>`). Filename like `family-tree-YYYY-MM-DD.json`.
3. **View** the tree on a pannable, zoomable canvas with person cards and connector lines.
4. **Select** a person to open the detail view (bottom sheet on mobile, side panel on desktop).
5. **Add** a person (as parent, partner, child, or sibling of the selected person) and a standalone first person for an empty tree.
6. **Edit** a person's fields.
7. **Delete** a person (with confirmation as described above).
8. **Undo/redo** for edits.
9. **Autosave** to browser storage so a refresh does not lose work, plus a "last exported" hint and a gentle reminder to export after several edits.
10. **Start empty or load sample:** a "Try with sample data" action that loads fake data bundled with the app.
11. **PWA:** installable and works offline after the first load.
12. **Language switcher:** English and Polish, with automatic first-visit detection and a persistent manual choice (see section 7a).

Out of scope for v1 (do not build unless asked): accounts, cloud sync, collaboration, photo upload, GEDCOM import/export, printing/PDF, search across huge trees, languages other than English and Polish, dark mode.

## 7. Import/Export Requirements

- **Use only universally supported APIs as the main path:** `<input type="file">`, `FileReader` or `file.text()`, `Blob`, `URL.createObjectURL`, `<a download>`. These work in Chrome, Safari (including iOS), Firefox, and Edge.
- The File System Access API may be added only as an optional enhancement. It must never be required.
- Validation errors should say what is wrong in plain language (for example "This file is missing the 'people' section"), not dump raw zod output.
- Never silently overwrite the current tree on import. If the tree has unsaved or unexported changes, confirm first.
- Revoke object URLs after export to avoid leaks.
- Unknown extra fields in an imported file should be preserved where practical, and never crash the import.

## 7a. Languages (English and Polish)

- **Supported languages:** English (`en`) and Polish (`pl`). Adding a third language later should only require a new resource file, so keep all strings in resources and never in components.
- **Library:** `i18next` + `react-i18next`, with both resource files bundled into the app. Do not fetch translations over the network, because the app must work offline.
- **Detection:** on first visit, use `navigator.language`: Polish if it starts with `pl`, otherwise English. After the user picks a language manually, store the choice in `localStorage` and always prefer it.
- **Switcher:** a simple EN / PL toggle in the top bar (and visible on the empty state). Switching takes effect immediately without a reload.
- **Document language:** keep `<html lang>` in sync with the active language, and set the PWA manifest `lang` appropriately.
- **Plurals:** Polish has multiple plural forms (one, few, many, other). Use i18next plural keys (`_one`, `_few`, `_many`, `_other`) for any counted text, such as "3 children" or "5 people", and never concatenate strings by hand.
- **Interpolation, not concatenation:** use `t('deleteConfirm', { name })`, because Polish word order and inflection differ from English.
- **Neutral wording:** avoid gendered relationship terms in the UI where possible (use "parent" / "rodzic", "partner" / "partner", "child" / "dziecko"). Do not attempt grammatical declension of people's names.
- **Text expansion:** Polish text is often 20-30% longer than English. Layouts (buttons, person cards, panels) must wrap or grow rather than truncate, and must be checked in both languages at 360px width.
- **Characters:** all text, including names, must support Polish diacritics (ą ć ę ł ń ó ś ź ż). Import and export JSON as UTF-8, and never escape characters into `\uXXXX` on export. The bundled font must include the Latin Extended subset.
- **Formatting and sorting:** format dates and numbers with `Intl` using the active locale, and sort names with `localeCompare(…, locale)` so Polish letters sort correctly.
- **Data stays language-neutral:** the JSON file format contains no translated strings. Field names are English identifiers in every language, and the same file must open identically in either language.
- **Validation errors and confirmations** (import problems, delete warnings) are translated too. Translate the human-friendly message, not the raw zod output.
- **Sample data:** the fictional sample tree can use Polish-sounding fake names for both languages, but any notes or labels in it must not depend on a language.

## 8. UX and Responsive Requirements

- **Mobile-first.** Test layouts at 360px width and up to large desktop.
- All touch targets at least 44x44px.
- Pinch-to-zoom and drag-to-pan on touch; scroll/ctrl+wheel zoom and drag on desktop; zoom buttons as a fallback on both.
- Use `100dvh` for full-height layouts and respect safe-area insets.
- Hover-only effects must be wrapped in `@media (hover: hover)`.
- Keyboard accessible: focusable person cards, visible focus ring (from `DESIGN.md`), Escape closes panels.
- Basic accessibility: semantic HTML, labels on inputs, `aria-label` on icon-only buttons, sufficient contrast (the design palette already complies; do not lower it).
- Copy is warm, short, and plain. Avoid jargon.
- Empty state: friendly message with two actions ("Import a file" and "Start a new tree").

## 9. Project Structure

```
/
├─ AGENTS.md
├─ DESIGN.md
├─ README.md
├─ index.html
├─ vite.config.ts
├─ package.json
├─ .github/workflows/deploy.yml
├─ public/                  # icons, manifest assets (no user data)
└─ src/
   ├─ main.tsx
   ├─ App.tsx
   ├─ styles/               # tokens.css (variables from DESIGN.md), global.css
   ├─ model/                # types, zod schema, migrations, pure tree operations
   ├─ state/                # reducer, undo/redo, autosave
   ├─ i18n/                 # i18n setup, locales/en.json, locales/pl.json, language detection
   ├─ io/                   # import/export helpers, file validation
   ├─ layout/               # tree layout (isolated, swappable)
   ├─ components/           # PersonCard, TreeCanvas, DetailPanel, ZoomControls, ...
   └─ sample/               # fake sample data only
```

Principles:
- Keep `model/` pure TypeScript with **no React imports**. All add/delete/edit logic lives here and is unit-tested.
- Components stay small and presentational; business rules do not live in components.

## 10. Repository Hygiene and Privacy Safeguards

- Add to `.gitignore`: `*.family.json`, `my-tree*.json`, `exports/`, `.env*`, and any local test data folders. Real data files should never be committable by accident.
- Only fake data in `src/sample/` and in tests. Mark sample files clearly (for example a `"_note": "Fictional sample data"` field).
- Do not commit screenshots containing real names.
- No secrets exist in this project. If something looks like one, remove it.
- `README.md` must state: "Your data stays in your browser. Nothing is uploaded. Export your file regularly, because browser storage can be cleared."

## 11. Testing Requirements

- Unit tests (Vitest) for everything in `model/`: add person, add relative, delete with cascade, cycle prevention, migrations.
- Import tests: valid file, missing fields, wrong types, wrong version, huge file, empty file, non-JSON file.
- Round-trip test: import → export → import produces an identical tree, including names with Polish diacritics.
- Translation tests: `en` and `pl` resources have exactly the same keys, no value is empty, and every plural key has all the forms each language needs (English: one/other; Polish: one/few/many/other).
- Language tests: detection from `navigator.language`, persistence of the manual choice, and `<html lang>` updating on switch.
- Component tests for the import/export flow and delete confirmation.
- Before finishing any task, run `npm run lint`, `npm test`, and `npm run build`. Do not leave the build broken.

## 12. Performance Targets

- Smooth pan/zoom with 500 people on a mid-range phone. If it struggles, render only visible nodes or simplify connectors before adding libraries.
- Initial JS bundle small (aim for under about 200 KB gzipped). Check bundle size when adding dependencies.
- No layout thrash: compute layout in a memoized pure function, not on every render.

## 13. Suggested Build Order

1. Scaffold Vite + React + TypeScript, ESLint/Prettier, Vitest, CSS tokens from `DESIGN.md`, and the i18n setup with EN/PL resources from day one (retrofitting translations later is painful).
2. Deploy an empty page to GitHub Pages via Actions (verifies base path early).
3. Implement `model/` (types, zod schema, operations, migrations) with tests.
4. Implement import/export and autosave.
5. Render the tree (layout + person cards + connectors) with sample data.
6. Add pan/zoom and selection.
7. Add detail panel and add/edit/delete flows with undo/redo.
8. Polish responsive behavior, accessibility, empty state.
9. Add PWA support and verify offline behavior on a real phone.
10. Write the README.

## 14. Definition of Done (per task)

- Meets the requirements above and matches `DESIGN.md`.
- Works at mobile and desktop widths, in both English and Polish.
- Every new user-facing string exists in both `en` and `pl` resources.
- Tests added or updated; lint, tests, and build pass.
- No real or sensitive data added anywhere in the repo.
- No unnecessary new dependencies.
- Change is small and focused, with a clear commit message.

## 15. When Unsure

- Choose the simpler option.
- Do not expand scope. If a feature is not listed in section 6, ask before building it.
- Never add network requests that send user data anywhere.