# EBNF Parser for Language Server

WIP

## features

- multi purpose purser with ENBF grammar
- based number of line and character for Language Server
- to purse full document and edited fragment of document for Language Server
- support regex

## sample

```
sql = select;
SP = /\s+/;
select = "SELECT" SP rows SP "FROM" SP tables;
rows = row { [ SP ] "," SP row } | "*";
row = table_column_name [ SP "AS" SP as_row_name ];
table_column_name = /\w+/;
as_row_name = /\w+/;
tables = /\w+/;
```

```typescript
const ruleParser = new RuleParser();
const ebnf = (await fs.readFile("test/sql/sql.ebnf")).toString();
const rules = ruleParser.Parse(ebnf);
rules.tokenExcludeRules = ["SP"];
const parser = new Parser(rules);

const r = parser.ParseFullDocument("SELECT row1, row2, row3 FROM table1");

assert.strictEqual("sql", r.rule);
assert.strictEqual(1, r.children.length);
const r2 = r.children[0];
assert.strictEqual("select", r2.rule);
assert.strictEqual(2, r2.children.length);
assert.strictEqual("rows", r2.children[0].rule);
assert.strictEqual(3, r2.children[0].children.length);
assert.strictEqual("row", r2.children[0].children[0].rule);
assert.strictEqual("row1", r2.children[0].children[0].text);
```

parsed token sample

```json
{
  "rule": "sql",
    ...
  "children": [ {
    "rule": "select",
      ...
    "children": [
      {
        "rule": "rows",
        ...
        "children": [
          {
            "rule": "row",
            "text": "row1",
            "range": {
              "start": { "line": 0, "character": 7 },
              "end": { "line": 0, "character": 11 }
            },
            "children": [...]
          },
          {
            "rule": "row",
            "text": "row2",
            "range": {
              "start": { "line": 0, "character": 13 },
              "end": { "line": 0, "character": 17 }
            },
            "children": [...]
          },
          ...
        ]
      },
      {
        "rule": "tables",
        "text": "table1",
        "range": {
            "start": { "line": 0, "character": 29 },
            "end": { "line": 0, "character": 35 }
          },
          "children": [],
        }
      ]
    ]
  }]
}
```

## EBNF grammar

| Usage           | Notation        |
| --------------- | --------------- |
| definition      | =               |
| termination     | ;               |
| alternation     | \|              |
| optional        | [ ... ]         |
| repetition      | { ... }         |
| grouping        | ( ... )         |
| terminal string | " ... " ' ... ' |
| terminal regex  | / ... /         |
| comment         | (\* ... \*)     |

- definition name must be `/\w+/` ( ex `select_query = ...;`)

## progress

- [x] purse full document
- [ ] purse edited fragment of document
- [ ] detect repeated production of its self
- [ ] token has event emitter for detect edited token

## License

MIT
