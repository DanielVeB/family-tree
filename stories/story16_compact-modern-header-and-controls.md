# Story 016: Compact modern header and bottom-left orientation controls

| | |
|---|---|
| **ID** | 016 |
| **Type** | Change story |
| **Priority** | Not specified |
| **Size** | Not specified |
| **Depends on** | Story 014 (orientation switch) |
| **References** | `AGENTS.md`, `DESIGN.md` |

## 1. User Story

**As a** mobile and desktop user,  
**I want** a slimmer, cleaner header and orientation controls grouped with zoom controls,  
**so that** I get more tree space and a more modern, consistent UI.

## 2. Scope

### In scope
1. Reduce header vertical footprint, with special focus on mobile.
2. Move the **Vertical / Horizontal** orientation control from the header into the bottom-left zoom-controls panel.
3. Refresh header styling to a modern slim top bar that follows the existing design system tokens and component rules.

### Out of scope
- New orientation modes or orientation behavior changes.
- Changes to tree data, import/export, autosave, undo/redo, or layout algorithms.
- New navigation patterns, new menus, or additional floating toolbars.

## 3. Behavior Rules

### 3.1 Header compactness and layout

- The top bar uses a single compact row in both languages, with no second control row on mobile.
- At 360px width, the header must stay visually slim and leave more canvas visible than before this change.
- The header follows `DESIGN.md` navigation guidance: cream background, subtle bottom border, no heavy card-like treatment, no added shadows or gradients.
- Controls that are not essential for top-bar identity are moved out of the header rather than wrapped into extra lines.

### 3.2 Orientation control placement

- The orientation switch is placed in the same bottom-left controls area as zoom in/out.
- Zoom and orientation remain separate actions but are presented as one coherent control cluster.
- Orientation is available on both mobile and desktop from that bottom-left cluster.
- Existing orientation behavior from Story 014 remains unchanged (defaulting, persistence, and switching logic).

### 3.3 Accessibility and interaction

- All controls in the bottom-left cluster remain keyboard reachable and have visible focus styling from `DESIGN.md`.
- Touch targets stay at least 44x44px.
- The control cluster must not block key content more than necessary; it should remain anchored and predictable while panning/zooming.
- Any icon-only action keeps translated `aria-label` values in English and Polish.

### 3.4 Ultra-compact header mode

- Below 360px width, header text buttons switch to icon-only variants to protect the single-row layout.
- Icon-only header actions keep the same behavior as text buttons and preserve translated accessible names via `aria-label`.
- The icon-only mode applies only to header action buttons; it does not change tree behavior, import/export logic, or orientation logic.

## 4. Language

Keep all user-facing labels and accessible names in both English and Polish. If visible text for orientation controls changes (for example shorter labels), update both locales with equivalent meaning and keep wording concise for mobile.

## 5. Acceptance Criteria

- [ ] **AC1.** At 360px width, the header renders as one compact row and visibly occupies less vertical space than the previous header layout.
- [ ] **AC2.** The orientation control is no longer in the header and appears in the bottom-left zoom-controls panel on mobile and desktop.
- [ ] **AC3.** A user can still switch between vertical and horizontal views from the bottom-left controls, with Story 014 behavior unchanged.
- [ ] **AC4.** Header styling matches the existing design system for a slim modern top bar (cream background, border divider, restrained typography, no new decorative effects).
- [ ] **AC5.** The bottom-left control cluster remains keyboard accessible, has visible focus, and preserves 44x44 minimum touch targets.
- [ ] **AC6.** English and Polish labels/accessible names are complete and usable at 360px without clipped or overlapping control text.
- [ ] **AC7.** Automated tests cover control relocation and unchanged orientation behavior; `npm run lint`, `npm test`, and `npm run build` pass.
- [ ] **AC8.** Below 360px width, header action buttons render as icon-only controls while remaining accessible with translated `aria-label` values.

## 6. Product Owner Verification

1. Open the app at 360px width and confirm the header is a slim single row with more canvas visible than before.
2. Confirm the Vertical/Horizontal control is removed from the header and available with zoom controls in the bottom-left area.
3. Switch orientation several times and refresh. Confirm switching and saved preference behavior still matches Story 014.
4. Test keyboard navigation and focus states for zoom and orientation controls.
5. Switch to Polish and confirm labels and control layout remain clear and usable on mobile.
6. Resize below 360px and confirm header action buttons switch to icon-only while still being operable and screen-reader friendly.
