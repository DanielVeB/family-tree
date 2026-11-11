# Story 011: Person details: gender, date of birth, date of death (all optional)

| | |
|---|---|
| **ID** | 011 |
| **Type** | Feature story (data, forms, card) |
| **Priority** | Should have |
| **Size** | Medium |
| **Depends on** | Story 002 (model, schema), 004 (import), 005 (add-relative form), 007 (edit form), 010 (node actions) |
| **References** | `AGENTS.md`, `DESIGN.md` |

## 1. User Story

**As a** user,
**I want** to record a person's gender, date of birth, and date of death,
**so that** my tree holds more than names, and **I can keep using the files I exported before this story existed**.

## 2. Context and Intent

A person currently has only a first name and a last name. This story adds three details:

- **Gender**, chosen automatically from the first name (with a small configurable list of exceptions), and changeable by the user.
- **Date of birth.**
- **Date of death.**

**Everything new is optional, in the file and in the forms.** A file exported by any earlier version must import without error, must display exactly as before, and must export again **byte-identical** (nothing is added to it just because it was opened).

The file `version` stays **1**. The fields are additive, and older app versions keep unknown fields (story 004).

## 3. Scope

### In scope
1. Three optional fields in the data model, the schema, import, and export.
2. The fields in the add-relative form and in the edit form (they share one person form).
3. Automatic gender from the first name, using a config file of exceptions.
4. Dates with partial precision (year only, or year and month, or a full date).
5. A short dates line on the person card.
6. English and Polish texts, tests, and documentation.

### Out of scope (do not build)
- Genders other than female and male, or a "not specified" choice. (A person without gender simply has no value, see 4.3.)
- Showing gender on the card, or using it for color (`DESIGN.md`: no color-coding by gender).
- Place of birth or death, causes, notes, photos, or any other detail.
- Age calculation, anniversaries, or a "deceased" flag. A death date is the only marker.
- Checks between different people (parents older than children, and so on).
- A bulk action that fills in missing genders in an old tree.
- Editing the exceptions list inside the app. It is a file in the repo.
- Changing the file `version` or adding a migration.

## 4. Behavior Rules

### 4.1 Data
Three optional fields are added **inside `data`** (not `metaData`), next to `firstName` and `lastName`:

```json
{
  "id": "3f2c...",
  "data": {
    "firstName": "Anna",
    "lastName": "Testowa",
    "gender": "female",
    "dateOfBirth": "1948-03-07",
    "dateOfDeath": "2019"
  },
  "metaData": { "layer": 0, "order": 0 }
}
```

| Field | Type | Meaning |
|---|---|---|
| `gender` | `"female"` or `"male"` | Optional |
| `dateOfBirth` | Partial date string | Optional |
| `dateOfDeath` | Partial date string | Optional |

- **Partial date string:** exactly one of `YYYY`, `YYYY-MM`, or `YYYY-MM-DD` (digits only, year 1000 or later). Month 01 to 12, day valid for that month and year (leap years included).
- **The schema marks all three as optional.** A file with none of them is valid. A file with some of them is valid. A value that does not match the rules above (wrong type, unknown gender word, impossible date such as `2021-02-30`) makes the file "wrong shape", with the generic error toast from story 004.
- **Never written when empty.** On export, a field that is not set is **left out**, never written as `null` or an empty string. This keeps old files byte-identical after import and export.
- **Key order inside `data` on export:** `firstName`, `lastName`, `gender`, `dateOfBirth`, `dateOfDeath`, then unknown fields in their original order.
- Opening or importing a file **never** fills in a missing field, including gender. Values appear only when the user saves a person through a form.
- Unknown fields inside `data` stay preserved (story 004, 5.5).

### 4.2 Gender from the first name
A pure function `guessGender(firstName)` in `src/model/` returns `"female"`, `"male"`, or `undefined`:

1. Trim the text. If it is empty, return `undefined`.
2. Take the **first word**, where words are separated by spaces or hyphens (`Anna Maria` and `Anna-Maria` give `Anna`, and `Jean-Luc` gives `Jean`).
3. Compare **case-insensitively** (Unicode-aware, Polish letters kept) with the exceptions lists (4.4):
    - found in `maleNamesEndingInA` → `"male"`,
    - found in `femaleNamesNotEndingInA` → `"female"`.
4. Otherwise: the word ends with the letter **a** (any case) → `"female"`. Any other ending → `"male"`.

Because of rule 4, any non-empty first name gives a result. The exceptions exist for the names where the rule is wrong.

### 4.3 How gender works in the forms
The form has a **Gender** choice with two options, **Female** and **Male** (radio buttons). The form is in one of two modes:

- **Automatic mode:** the selected option follows the first name **while the user types it**. When `guessGender` returns `undefined` (the first name is empty), nothing is selected.
- **Manual mode:** starts when the user **picks** an option themselves. From then on, the first name no longer changes the choice, in this form session.

When the form opens:
- **Add forms** start in automatic mode.
- **Edit form:** if the person has **no** stored gender, or the stored gender is **equal** to `guessGender` of the current first name, the form starts in automatic mode. If the stored gender is **different** from the guess, it starts in manual mode (the user overrode it earlier).

Saving stores the selected option as `gender`. If nothing is selected (empty first name), `gender` is not stored (and a stored one is removed only if the user clears it by emptying the first name in automatic mode; the first name itself stays required as before).

A short hint under the options, "Chosen from the first name. You can change it.", is shown **only** in automatic mode while an option is selected.

### 4.4 The exceptions config file
- File: `src/config/gender-names.json`, bundled with the app (no network). It looks like this:

```json
{
  "maleNamesEndingInA": [
    "Kuba", "Kosma", "Barnaba", "Bonawentura", "Dyzma",
    "Zawisza", "Jarema", "Boruta", "Noah", "Luca"
  ],
  "femaleNamesNotEndingInA": [
    "Nel", "Karmen", "Beatrycze"
  ]
}
```

- The product owner will edit this file in the future. Adding a name needs **only** a new entry in the right list, with no code change.
- The lists are read once, normalized (trimmed, lower-cased with Unicode rules), and put into sets.
- A short comment in the README explains the two lists and how to add a name. (JSON has no comments, so the explanation lives in the README and in `docs/`.)
- An entry that does not change the default result is **allowed and harmless** (for example `Noah`, which does not end in a, so it would be male anyway).
- A unit test validates the file: both lists are arrays of non-empty trimmed strings, no list has duplicates (case-insensitive), and no name is in both lists.

### 4.5 Dates in the forms
Date of birth and date of death each have **three small fields in a row: Day, Month, Year**, in that order in both languages, each with a label above (14px). They are all optional, and an explanatory line says "Optional. A year is enough."

- Numeric entry (`inputmode="numeric"`), no date picker. Day and month accept 1 or 2 digits, the year 4 digits.
- **Partial dates are allowed:** year only, year and month, or all three. Month without year, or day without month, is an error.
- All three empty means "not set".
- The stored value is built from what is filled in, with zero padding (`1948-03-07`, `1948-03`, `1948`).
- **Validation** (in plain language, under the group, on leaving a field and on saving; invalid fields are marked and linked to the message with `aria-describedby`):

| Problem | Message key |
|---|---|
| A day or month without the required parts, or a value outside the calendar (month 13, 31 February, year before 1000) | `person.date.errorInvalid` |
| Month or day given without a year | `person.date.errorYear` |
| A date after **today** (local date). A partial date is in the future when its earliest possible day is after today | `person.date.errorFuture` |
| Date of death before date of birth. Compared at the **precision both have**: year first, then month, then day, only as far as both are filled in | `person.date.errorOrder` |

- A form with an error cannot be saved. Nothing else is validated across people.

### 4.6 Edit, Undo, and other features
- **Edit** (story 007) saves the three fields together with the names, as one change, with the usual status "Changes not exported". A form without any change does not change the status (existing behavior).
- Fields the user clears are **removed** from the person (not stored empty).
- **Undo** (story 007 and 009) restores them with the rest of the person.
- Delete, move, add relative, import, and export are not otherwise changed.
- In the add-relative form (story 005), the new person's `gender`, `dateOfBirth`, and `dateOfDeath` are entered exactly as in the edit form. The existing relation rules are not changed.

### 4.7 The dates line on the card
Under the person's name (the **caption** style from `DESIGN.md`: 14px, `--muted`), the card shows **years only**:

| Known | Shown (English) | Shown (Polish) |
|---|---|---|
| Birth year and death year | `1948 – 2019` | `1948 – 2019` |
| Birth year only | `b. 1948` | `ur. 1948` |
| Death year only | `d. 2019` | `zm. 2019` |
| Neither | Nothing (no empty line) | Nothing |

- The dash is an en dash with a space on both sides (the example in `DESIGN.md`).
- The card keeps the **same size for everybody**, with and without dates, so the layout from story 006 does not change. If the card is too short for the name and one caption line, set one fixed height in `layout/config.ts` for all cards (a story 006 constants change, to be mentioned in the commit message).
- The name and the dates line each stay on **one line** with an ellipsis. The full text is not shown elsewhere, so the full dates appear only in the edit form.
- A date that is not valid in the file's text (only possible if a file passed the schema, which it cannot) must never crash the card. The card then shows nothing for that date.
- Gender is **not** shown on the card.

## 5. Screens and Components

All visuals follow `DESIGN.md`. No new colors and no new component styles.

### Person form (add relative and edit; same component)
Order of fields: first name, last name, gender, date of birth, date of death.

- **Gender:** a label "Gender" and two native radio buttons in 44px rows ("Female", "Male"), laid out side by side on desktop and phone (they are short). The hint is a caption (14px, `--muted`) under them.
- **Date groups:** a label ("Date of birth", "Date of death") over a row of three inputs (Day, Month, Year). Day and month are narrow (about 25% each), and the year is wider (about 40%). Inputs use the input style from `DESIGN.md` (cream background, `1px solid --border`, 6px radius, 44px minimum height, 2px `--ring` outline on focus). Gaps are 8px.
- **Errors:** the message appears under the group in caption size in `--oak`. The affected inputs get the interactive border (`--border-strong`). There is no red and no other color.
- On a phone (360px), the three inputs stay in one row without horizontal scroll, in both languages.

## 6. Scenario Catalogue

| ID | Given | When | Then |
|----|-------|------|------|
| **P1** | An old file with people that have only first and last names (no new fields, with `metaData`) | Import, then export | Loads without error, looks as before (no dates line), and the exported file is **byte-identical** to the imported one |
| **P2** | The add-person form, first name empty | Type `Kuba` | "Male" becomes selected, with the hint. Typing continues to `Kubanka`… the selection follows the name |
| **P3** | P2, automatic mode, name `Anna` | Change the name to `Karmen` | "Female" stays selected (exception). Change to `Jan` | "Male" is selected |
| **P4** | Automatic mode, name `Anna` (female) | The user picks "Male", then changes the name to `Ola` | "Male" **stays** selected, and the hint is gone |
| **P5** | An old person without gender, first name `Marek` | Open edit | The form starts in automatic mode with "Male" selected. Saving stores `gender: "male"`. Nothing is stored if the user does not save |
| **P6** | A person stored as `gender: "female"`, first name `Jan` | Open edit | Manual mode: "Female" is selected, and changing the name does not change it |
| **P7** | Any form | Enter day 31, month 02, year 2020 | `person.date.errorInvalid` is shown and saving is blocked |
| **P8** | Any form | Enter month 5 and no year | `person.date.errorYear` |
| **P9** | Any form | Enter a birth year only: 1948 | Valid. Stored as `"1948"`. The card shows `b. 1948` |
| **P10** | Birth `1990-05`, death `1990-03-10` | Save | `person.date.errorOrder` (the months can be compared) |
| **P11** | Birth `1990`, death `1990-03-10` | Save | Valid (only the year is comparable and the years are equal) |
| **P12** | Any form | Enter a year next year | `person.date.errorFuture` |
| **P13** | An edited person that had dates | Clear all fields of one date | The key is **removed** from the person and from the exported file |
| **P14** | A file with `"gender": "other"` or `"dateOfBirth": "07.03.1948"` or `"dateOfBirth": "2021-02-30"` | Import | The generic error toast, and the current tree is unchanged |
| **P15** | A person with both years | Draw | The card shows `1948 – 2019` in the caption style, on one line |
| **P16** | A person with neither date | Draw | No dates line. Same card size as other cards |
| **P17** | The exceptions file with a new entry added | Run the tests | The new name changes the result, with no code change |
| **P18** | Polish language, a phone 360px wide | Open the form | Labels, hint, and error messages fit, and the three date inputs stay in one row |
| **P19** | A person with details | Edit, then Undo | The person returns to exactly the earlier state, including the details |
| **P20** | A person saved with new fields | Export, import, export | Byte-identical files |

**Gender fixture (unit test table).** `guessGender` must return:

| Input | Result | Input | Result |
|---|---|---|---|
| Anna | female | Kuba | male |
| ANNA | female | kuba | male |
| Ola | female | Kosma | male |
| Łucja | female | Barnaba | male |
| Beata | female | Bonawentura | male |
| Nel | female | Dyzma | male |
| Karmen | female | Zawisza | male |
| Beatrycze | female | Jarema | male |
| Anna Maria | female | Boruta | male |
| Anna-Maria | female | Noah | male |
| Jan | male | Luca | male |
| Mikołaj | male | Jean-Luc | male |
| (empty) | undefined | (spaces only) | undefined |

## 7. Language and Text (English / Polish)

| Key | English | Polish |
|-----|---------|--------|
| person.gender.label | Gender | Płeć |
| person.gender.female | Female | Kobieta |
| person.gender.male | Male | Mężczyzna |
| person.gender.auto | Chosen from the first name. You can change it. | Wybrano na podstawie imienia. Możesz to zmienić. |
| person.birth.label | Date of birth | Data urodzenia |
| person.death.label | Date of death | Data śmierci |
| person.date.day | Day | Dzień |
| person.date.month | Month | Miesiąc |
| person.date.year | Year | Rok |
| person.date.hint | Optional. A year is enough. | Opcjonalne. Wystarczy rok. |
| person.date.errorInvalid | Enter a valid date. | Wpisz poprawną datę. |
| person.date.errorYear | Enter the year. | Wpisz rok. |
| person.date.errorFuture | The date can't be in the future. | Data nie może być w przyszłości. |
| person.date.errorOrder | The date of death can't be before the date of birth. | Data śmierci nie może być wcześniejsza niż data urodzenia. |
| person.dates.born | b. {{year}} | ur. {{year}} |
| person.dates.died | d. {{year}} | zm. {{year}} |
| person.dates.range | {{from}} – {{to}} | {{from}} – {{to}} |

The file contents are never translated. Gender values in the file are always the English words `female` and `male`.

## 8. Acceptance Criteria

### Data and compatibility
- [ ] **AC1.** `gender`, `dateOfBirth`, and `dateOfDeath` exist in the zod schema and TypeScript types inside `data`, all **optional**, with the rules in 4.1. The `version` stays 1, and no migration code exists.
- [ ] **AC2.** A file from before this story (no new fields) imports without error and without any visible change (P1).
- [ ] **AC3.** Import → export of such a file is **byte-identical** (automated test with a fictional fixture), and no new key is added to any person.
- [ ] **AC4.** Export writes a new field only when it has a value, never `null` or an empty string, in the key order from 4.1 (P13, P20).
- [ ] **AC5.** A file with an unknown gender word, a wrong date format, a non-string value, or an impossible calendar date gets the generic error toast and changes nothing (P14). Fixtures are fictional.
- [ ] **AC6.** Unknown fields inside `data` are still preserved, together with the new ones, on import and export.
- [ ] **AC7.** Opening, importing, or exporting never fills in a missing field. Values are stored only through a form save (P5).
- [ ] **AC8.** `docs/file-format.md` and the README describe the three fields, the partial date formats, that all are optional, and that older files work unchanged.

### Gender
- [ ] **AC9.** `guessGender` in `src/model/` is pure, has no React imports, follows 4.2, and passes the whole fixture table in section 6, including Polish letters, upper and lower case, several words, and hyphens.
- [ ] **AC10.** The exceptions come only from `src/config/gender-names.json`, bundled with the app. Adding a name to the file changes the result with no code change (P17). The file contains exactly the names given in 4.4 at the start.
- [ ] **AC11.** A unit test validates the config file as described in 4.4 (non-empty trimmed strings, no duplicates, no name in both lists), and allows entries that match the default rule (such as `Noah`).
- [ ] **AC12.** The form has two radio options, "Female" and "Male", in 44px rows, with the hint shown only in automatic mode while an option is selected.
- [ ] **AC13.** Automatic and manual mode work as in 4.3 for the add form and the edit form (P2 to P6), and are covered by component tests.
- [ ] **AC14.** Saving stores `gender` as selected. With no selection, nothing is stored.

### Dates
- [ ] **AC15.** Date of birth and date of death each have Day, Month, and Year inputs (labels above, numeric keyboard on phones, single row at 360px) and an "Optional. A year is enough." line.
- [ ] **AC16.** Partial dates are stored as `YYYY`, `YYYY-MM`, or `YYYY-MM-DD` with zero padding. Empty groups are not stored (P9, P13).
- [ ] **AC17.** Validation follows 4.5: invalid calendar values, a missing year, a future date, and death before birth (compared at the shared precision) each show the matching message and block saving (P7, P8, P10 to P12). A pure validation function in `src/model/` has unit tests for leap years, month ends, year 1000, today's date, and partial comparisons.
- [ ] **AC18.** Error messages are linked to the inputs with `aria-describedby`, inputs use the interactive border, and no new color is used.
- [ ] **AC19.** The same form component is used by the add-relative flow and the edit flow, and all three fields work in both (story 005 relation rules unchanged).

### Card and layout
- [ ] **AC20.** The card shows the years caption exactly as in 4.7 (P9, P15, P16), in the caption style from `DESIGN.md`, on one line, with an ellipsis if needed. Nothing is shown when no date is set.
- [ ] **AC21.** All cards keep the same size with and without dates, the layout results for existing fixtures are unchanged, and the story 006 tests pass (any change of a card height constant is mentioned in the commit message).
- [ ] **AC22.** Gender is not shown on the card, and no color or shape depends on gender or on being deceased.
- [ ] **AC23.** The card never crashes or shows broken text for any value that passed the schema.

### Other features
- [ ] **AC24.** Edit saves the new fields with the names as one change, status "Changes not exported" follows existing rules, and Undo restores the full previous person (P19).
- [ ] **AC25.** Round trip export → import → export of a tree with the new fields is byte-identical (P20).
- [ ] **AC26.** The round-trip fixture also covers a person with only some of the new fields, and a person with unknown fields next to them.

### Language and quality
- [ ] **AC27.** All new strings exist in both `en` and `pl`, none are hardcoded, and the key-parity test passes. Texts fit at 360px width in both languages without cut-off (P18). Switching language with the form open updates texts immediately without losing the typed values.
- [ ] **AC28.** Component tests cover: add a person named `Kuba` → "Male" is preselected → enter a birth year → save → the card shows `b. …` → export → the file has `gender` and `dateOfBirth`. A second test covers P1 (old file import and export byte-identical).
- [ ] **AC29.** The randomized test from story 009 (AC40) is extended so that people may carry the new fields, and its checks (schema valid, byte-identical round trip) still pass.
- [ ] **AC30.** `AGENTS.md` is updated as in section 10, and the README explains the exceptions file.
- [ ] **AC31.** `npm run lint`, `npm test`, and `npm run build` pass, deployment still works, no new dependency is added, no network request is made, and no real or sensitive data is added to the repo. Fixtures use fictional names and dates only.

## 9. Technical Notes

- Put the date helpers (parse, build, validate, compare, format for the card) in `src/model/dates.ts` as pure functions. Use the local date for "today". Inject "today" as a parameter so tests do not depend on the clock.
- Import the JSON config with `resolveJsonModule`, validate its shape with zod at module load in tests only (a failing config should fail the test, not the running app). In the app, ignore invalid entries safely.
- Normalize names for comparison with `toLocaleLowerCase("pl")` after `normalize("NFC")`.
- The form keeps the gender mode (automatic or manual) in its own local state. It is not stored in the file.
- Do not add a date picker or any dependency.
- Keep the zod schema permissive about unknown fields (`passthrough`), strict about the three new fields only.

## 10. Required Update to `AGENTS.md`

- **Data model:** add `gender?: "female" | "male"`, `dateOfBirth?: PartialDate`, and `dateOfDeath?: PartialDate` to `PersonData`, define `PartialDate` (`YYYY`, `YYYY-MM`, `YYYY-MM-DD`), and state that all three are optional, omitted when empty, and never filled in on import.
- **Features:** add "person details (gender chosen from the first name with configurable exceptions, optional dates of birth and death)".
- **Config:** document `src/config/gender-names.json` and its two lists.
- **UI:** the card shows a years line in the caption style, and the person form has gender and two partial-date groups.

## 11. Definition of Done

- All acceptance criteria are checked.
- Merged to `main`, GitHub Actions green, live site updated.
- The product owner imported **a real older file** locally, confirmed that it opens unchanged, and that exporting it again gives an identical file.
- Verified on a real phone and on desktop, in both languages.
- No real or sensitive data in the repo.

## 12. How the Product Owner Will Verify

1. Import an **older** file (from before this story). The tree looks exactly as before. Export it again and compare the two files. They are identical.
2. Add a person named `Kuba`. "Male" is selected with the hint. Change the name to `Kasia`. "Female" is selected. Try `Karmen`, `Nel`, and `Beatrycze`. All female.
3. Pick "Male" yourself, then change the name. The choice stays.
4. Enter a birth year only and save. The card shows `b. 1948`. Edit the person and add a death year. The card shows `1948 – 2019`.
5. Try 31 February, a month without a year, a date in the future, and a death before the birth. Each shows a clear message, and saving is blocked.
6. Clear a date and save. Export and check that the key is gone from the file.
7. Edit an old person without gender. The gender is preselected from the name, and nothing changes until you save.
8. Add a new name to `src/config/gender-names.json` locally, rebuild, and check that the new name is recognized.
9. Switch to Polish and check all texts, and check the form on a 360px wide phone.

## 13. Notes for Next Stories (not part of this story)

Likely next: a bulk action to fill in missing genders (and review them) in an older tree, a person details view with full dates, showing a subtle marker for people who have died (the optional tint from `DESIGN.md`), relationship labels that use gender (mother, father), other genders or "not specified", age and date checks between relatives, more details such as place and notes.