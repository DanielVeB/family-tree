# Story 001: App skeleton, design foundation, and GitHub Pages deployment

| | |
|---|---|
| **ID** | 001 |
| **Type** | Foundation story |
| **Priority** | Must have (blocks all other stories) |
| **Size** | Small |
| **Depends on** | None |
| **References** | `AGENTS.md` (requirements), `DESIGN.md` (styling) |

## 1. User Story

**As a** product owner,
**I want** an empty but fully styled app, automatically deployed to GitHub Pages,
**so that** every future story builds on a working, live, correctly styled foundation and I can open the real site on my phone from day one.

## 2. Context and Intent

This story deliberately has **no family tree functionality**. Its purpose is to prove the whole delivery pipeline end to end (code → build → live URL) and to lock in the visual foundation. Problems with the GitHub Pages base path, fonts, mobile viewport, or language setup are cheapest to find now, while the app is empty.

## 3. Scope

### In scope
1. A React + TypeScript + Vite project, set up as defined in `AGENTS.md` section 3.
2. Design tokens from `DESIGN.md` implemented as CSS variables.
3. A minimal responsive page: top bar plus a friendly empty state.
4. Basic i18n setup with English and Polish, and a language toggle (kept minimal).
5. Linting, formatting, and a minimal test setup, all passing.
6. A GitHub Actions workflow that builds and deploys to GitHub Pages on push to `main`.
7. A `README.md` with the privacy statement and basic run instructions.

### Out of scope (do not build)
- Any family tree features: import, export, tree rendering, people, editing, autosave.
- PWA / service worker / offline support (separate story).
- Routing (the app is a single view for now).
- Data model, zod schema, and sample data.
- Custom domain.

## 4. Screen Description

A single page on the cream background (`#f7f4ed`):

**Top bar**
- Left: app name as wordmark text, "Family Tree" (EN) / "Drzewo rodzinne" (PL), in weight 600.
- Right: language toggle "EN | PL" showing the active language.
- Bottom border: `1px solid #eceae4`. Respects safe-area inset at the top on phones.

**Empty state** (centered, with generous vertical spacing)
- Heading (page title style, 36px mobile / 48px desktop, weight 600, tight letter-spacing):
    - EN: "Your family story starts here"
    - PL: "Tu zaczyna się historia Twojej rodziny"
- Body text (18px, muted color):
    - EN: "Import a file or start a new tree. Your data stays in your browser."
    - PL: "Zaimportuj plik lub zacznij nowe drzewo. Twoje dane zostają w Twojej przeglądarce."
- Two buttons, shown but **disabled** (opacity 0.5, `cursor: not-allowed`, `aria-disabled="true"`, no action):
    - Primary: "Start a new tree" / "Zacznij nowe drzewo"
    - Ghost: "Import a file" / "Importuj plik"
    - They exist to show the correct button styles in the real app. They get wired up in later stories.
- Buttons stack vertically on mobile (full width, max 320px) and sit side by side on desktop.

No images, gradients, animations, or illustrations.

## 5. Acceptance Criteria

### Project setup
- [ ] **AC1.** The project is created with Vite, React, and TypeScript in strict mode, using the folder structure from `AGENTS.md` section 9 (only folders that are needed so far; do not create empty placeholder code).
- [ ] **AC2.** `package.json` includes scripts: `dev`, `build`, `preview`, `lint`, `test`, `format`.
- [ ] **AC3.** `npm run lint`, `npm test`, and `npm run build` all pass locally with no errors or warnings.
- [ ] **AC4.** `AGENTS.md` and `DESIGN.md` are committed in the repo root.

### Design foundation
- [ ] **AC5.** All color, shadow, and radius tokens from `DESIGN.md` section 2 exist as CSS variables in `src/styles/tokens.css`, and no component uses a hardcoded color value.
- [ ] **AC6.** The page background is cream `#f7f4ed`, text is charcoal `#1c1c1c` or muted `#5f5f5d`. There is no pure white and no pure black anywhere.
- [ ] **AC7.** The typeface is Inter, **bundled with the app** (no Google Fonts or CDN requests), including the Latin Extended subset so Polish characters render in the same font. Weights used: 400 and 600 only. Fallback: `ui-sans-serif, system-ui, sans-serif`.
- [ ] **AC8.** Typography follows the `DESIGN.md` scale for page title, body, and button text, including negative letter-spacing on headings.
- [ ] **AC9.** Buttons follow `DESIGN.md`: the primary button is charcoal with the inset shadow and 6px radius, and the ghost button has the strong border and 6px radius. Disabled state is opacity 0.5.
- [ ] **AC10.** Keyboard focus shows the blue ring from `DESIGN.md` on every focusable element (the language toggle at minimum).

### Responsive behavior
- [ ] **AC11.** The layout works with no horizontal scroll at 360px, 768px, and 1280px widths.
- [ ] **AC12.** The viewport meta tag includes `viewport-fit=cover`, the top bar respects `env(safe-area-inset-top)`, and full-height layout uses `100dvh`.
- [ ] **AC13.** All interactive elements have a touch target of at least 44x44px.

### Languages
- [ ] **AC14.** `i18next` + `react-i18next` are set up with `en` and `pl` resource files in `src/i18n/locales/`, bundled (no network loading).
- [ ] **AC15.** On first visit, the language is Polish if `navigator.language` starts with `pl`, otherwise English.
- [ ] **AC16.** The language toggle switches languages immediately without a page reload, saves the choice in `localStorage`, and the saved choice wins on later visits.
- [ ] **AC17.** `<html lang>` always matches the active language.
- [ ] **AC18.** No user-facing string is hardcoded in components. This includes the page `<title>` and the toggle's `aria-label`.
- [ ] **AC19.** A test verifies that `en` and `pl` resource files have identical keys and no empty values.
- [ ] **AC20.** Polish text (including diacritics such as ą, ę, ł, ś, ż) renders correctly and does not overflow or get cut off at 360px width.

### Deployment
- [ ] **AC21.** `vite.config.ts` sets `base` to `/<repo-name>/` (see section 7), and no asset path in the built `index.html` points outside that base.
- [ ] **AC22.** `.github/workflows/deploy.yml` runs on push to `main` and executes: checkout, Node LTS setup, `npm ci`, `npm run lint`, `npm test`, `npm run build`, upload of `dist`, and deploy with the official GitHub Pages actions.
- [ ] **AC23.** If lint, tests, or the build fail, nothing is deployed.
- [ ] **AC24.** After merge to `main`, the site is live at `https://<username>.github.io/<repo-name>/` and shows the screen described in section 4, with no 404s or console errors.
- [ ] **AC25.** The live site works on a real phone (iOS Safari or Android Chrome) and on desktop Chrome, Firefox, and Safari or Edge.

### Privacy and hygiene
- [ ] **AC26.** The built app makes **no network requests** other than loading its own static files (no analytics, no external fonts, no third-party scripts).
- [ ] **AC27.** `.gitignore` includes `node_modules`, `dist`, `.env*`, `*.family.json`, `my-tree*.json`, and `exports/`.
- [ ] **AC28.** `README.md` contains: what the app is, how to run it (`npm install`, `npm run dev`), how to test and build it, the live URL, and the sentence: "Your data stays in your browser. Nothing is uploaded. Export your file regularly, because browser storage can be cleared." (in English; a Polish version of this sentence is also included).

## 6. Manual One-Time Setup (done by the product owner)

These cannot be done by code, so they are part of the story's completion:

1. Create a **public** GitHub repository (GitHub Pages for private repos needs a paid plan).
2. Push the code to `main`.
3. In the repo, open **Settings → Pages** and set **Source** to **GitHub Actions**.
4. Wait for the first workflow run to finish, then open the live URL.

## 7. Technical Notes for the Developer or AI Agent

- **Base path:** `base` must equal the repository name, with slashes on both sides, for example `/family-tree/`. Use `import.meta.env.BASE_URL` when referencing any file in `public/`. A blank page with 404s for the JS file almost always means the base path is wrong.
- **Fonts:** use `@fontsource-variable/inter` (or equivalent) and import only the Latin and Latin Extended subsets and the weights actually used. This is the one permitted extra dependency for design reasons.
- **Scaffolding:** `npm create vite@latest` with the `react-ts` template is the starting point. Remove demo content (logos, counter, default CSS).
- **No UI libraries.** Plain CSS (or CSS modules) with the tokens.
- **Language toggle:** keep it a simple two-option control. Do not build a dropdown.
- **Keep it small:** this story should result in a small codebase. If you are tempted to add something not listed above, don't.

## 8. Definition of Done

- All acceptance criteria above are checked.
- Code merged to `main`, and the GitHub Actions run is green.
- The live URL works and was checked on a real phone and a desktop browser, in both languages.
- Lighthouse (mobile) on the live URL shows Accessibility 95 or higher and no best-practices warnings caused by the app.
- No real or sensitive data exists anywhere in the repo.
- `README.md` is up to date.

## 9. How the Product Owner Will Verify

1. Open the live URL on a phone. Confirm the cream background, wordmark, centered empty state, and no horizontal scroll.
2. Tap EN/PL. The text switches instantly. Reload. The choice is kept.
3. Open on desktop and resize the window from wide to narrow. The layout adapts smoothly.
4. Tab through the page with the keyboard. The focus ring is visible.
5. Open browser dev tools → Network. Only the site's own files are loaded.
6. Make a trivial text change on `main` and confirm it deploys automatically.

## 10. Notes for Next Stories (not part of this story)

Likely next stories, to be refined later: data model and validation, sample data and tree rendering, import/export, add/edit/delete people, undo/redo and autosave, PWA/offline.