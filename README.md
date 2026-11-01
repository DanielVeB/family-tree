# Family Tree

A private, client-side family tree app. Family data stays in your browser and is never uploaded.

**Privacy:** Your data stays in your browser. Nothing is uploaded. Export your file regularly, because browser storage can be cleared.

**Prywatność:** Twoje dane pozostają w przeglądarce. Nic nie jest przesyłane. Regularnie eksportuj plik, ponieważ pamięć przeglądarki może zostać wyczyszczona.

Exported files contain personal data. Store them securely and share them only with people you trust. See the [JSON file format guide](docs/file-format.md) for the file structure and relationship rules.

Use **Import a file** to load a previously exported family tree. Use **Export**
to download the current tree as a JSON file. Importing replaces the open tree;
the app asks for confirmation first if it has changes that were not exported.

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
