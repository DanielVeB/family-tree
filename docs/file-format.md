# Family Tree JSON file format

Exported files are UTF-8 JSON with two-space indentation and a trailing newline.
They contain the tree itself, not interface state or export timestamps.

## Fields

- `version` is the format version. The current version is `1`.
- `nodes` is an array of people in creation order. Each node has a unique `id`
  and a `data` object containing a required `firstName` and an optional
  `lastName`. Unknown fields in `data` are retained.
- `edges` is an array of relationships in creation order. `from` and `to`
  contain node IDs, and `type` is one of the relationship types below.
- Unknown fields on the tree, nodes, data, and edges are retained where
  supported.

## Relationship types

| Type | Meaning | Direction |
|------|---------|-----------|
| `child` | `to` is a child of `from` | Directed from parent to child |
| `sibling` | The people are siblings | Undirected; store one edge only |
| `marriage` | The people are married partners | Undirected; store one edge only |

For `sibling` and `marriage`, reversing `from` and `to` does not create a
different relationship.

## Validation

Names are trimmed. A first name is required and may contain 1–100 characters;
a last name is optional and may contain up to 100 characters. Node IDs must be
non-empty and unique. Every edge must refer to existing nodes, may not connect
a node to itself, and must not duplicate another edge of the same type.
`child` edges must not form a cycle.

## Fictional example

```json
{
  "version": 1,
  "nodes": [
    {
      "id": "person-anna",
      "data": {
        "firstName": "Anna",
        "lastName": "Testowa"
      }
    },
    {
      "id": "person-jan",
      "data": {
        "firstName": "Jan",
        "lastName": "Przykładowy"
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
