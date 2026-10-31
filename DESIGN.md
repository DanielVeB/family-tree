# Design System: Family Tree App (Lovable-inspired)

A warm, paper-like, minimal design for a family tree app that works equally well on mobile and desktop. Borders define structure, not shadows. Everything is calm, readable, and slightly analog, like a family album.

## 1. Visual Theme

- Warm cream page background, never pure white.
- Near-black charcoal text, never pure black.
- All grays are the charcoal color at different opacities, so the palette stays unified.
- Cards are separated by thin warm borders, not shadows.
- One typeface, two weights. Hierarchy comes from size and spacing.
- Generous whitespace. No saturated accent colors.

**Simplicity rules for this app**
- Max 3 button styles (primary, ghost, icon pill).
- Max 2 card styles (person card, panel).
- No gradients, illustrations, or animations beyond simple fades and pan/zoom.

## 2. Color Tokens

Define these as CSS variables and use only these.

```css
:root {
  --cream: #f7f4ed;            /* page + card background */
  --charcoal: #1c1c1c;         /* text, primary button */
  --offwhite: #fcfbf8;         /* text on dark */
  --muted: #5f5f5d;            /* secondary text, captions */
  --border: #eceae4;           /* passive borders, dividers */
  --border-strong: rgba(28, 28, 28, 0.4);  /* interactive borders */
  --tint-hover: rgba(28, 28, 28, 0.04);    /* hover background */
  --tint-faint: rgba(28, 28, 28, 0.03);    /* subtle fills */
  --line: rgba(28, 28, 28, 0.4);           /* tree connector lines */
  --ring: rgba(59, 130, 246, 0.5);         /* keyboard focus + selected person */
  --shadow-focus: rgba(0, 0, 0, 0.1) 0 4px 12px;
  --shadow-inset:
    rgba(255, 255, 255, 0.2) 0 0.5px 0 0 inset,
    rgba(0, 0, 0, 0.2) 0 0 0 0.5px inset,
    rgba(0, 0, 0, 0.05) 0 1px 2px 0;
}
```

| Role | Value |
|------|-------|
| Page background | `--cream` |
| Headings | `--charcoal` |
| Body text | `--muted` or charcoal at 82% |
| Card border | `--border` |
| Button outline | `--border-strong` |
| Tree connector lines | `--line` |
| Selected person | 2px `--ring` outline |

Optional, only if you need to distinguish people visually: use the neutral tint `--tint-faint` for deceased or placeholder (unknown) persons, with dashed `--border-strong`. Avoid color-coding by gender or branch.

## 3. Typography

- **Font:** `Inter` (or any humanist sans), fallback `ui-sans-serif, system-ui, sans-serif`. The original Camera Plain Variable is proprietary, so substitute freely; the style is carried by the tight headings and two weights.
- **Weights:** 400 (everything) and 600 (headings only). Never 700.
- **Headings** use negative letter-spacing and tight line-height. Body stays at normal spacing.

| Role | Mobile | Desktop | Weight | Line height | Letter spacing |
|------|--------|---------|--------|-------------|----------------|
| Page title | 36px | 48px | 600 | 1.10 | -0.9px / -1.2px |
| Section heading | 24px | 36px | 600 | 1.10 | -0.5px / -0.9px |
| Person name (detail view) | 28px | 36px | 600 | 1.10 | -0.9px |
| Card title (person name on node) | 16px | 16px | 600 | 1.25 | normal |
| Body | 16px | 16px | 400 | 1.50 | normal |
| Caption (dates, relation) | 14px | 14px | 400 | 1.50 | normal |
| Button | 16px | 16px | 400 | 1.50 | normal |

Dates on person cards use the caption style in `--muted`, for example `1948 – 2019` or `b. 1990`.

## 4. Components

### Buttons

**Primary (dark)**: for "Add person", "Save".
- Background `--charcoal`, text `--offwhite`
- Padding 8px 16px, radius 6px
- Box-shadow `--shadow-inset` (the signature detail, keep it)
- Active: opacity 0.8. Focus: `--shadow-focus`

**Ghost**: for "Cancel", "Edit", secondary actions.
- Transparent background, text `--charcoal`
- Border `1px solid --border-strong`, radius 6px, padding 8px 16px
- Hover: background `--tint-hover`. Active: opacity 0.8

**Icon pill**: for zoom in/out, recenter, close, floating add.
- Background `--cream`, radius 9999px (pills are only for icon/action buttons)
- Size 44x44px minimum (touch target)
- Border `1px solid --border`, plus `--shadow-inset` if it is the main floating action

### Person Card (tree node)

The core component of the app.
- Background `--cream`, border `1px solid --border`, radius 12px, no box-shadow
- Padding 12px, fixed width about 160px (mobile) and 200px (desktop)
- Layout: small circular avatar (40px, radius 9999px, `--border` outline) on the left or top, name (600) and dates (caption, muted) beside or below
- Hover (desktop): border becomes `--border-strong`
- Selected: 2px `--ring` outline
- Avatar fallback: initials on `--tint-faint` background

### Panel (detail view, forms, dialogs)

- Background `--cream`, border `1px solid --border`, radius 16px
- Padding 24px (16px on mobile)
- No shadow. On mobile it appears as a bottom sheet with 16px top radius, on desktop as a right side panel (width 360px).

### Inputs

- Background `--cream`, text `--charcoal`, placeholder `--muted`
- Border `1px solid --border`, radius 6px, padding 10px 12px, min height 44px
- Focus: `--ring` 2px outline (no sharp black outline)
- Labels above inputs, 14px, charcoal

### Tree Connectors

- 1.5px solid lines in `--line`, square or softly rounded corners (radius up to 8px)
- Partners joined by a short horizontal line; children hang from a vertical line below the couple
- Keep lines the same color everywhere, no dashed variants except for unknown or placeholder persons

### Navigation

- **Desktop:** slim top bar on cream, wordmark left, primary "Add person" button right, 1px `--border` bottom divider.
- **Mobile:** same top bar with title, plus a floating icon pill for "Add person" in the bottom-right corner. Keep any menu to a hamburger with 6px radius.

## 5. Layout

- **Spacing:** 8px base. Use 8, 12, 16, 24, 32, 56, 80.
- **Radius scale:** 6px (buttons, inputs), 12px (person cards), 16px (panels), 9999px (icon pills).
- **Main screen:** the tree canvas fills the viewport under the top bar. It is pannable (drag) and zoomable (pinch on mobile, scroll or buttons on desktop). Zoom controls are a vertical stack of icon pills at the bottom-left.
- **Canvas background:** `--cream`, optionally with a very faint dot grid in `--tint-hover`.
- **Content pages** (settings, list view, login): single centered column, max width 640px, with 56px to 80px vertical section spacing on desktop and 32px on mobile.
- **Max app width** for non-canvas content: about 1200px, centered.

## 6. Depth

| Level | Treatment | Use |
|-------|-----------|-----|
| 0 Flat | Cream background, no border | Page, canvas |
| 1 Bordered | `1px solid --border` | Person cards, panels, inputs |
| 2 Inset | `--shadow-inset` | Primary buttons, floating add |
| 3 Focus | `--shadow-focus` | Focused or active controls |
| Ring | 2px `--ring` | Keyboard focus, selected person |

No drop-shadows on cards. If something needs to stand out from the canvas (a bottom sheet), rely on the border and spacing.

## 7. Responsive Behavior

Keep to two main modes plus a tablet step.

| Width | Behavior |
|-------|----------|
| < 640px (mobile) | Full-screen canvas. Detail view is a bottom sheet. Floating add pill. Narrower person cards. Heading sizes at mobile scale. |
| 640–1024px (tablet) | Same as mobile, but detail view can be a side panel. Slightly larger cards. |
| > 1024px (desktop) | Canvas plus right side panel (360px). Top bar with visible buttons. Hover states active. |

Rules:
- All tap targets at least 44x44px.
- Use `100dvh` for full-height layouts so mobile browser bars do not break the canvas.
- Respect safe-area insets on notched phones (`env(safe-area-inset-*)`).
- Hover styles only on devices that support hover (`@media (hover: hover)`).
- The tree must remain usable with one hand: primary actions sit in the lower half of the screen on mobile.

## 8. Do's and Don'ts

### Do
- Use `--cream` as the foundation everywhere.
- Derive grays from charcoal at opacity levels.
- Use borders for containment, not shadows.
- Keep two weights: 400 and 600.
- Use negative letter-spacing on headings only.
- Use the inset shadow on primary dark buttons.
- Use soft shadow-based focus states and the blue ring for keyboard focus.
- Keep copy warm and plain ("Add a parent", "Add a child").

### Don't
- Don't use pure white or pure black.
- Don't add heavy shadows to cards.
- Don't introduce saturated accent colors or color-code branches.
- Don't use weight 700.
- Don't use pill radius on rectangular buttons.
- Don't mix passive (`--border`) and interactive (`--border-strong`) border styles.
- Don't add decoration (gradients, illustrations, parallax). The family is the content.