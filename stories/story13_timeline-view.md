# Story 013: View family events as a timeline

| | |
|---|---|
| **ID** | 013 |
| **Type** | Feature story |
| **Priority** | Should have |
| **Size** | Medium |
| **Depends on** | Story 002 (tree model and schema), 011 (partial dates), 012 (wedding dates) |
| **References** | `AGENTS.md`, `DESIGN.md` |

## 1. User Story

**As a** user,  
**I want** to watch or step through a timeline of my family's events,  
**so that** I can see births, deaths, and marriages in order.

## 2. Scope

### In scope
1. A separate, read-only timeline popup, opened from the app and closed to return to the tree.
2. One slide for each recorded birth, death, or marriage date.
3. Automatic playback and manual navigation with buttons or left/right arrow keys.
4. Partial-date ordering, English and Polish text, and tests.

### Out of scope
- Editing dates or people from the timeline.
- New kinds of dates, filtering, searching, audio, or exporting the presentation.
- Changes to the tree's file format or the existing tree layout.

## 3. Behavior Rules

### 3.1 Events and ordering

- Read the current tree when the timeline opens, including all disconnected parts. Create one event for each present `dateOfBirth` and `dateOfDeath` on a person and each present `dateOfMarriage` on a marriage edge. A marriage is one event, not one per partner.
- Skip missing dates. Do not infer dates or show unknown fields as events.
- Sort by year, then month, then day, with a missing month or day ordered before a provided one. For example: `1986-12-31`, `1987`, `1987-01`, `1987-01-01`, `1987-12`.
- This ordering is a presentation convention, not a claim that an unknown month or day occurred first. Display only the precision actually supplied.
- Keep equal dates as separate slides in a deterministic order, preserving their collection order. Collect person events in node order (birth before death), followed by marriage events in edge order.
- Show the event type, the person's display name or both partners' display names, and the date formatted in the active locale. Use the existing display-name and partial-date helpers where appropriate.

### 3.2 Presentation

- Open on the first event, paused. Provide play/pause, previous, next, and close controls; indicate the current slide and total count.
- Play advances one slide every five seconds and stops at the last slide. Play on the last slide restarts from the first. Previous and next stop at the ends rather than wrapping.
- Left and right arrow keys move one slide while the popup is open. Manual navigation pauses playback. Do not capture arrow keys when they are needed by a focused control.
- If there are no dated events, show a friendly empty state and a close action; do not start playback.
- Closing the popup stops playback and returns the user to the existing tree view without changing selection, tree data, undo history, or export status. Reopening derives events from the current tree.

### 3.3 Isolation and accessibility

- Keep event extraction and ordering in pure functions within a dedicated timeline module; keep the presentation and playback state there too. Connect it to the app through a small, read-only interface receiving the current tree and a close callback.
- Define a common event representation so future date types can be added in the timeline module without changing its playback or ordering logic. Do not implement future event types now.
- Reuse existing model, date, translation, and design-system utilities rather than duplicating them. Do not add a dependency or make network requests.
- Use an accessible dialog: move focus inside on open, keep keyboard focus within it, close on Escape, and restore focus to the opening control. Give controls translated accessible names and make slide changes understandable to screen-reader users without disruptive repeated announcements during playback.
- Follow `DESIGN.md`, including 44px touch targets, safe-area insets, and readable, wrapping text at 360px in both languages.

## 4. Language

Provide English and Polish translations for the timeline action, event descriptions, playback controls, progress, and empty state. Use interpolation and locale-aware date and number formatting; never change the stored dates.

## 5. Acceptance Criteria

- [ ] **AC1.** The timeline opens independently of the tree and presents every recorded birth, death, and marriage once, including events in disconnected parts.
- [ ] **AC2.** Partial dates follow the specified year/month/day ordering, and identical dates remain separate and consistently ordered.
- [ ] **AC3.** Slides show the event, relevant names, and only the recorded date precision in the active locale.
- [ ] **AC4.** Play, pause, previous, next, and arrow keys work as described, including the first and last slides; closing stops the timer.
- [ ] **AC5.** A tree with no dated events shows a usable empty state.
- [ ] **AC6.** Opening, navigating, and closing the timeline do not change the tree, selection, undo history, or export status; reopening reflects current data.
- [ ] **AC7.** Timeline logic and UI are isolated behind a small read-only integration, with a common event representation for future event types.
- [ ] **AC8.** The popup is keyboard accessible and works at mobile and desktop widths in English and Polish.
- [ ] **AC9.** Tests cover event extraction, missing and partial dates, ties, playback and navigation boundaries, empty state, closing, and unchanged tree state. No dependency or network request is added.

## 6. Product Owner Verification

1. Add fictional people with birth and death dates and a dated marriage, including dates with year-only and year-month precision.
2. Open the timeline and step through it with buttons and arrow keys. Confirm the events and partial dates appear in the specified order.
3. Play the slides, pause, resume, and close the popup. Confirm the tree is unchanged.
4. Open a tree with no dates and confirm the empty state. Switch between English and Polish and check the labels and dates.
