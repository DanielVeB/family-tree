# Family Tree

A private, client-side family tree app. Family data stays in your browser and is never uploaded.

**Privacy:** Your data stays in your browser. Nothing is uploaded. Export your file regularly, because browser storage can be cleared.

**Prywatność:** Twoje dane pozostają w przeglądarce. Nic nie jest przesyłane. Regularnie eksportuj plik, ponieważ pamięć przeglądarki może zostać wyczyszczona.

Exported files contain personal data. Store them securely and share them only with people you trust. See the [JSON file format guide](docs/file-format.md) for the file structure and relationship rules.

People can optionally have a gender (`female` or `male`), a birth date, and a death date. Dates use `YYYY`, `YYYY-MM`, or `YYYY-MM-DD`; older files without these fields continue to work unchanged. The app suggests gender from a person's first name. To adjust the name exceptions, add entries to `maleNamesEndingInA` or `femaleNamesNotEndingInA` in [`src/config/gender-names.json`](src/config/gender-names.json).

Each person stores a `metaData` object with their `layer` and `order`. Layers
start at 0 for the top row; order starts at 0 from the left within each row.
Both values are nonnegative integers. Parents are always above children;
partners and explicit siblings normally share a layer. Each connected part
starts at layer 0 with consecutive levels, and every row has consecutive
orders. Files without these values are not accepted. The app repairs gaps and
duplicate positions when loading a valid file.

Use **Import a file** to load a previously exported family tree. On desktop
Chrome, Edge, and Opera, **Export** opens a native save dialog the first time
and later exports overwrite that selected file. Firefox, Safari (including
iPhone), and Android Chrome download a new copy with the same chosen name; the
browser may add a number when that name already exists. Use **Export as…** to
choose another name or location. The selected file is forgotten when you
reload the app. Importing replaces the open tree; the app asks for confirmation
first if it has changes that were not exported.

## Run locally

```sh
npm install
npm run dev
```

## Test and build

```sh
npm test
npm run lint
npm run build
```

To format the code, run `npm run format`.

## Live site

https://danielveb.github.io/family-tree/

The site is deployed to GitHub Pages when changes are pushed to `main`. In the repository settings, configure **Pages → Build and deployment → Source** to **GitHub Actions**.
