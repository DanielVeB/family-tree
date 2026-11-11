# Story 010: Actions around the selected person (floating buttons instead of the side panel)

| | |
|---|---|
| **ID** | 010 |
| **Type** | Feature story (UI redesign, no data change) |
| **Priority** | Should have |
| **Size** | Medium |
| **Depends on** | Story 002 (selection, detail view), 005 (add relative), 007 (edit, delete), 009 and 009b (level and order controls) |
| **References** | `AGENTS.md`, `DESIGN.md` |

## 1. User Story

**As a** user,
**I want** the actions for a person to appear right next to their card when I select it, each with a clear icon and a tooltip,
**so that** adding relatives, editing, and deleting feel direct and modern, and I do not have to look away from the tree to a side panel.

## 2. Context and Intent

Today, selecting a person opens the detail view (a side panel on desktop, a bottom sheet on phones). It shows the name, the level controls from story 009, four text buttons under "Add relative", and two icon buttons for edit and delete. It works, but it is far from the card, it takes up a lot of space for a few buttons, and the text buttons make the screen look busy.

This story moves the actions **onto the canvas, around the selected card**:

```
                  [ + parent ]          [ edit | delete | move ]
   [ sibling ]  [      CARD      ]  [ partner ]
                  [ + child  ]
```

- **Top:** add a parent. **Bottom:** add a child.
- **Left:** add a sibling. **Right:** add a partner.
- **Edit, delete, and move** sit together in a small toolbar above the card's top-right corner.
- Every button has an icon that is recognizable without reading, and a tooltip.

The side panel and the bottom sheet **stay as the container for forms** (add relative, edit). They just no longer open merely because a person was selected.

The data, the file, the layout, and the rules for what can be added, edited, deleted, and moved **do not change**. This story changes only how those actions are reached.

## 3. Scope

### In scope
1. Floating add buttons (four) around the selected card, with icons and tooltips.
2. A small toolbar with edit, delete, and move buttons, attached to the card.
3. A move popover that contains the level caption and the four move buttons from story 009.
4. Tooltips for mouse, keyboard, and touch.
5. Selection no longer opens the side panel. The panel or sheet opens only for forms.
6. A more modern look within the existing design system.
7. Accessibility, translations, tests, and documentation.

### Out of scope (do not build)
- Any change to the relationship, edit, delete, or move rules (stories 005, 007, 009, 009b).
- New form fields or a new "person details" view. (When there are more details to show later, such as dates or notes, a details view can return. Not now.)
- Multi-select, a right-click menu, or keyboard shortcuts beyond those that already exist.
- Dragging from the buttons, or "add" by dropping a line onto the canvas.
- Animations other than a short fade.

## 4. Behavior Rules

### 4.1 When the actions are shown
- Selecting a person (tap, click, or Enter and Space on a focused card) shows the four add buttons and the toolbar around that card. Selecting also keeps the existing selection ring and line highlighting (story 006, 6.5).
- **Nothing else opens.** The side panel and the bottom sheet do **not** open on selection.
- The actions are hidden while:
    - a form is open (add relative or edit) or a dialog is open (delete confirmation, replace tree, and so on),
    - the card is being dragged (they return after the drop, at the new position),
    - nothing is selected.
- **Deselect** by tapping or clicking empty canvas, or by pressing Escape (when no dialog, form, popover, or tooltip is open). The old close button of the detail view is gone.
- Selecting another person moves the actions to that person. Only one person has actions at a time.

### 4.2 The four add buttons
Positions are relative to the selected card, with an **8px gap** between the card edge and the button:

| Button | Position | Action | Opens |
|---|---|---|---|
| **Add parent** | Centered above the card | Same as "Add parent" in the old panel | The add-relative form (story 005), relation preset to parent |
| **Add child** | Centered below the card | Same as "Add child" | The form, relation child |
| **Add sibling** | Centered on the left side | Same as "Add sibling" | The form, relation sibling |
| **Add partner** | Centered on the right side | Same as "Add partner" | The form, relation partner |

- The side a button is on does **not** decide where the new person appears. Placement follows the rules in story 009 (4.4).
- **Availability is unchanged.** If an action is unavailable today (for example, a person who already has two parents cannot get a third), the button is shown **disabled**: opacity 0.5, `aria-disabled="true"`, no action, and the tooltip shows the existing reason text from story 005. Never hide a button.
- The buttons are the **same size** and use the icon pill style with the signature inset shadow (they are the main floating actions, see `DESIGN.md` section 4).

### 4.3 The toolbar: edit, delete, move
- One pill-shaped group (radius 9999px) with three icon buttons, left to right: **Edit**, **Delete**, **Move**.
- Position: **above the card's top-right corner**. Its bottom edge is 8px above the card's top edge, and its left edge is 8px **inside** the card's right edge. This keeps it clear of the add-parent button for both card widths (160px and 200px).
- **Edit** opens the edit form (story 007), as the old edit button did.
- **Delete** opens the delete confirmation (story 007), as the old delete button did. It is not red and not different in style (no saturated colors). The confirmation dialog protects the user.
- **Move** toggles the move popover (4.4). It has `aria-expanded` and `aria-haspopup`.

### 4.4 The move popover
- A small panel (panel style, 16px radius) opened by the Move button. It contains the caption "Level {{level}}" and the **four move buttons from story 009** (up, down, left, right), with exactly the same behavior, disabled states, and tooltips as in stories 009 and 009b.
- Placement: directly **above** the toolbar, aligned to its right edge. If there is no room above in the visible canvas, it opens **below** the toolbar instead.
- It stays open while the user moves the person several times, and follows the card. It closes on Escape, on tapping outside, when the selection changes, when a form or dialog opens, or when Move is pressed again. Focus returns to the Move button.
- The Alt + Arrow keyboard shortcuts from story 009 keep working on a focused card, with or without the popover.

### 4.5 Forms and the side panel
- Pressing an add button or Edit opens the **existing** form in the side panel (desktop and tablet) or bottom sheet (phone), exactly as the old buttons did. Form content, saving, cancelling, and validation are unchanged.
- While a form is open, the floating actions are hidden. After saving or cancelling, they appear again on the selected person (which one is selected after a save follows the existing behavior).
- The panel and sheet no longer show the name header, the level caption, the move buttons, the "Add relative" group, or the edit and delete buttons. Remove that content and its strings.

### 4.6 Tooltips
- Every action button has a tooltip with its name (section 7). Disabled buttons show the reason instead.
- **Mouse:** appears after the pointer rests on the button for about 400ms, and disappears when the pointer leaves.
- **Keyboard:** appears when the button receives keyboard focus (focus-visible) and disappears on blur.
- **Touch:** appears when the button is **touched and held** for about 400ms. Releasing after a long press shows the tooltip for about 2 seconds and **does not trigger the action**. A normal tap triggers the action and shows no tooltip.
- Escape hides a visible tooltip (without deselecting the person).
- Only one tooltip is visible at a time. The tooltip is placed on the **outer side** of its button: above for the top button, below for the bottom one, to the left for the left one, to the right for the right one, above for the toolbar buttons. If it does not fit in the visible canvas, it flips to the opposite side.
- Style: panel colors (`--cream` background, `1px solid --border`), 6px radius, caption text (14px, `--oak`), padding 6px 10px, **no shadow**, maximum width 240px with wrapping. The button references the tooltip with `aria-describedby`, and the tooltip has `role="tooltip"`.
- The tooltip text is never the only way to know the button's purpose: every button also has an accessible name (4.8).

### 4.7 Position, zoom, pan, and edges
- The buttons are positioned from the card's **on-screen rectangle**, so they follow the card when the user pans, zooms, or when the layout changes. They keep their **size** when the user zooms (they do not scale).
- They are drawn **above** all cards and lines, and below dialogs, the panel, and the sheet. They may cover part of a neighboring card. This is accepted.
- **Keep everything reachable.** When a person is selected, and the card with all its buttons and the toolbar is not completely inside the visible canvas (the area under the top bar and not covered by the panel or sheet), the view pans by the smallest amount needed to show them. Zoom is not changed. If everything cannot fit, the card itself has priority.
- While the user is dragging the canvas to pan, or pinching to zoom, the buttons stay attached (no lag). They are not hidden.

### 4.8 Keyboard and accessibility
- All buttons are real `<button>` elements. They are placed in the DOM **right after the selected card**, in this tab order: add parent, add sibling, add partner, add child, edit, delete, move.
- The group has `role="toolbar"` and the label "Actions for {{name}}".
- Each button has an accessible name equal to its tooltip text. Disabled buttons use `aria-disabled` and stay focusable, so their reason can be read.
- Focus shows the bronze ring (`--ring`, 2px) on every button. Pressing Escape from a button hides the tooltip first, then the popover, then deselects.
- After a form or dialog closes, focus returns to the button that opened it (or to the selected card, if that button is hidden again).
- All hit areas are at least **44x44px** (see section 5).
- The appearance fade is skipped when the user prefers reduced motion.

## 5. Visual Specification

All values come from `DESIGN.md`. No new colors, no new button styles.

| Element | Specification |
|---|---|
| **Add buttons** | Icon pill, **36px** visible circle, **44x44px** hit area (the extra 4px on each side is transparent but clickable). Background `--cream`, `1px solid --border`, `--shadow-inset`. Icon 20px, stroke 1.5px, round caps and joins, color `--oak` |
| **Toolbar** | Pill group (radius 9999px), background `--cream`, `1px solid --border`, padding 4px. Three 36px circular buttons, 4px apart, 44px hit areas that may overlap the group padding. No inset shadow (secondary actions). Icons as above |
| **Hover** (only with `@media (hover: hover)`) | Background `--tint-hover` |
| **Pressed** | Opacity 0.8 |
| **Keyboard focus** | 2px `--ring` outline |
| **Disabled** | Opacity 0.5, `cursor: not-allowed` |
| **Gap to card** | 8px |
| **Appearance** | Fade in, 150ms, together. No slide, no scale, no bounce |
| **Move popover** | Panel style (`--cream`, `1px solid --border`, 16px radius, padding 12px, no shadow). Caption "Level {{level}}" (14px, `--muted`) above a row of four 36px pills |
| **Tooltip** | As in 4.6 |

**Documented exception to `DESIGN.md`.** The visible circle is 36px (not 44px) so that four buttons and a toolbar fit around a 160px card without hiding its neighbors. The **tappable** area is still 44x44px, which is what the touch-target rule protects.

**Look.** The result should feel light and modern: small round buttons on the same warm cream, thin borders, no text on the canvas, no panels in the way. Nothing may use gradients, shadows other than the inset shadow, or saturated color.

## 6. Icon Brief

Icons are inline SVG React components in `src/components/icons/` (no icon library, no new dependency), in the same line style as the existing arrow, pencil, trash, and close icons: 24px design grid, 1.5px stroke, round caps and joins, `currentColor`, no fills except the heart.

The four add icons must be **distinguishable at 20px, in monochrome, without a tooltip**. They share one visual idea, "a relative to add", and differ by one clear feature each:

| Button | Icon | Must read as | Must not look like |
|---|---|---|---|
| **Add parent** | One person glyph (head and shoulders) with a short **upward arrow** above it, and a small **plus** badge at the bottom-right | "someone above me" | The child icon (same glyph, arrow the other way, so the person must be the same size and the arrows clearly opposite) |
| **Add child** | One person glyph, slightly smaller, with a short **downward arrow** below it, and the same plus badge | "someone below me" | The parent icon |
| **Add sibling** | **Two equal person glyphs side by side**, and the plus badge | "someone next to me, same generation" | The partner icon: no heart, no ring |
| **Add partner** | A **heart** and the plus badge | "my partner" | The sibling icon: no person glyphs |
| **Edit** | Pencil (the existing icon) | | |
| **Delete** | Trash can (the existing icon) | | |
| **Move** | A four-way arrow (arrows pointing up, down, left, and right from a center) | "move this card" | The four move buttons inside the popover, which use single arrows |

The move buttons inside the popover reuse the existing arrow icons.

## 7. Language and Text (English / Polish)

| Key | English | Polish |
|-----|---------|--------|
| nodeActions.groupLabel | Actions for {{name}} | Akcje dla osoby {{name}} |
| nodeActions.addParent | Add parent | Dodaj rodzica |
| nodeActions.addChild | Add child | Dodaj dziecko |
| nodeActions.addSibling | Add sibling | Dodaj rodzeństwo |
| nodeActions.addPartner | Add partner | Dodaj partnera |
| nodeActions.edit | Edit | Edytuj |
| nodeActions.delete | Delete | Usuń |
| nodeActions.move | Move | Przenieś |

Reused: `layers.level`, `layers.up`, `layers.down`, `layers.left`, `layers.right`, `layers.noNeighbor`, `layers.unavailable` (story 009 and 009b), and the existing reason texts for unavailable add actions (story 005). If an existing key already holds an identical text (for example the old "Add parent" button text), **rename and reuse it** instead of duplicating it. **Remove** every key that is no longer used (the "Add relative" heading, the detail view header texts, and the close button label of the detail view). The key-parity test must pass.

## 8. Scenario Catalogue

| ID | Given | When | Then |
|----|-------|------|------|
| **S1** | A tree with several people, nothing selected | Click a card | The ring and the line highlighting appear, the four add buttons and the toolbar fade in around it, and **no panel opens** |
| **S2** | S1 | Click "Add child" | The existing add-relative form opens in the side panel (bottom sheet on a phone) with the relation set to child. The floating buttons are hidden. After saving, the new person is added as before and the buttons return on the selected person |
| **S3** | S2 | Press Cancel | The form closes, the buttons are back, and focus returns to "Add child" |
| **S4** | A person with two parents | Select | "Add parent" is shown disabled. Its tooltip gives the existing reason. Clicking it does nothing |
| **S5** | Desktop | Rest the mouse on "Add partner" | After about 400ms a tooltip "Add partner" appears to the right of the button. Moving away hides it |
| **S6** | Phone | Touch and hold "Add sibling" for 400ms, then release | The tooltip appears for about 2 seconds and **nothing is added**. A normal tap opens the form |
| **S7** | S1 | Pan and zoom the canvas | The buttons stay attached to the card and keep their size, with no lag |
| **S8** | S1 | Start dragging the card | The buttons hide. After the drop, they appear at the card's new position |
| **S9** | A card near the right edge of the canvas | Select | The view pans by the smallest amount so that the card, its buttons, and the toolbar are fully visible. Zoom is unchanged |
| **S10** | S1 | Click "Edit" | The edit form opens in the panel or sheet. "Delete" opens the delete confirmation from story 007 |
| **S11** | S1 | Click "Move" | The popover opens above the toolbar with "Level 2" and the four move buttons. Using them moves the person as in stories 009 and 009b. The popover stays open and follows the card |
| **S12** | S1 | Click empty canvas, or press Escape with nothing else open | The person is deselected and the buttons disappear |
| **S13** | A card with a partner on its right at the normal gap | Select | The right button overlaps the partner card slightly. The button is on top and fully visible. This is accepted |
| **S14** | Keyboard only | Tab to a card, press Enter, then Tab | Focus goes through add parent, add sibling, add partner, add child, edit, delete, move, each with a visible ring and a tooltip |
| **S15** | Polish language | Select a person and hover over each button | All tooltips and accessible names are in Polish and fit without cut-off text |
| **S16** | A phone, 360px wide | Select a person near the middle | All buttons and the toolbar fit on screen, none is cut off, and tap targets are at least 44x44px |
| **S17** | Reduced motion enabled in the system | Select a person | The buttons appear without a fade |

## 9. Acceptance Criteria

### Visibility and behavior
- [ ] **AC1.** Selecting a person shows four add buttons (top: parent, bottom: child, left: sibling, right: partner) and the toolbar (edit, delete, move) around the card, and **does not open** the side panel or the bottom sheet (S1).
- [ ] **AC2.** The floating actions are hidden while a form or dialog is open, during a drag of the card, and when nothing is selected. They return at the right position afterwards (S2, S3, S8).
- [ ] **AC3.** Clicking empty canvas, or Escape when nothing else is open, deselects. The old close button of the detail view no longer exists (S12).
- [ ] **AC4.** Only one person has actions at a time, and selecting another person moves them.

### Actions
- [ ] **AC5.** Each add button opens the same form with the same preset relation as the old text button did, and all add, edit, delete, and move rules from stories 005, 007, 009, and 009b are unchanged (S2, S10).
- [ ] **AC6.** An unavailable add action is shown disabled with the existing reason as its tooltip, and never hidden (S4).
- [ ] **AC7.** Edit opens the edit form, and Delete opens the existing confirmation dialog (S10).
- [ ] **AC8.** The Move button opens the popover with the level caption and the four move buttons, which behave exactly as in stories 009 and 009b (disabled states, tooltips, the Undo toast). The popover placement, closing rules, and focus return follow 4.4 (S11).
- [ ] **AC9.** The side panel and bottom sheet show only forms. The name header, level caption, move buttons, "Add relative" group, edit button, and delete button are removed from them, together with their unused strings and tests.

### Tooltips
- [ ] **AC10.** Every action button has a tooltip: mouse (about 400ms), keyboard focus, and touch long press (which does not trigger the action) (S5, S6).
- [ ] **AC11.** Only one tooltip is visible at a time, it is placed on the outer side of its button, flips when it does not fit, hides on Escape, uses `role="tooltip"` and `aria-describedby`, and follows the style in 4.6.

### Position and view
- [ ] **AC12.** Buttons are positioned as in 4.2 and 4.3 (8px gap, centered, toolbar above the top-right corner with its left edge 8px inside the card's right edge), measured in an automated browser test for both card widths.
- [ ] **AC13.** Buttons follow the card on pan, zoom, drag end, and layout change without lag, keep their size at any zoom, and are drawn above cards and lines but below dialogs, the panel, and the sheet (S7, S13).
- [ ] **AC14.** When the card with its buttons is not fully visible after selection, the view pans by the smallest amount needed and the zoom is not changed (S9).
- [ ] **AC15.** At 360px width, all buttons and the toolbar are fully visible and not cut off for a person in the middle of the screen, in both languages (S16).

### Visual and accessibility
- [ ] **AC16.** The look follows section 5. Colors, borders, radii, and the inset shadow use only the tokens from `DESIGN.md`, there is no hardcoded color value, no other shadow, and no gradient.
- [ ] **AC17.** The visible circle is 36px and the hit area is at least 44x44px for every button (automated test of the computed hit area).
- [ ] **AC18.** Hover styles apply only with `@media (hover: hover)`. Keyboard focus shows the bronze ring on every button.
- [ ] **AC19.** The icons follow the brief in section 6 and are inline SVG components with no new dependency. The product owner confirms that the partner and sibling icons cannot be confused (section 12, step 3).
- [ ] **AC20.** The group has `role="toolbar"` and the label from `nodeActions.groupLabel`. Tab order is: add parent, add sibling, add partner, add child, edit, delete, move. Every button has an accessible name equal to its tooltip. Disabled buttons stay focusable with `aria-disabled` (S14).
- [ ] **AC21.** Escape closes, in order: the tooltip, then the move popover, then deselects. Focus returns to the opening button after a form, dialog, or popover closes.
- [ ] **AC22.** The fade is skipped when `prefers-reduced-motion` is set (S17).

### Language and quality
- [ ] **AC23.** All new strings exist in both `en` and `pl`, none are hardcoded, unused keys are removed, and the key-parity test passes. Switching language while a tooltip or the popover is open updates it immediately (S15).
- [ ] **AC24.** Component tests cover: select a person → four add buttons and the toolbar are visible and no panel is open → click "Add child" → the form opens and the buttons are hidden → cancel → the buttons are back. A second test covers the disabled add-parent button with its reason, and a third covers tooltip behavior with fake timers.
- [ ] **AC25.** The positioning logic is a pure function in `src/layout/` or `src/ui/` (card rectangle, viewport, and measured button sizes in; button rectangles and the needed pan out) with no React imports, and is unit-tested for edges and for flipping (S9, S16).
- [ ] **AC26.** The README (if it describes the UI) and `AGENTS.md` are updated as in section 10.
- [ ] **AC27.** `npm run lint`, `npm test`, and `npm run build` pass, deployment still works, no new dependency is added, no network request is made, and no real or sensitive data is added to the repo.

## 10. Required Updates to Documents

**`AGENTS.md`** (core features and UI):
- Replace the description of the detail view with: "Selecting a person shows action buttons around the card (add parent above, add child below, add sibling left, add partner right, plus a toolbar with edit, delete, and move). The side panel or bottom sheet is used only for forms."
- Add that every icon button has a tooltip (mouse, keyboard focus, touch long press) and an accessible name.

**`DESIGN.md`** (components):
- Add **Tooltip**: `--cream` background, `1px solid --border`, 6px radius, caption text, padding 6px 10px, no shadow.
- Add **Node actions**: icon pills with a 36px visible circle and a 44x44px hit area, the inset shadow on the four add buttons, a pill-shaped toolbar for secondary actions, fade-in only.
- Update "Navigation" and "Panel": the panel or sheet holds forms, not a person summary.

## 11. Technical Notes

- Render the actions in a layer **above** the canvas content, positioned from the card's measured on-screen rectangle, not inside the transformed canvas. That keeps the size constant when zooming. Update the position in the same frame as pan and zoom (for example, from the same transform state, not from a delayed effect).
- Put the new components in `src/components/NodeActions/` (buttons, toolbar, popover) and `src/components/Tooltip/`. The tooltip must not need a library.
- Keep all rules in the model (what can be added, deleted, moved). The buttons only call the existing handlers and read the existing availability and reasons.
- The "pan to reveal" step reuses the canvas pan function from story 002. Do not zoom.
- For touch long press, use pointer events and a timer, and suppress the click after a long press.
- Do not add dependencies.

## 12. Definition of Done

- All acceptance criteria are checked.
- Merged to `main`, GitHub Actions green, live site updated.
- Verified on a real phone (touch and long-press tooltips) and on desktop (mouse and keyboard), in both languages.
- The product owner has approved the icons on both devices.
- `AGENTS.md` and `DESIGN.md` are updated.
- No real or sensitive data in the repo.

## 13. How the Product Owner Will Verify

1. Open the app, select a person. Buttons appear around the card and a small toolbar above its top-right corner. **No side panel opens.**
2. Rest the mouse on each button. A tooltip appears for each. Tab through them with the keyboard. Each shows a ring and a tooltip.
3. **Icon check:** cover the tooltips (or ask someone who has not seen the app) and ask which button adds a partner, which a sibling, which a parent, and which a child. The answers must be obvious.
4. Press each of the four add buttons. The same form as before opens in the panel, with the right relation. Save and cancel work and the buttons come back.
5. Select a person who already has two parents. The "Add parent" button is dimmed and its tooltip explains why.
6. Press Edit. The edit form opens. Press Delete. The confirmation appears.
7. Press Move. The small popover shows the level and four arrows, which move the person as before.
8. Zoom and pan. The buttons stay attached and keep their size. Drag the card. The buttons disappear and return after the drop.
9. Select a card near the edge of the screen. The view pans slightly so that everything is visible.
10. On a phone, tap a card, tap a button, then touch and hold another button. The tooltip appears and nothing happens when you let go.
11. Click empty canvas, and press Escape. The person is deselected.
12. Switch to Polish and check all texts and tooltips.

## 14. Notes for Next Stories (not part of this story)

Likely next: a person details view (dates, notes, photo) that can open from the card, a mini-map for large trees, a context menu on right-click, undo and redo, autosave, and connecting two existing people (which can become one more node action).