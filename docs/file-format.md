# Family Tree JSON file format

Exported files are UTF-8 JSON with two-space indentation and a trailing newline.
They contain the tree itself, not interface state or export timestamps.

## Export behavior by browser

On desktop Chrome, Edge, and Opera, the first export opens the browser's native
save dialog. Later exports overwrite the file selected for this session. In
Firefox, Safari (including iOS), and Android Chrome, the app asks for a file
name in the app and then downloads a new copy on each export. The browser may
add a number if a file with that name already exists. In every browser, use
**Export as…** to select another name or location. The selected file is kept
only in memory and is forgotten when the app is reloaded.

After importing a `.json` file, its name is suggested for the next export, but
the imported file is not overwritten directly. The browser asks you to choose
or confirm the export target.

## Fields

- `version` is the format version. The current version is `1`.
- `nodes` is an array of people in creation order. Each node has a unique `id`
  and a `data` object containing a required `firstName` and an optional
  `lastName`, `gender`, `dateOfBirth`, and `dateOfDeath`, plus required
  `metaData.layer` and `metaData.order` integers. Gender is either `female` or
  `male`. Dates are optional partial dates in `YYYY`, `YYYY-MM`, or
  `YYYY-MM-DD` form, with valid calendar values and years from 1000 onward.
  Empty values are omitted. Files exported before these fields were added
  remain valid and are not changed just by importing and exporting them.
  Unknown fields in `data` and `metaData` are retained.
- `edges` is an array of relationships in creation order. `from` and `to`
  contain node IDs, and `type` is one of the relationship types below.
- Unknown fields on the tree, nodes, data, and edges are retained where
  supported.

When importing and exporting a file, the app preserves unknown fields so that
data from a newer format can survive a round trip through this version.

## Stored positions

Every node must include `metaData` with nonnegative integer `layer` and `order`
values. Files without either value are rejected; there is no migration from
older files. The app repairs gaps and duplicate orders on import without
changing the loaded/export status.

- `layer` is the row, starting at `0` for the top row.
- `order` is the left-to-right position, starting at `0` within a row.
- Each connected part starts at layer `0`; its used layers and each row's
  orders are consecutive.
- For every `child` edge, the parent's layer is less than the child's layer.
- Marriage and explicit sibling edges are normally on the same layer.

## Relationship types

| Type       | Meaning                         | Direction                       |
| ---------- | ------------------------------- | ------------------------------- |
| `child`    | `to` is a child of `from`       | Directed from parent to child   |
| `sibling`  | The people are siblings         | Undirected; store one edge only |
| `marriage` | The people are married partners | Undirected; store one edge only |

For `sibling` and `marriage`, reversing `from` and `to` does not create a
different relationship.

## Validation

Names are trimmed. A first name is required and may contain 1–100 characters;
a last name is optional and may contain up to 100 characters. Gender and both
dates are optional and are only added when a person is saved in a form; import
does not infer or fill missing values. Node IDs must be non-empty and unique.
Every edge must refer to existing nodes, may not connect a node to itself, and
must not duplicate another edge of the same type. `child` edges must not form a
cycle.

## Fictional example

```json
{
  "version": 1,
  "nodes": [
    {
      "id": "person-anna",
      "data": {
        "firstName": "Anna",
        "lastName": "Testowa",
        "gender": "female",
        "dateOfBirth": "1948-03-07",
        "dateOfDeath": "2019"
      },
      "metaData": {
        "layer": 0,
        "order": 0
      }
    },
    {
      "id": "person-jan",
      "data": {
        "firstName": "Jan",
        "lastName": "Przykładowy"
      },
      "metaData": {
        "layer": 1,
        "order": 0
      }
    }
  ],
  "edges": [
    {
      "from": "person-anna",
      "to": "person-jan",
      "type": "child"
    }
  ]
}
```
