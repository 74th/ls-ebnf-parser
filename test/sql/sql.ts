import * as assert from "assert"
import { describe, it } from "mocha";
import { RuleParser } from "../../src/ruleparser";
import { Parser } from "../../src/parser";
import * as fs from "fs/promises";

async function createSQLParser(): Promise<Parser> {
    const ruleParser = new RuleParser();
    const ebnf = (await fs.readFile("test/sql/sql.ebnf")).toString();
    const rules = ruleParser.Parse(ebnf);
    const parser = new Parser(rules);
    parser.tokenExcludeRules["SP"] = true;
    return parser;
}

describe("SQL", () => {
    it("parse simple sql", async () => {
        const p = await createSQLParser();
        const r = p.ParseFullDocument("SELECT * FROM table1");
        assert.strictEqual("sql", r.rule);
        assert.strictEqual(1, r.children.length);
        const r2 = r.children[0];
        assert.strictEqual("select", r2.rule);
        assert.strictEqual(2, r2.children.length);

        assert.strictEqual("rows", r2.children[0].rule);
        assert.strictEqual("*", r2.children[0].text);

        assert.strictEqual("tables", r2.children[1].rule);
        assert.strictEqual("table1", r2.children[1].text);
    });
    it("parse multi row", async () => {
        const p = await createSQLParser();
        const r = p.ParseFullDocument("SELECT row1, row2, row3 FROM table1");
        assert.strictEqual("sql", r.rule);
        assert.strictEqual(1, r.children.length);
        const r2 = r.children[0];
        assert.strictEqual("select", r2.rule);
        assert.strictEqual(2, r2.children.length);

        assert.strictEqual("rows", r2.children[0].rule);
        assert.strictEqual(3, r2.children[0].children.length);
        assert.strictEqual("row", r2.children[0].children[0].rule);
        assert.strictEqual("row1", r2.children[0].children[0].text);
        assert.strictEqual("row", r2.children[0].children[1].rule);
        assert.strictEqual("row2", r2.children[0].children[1].text);
        assert.strictEqual("row", r2.children[0].children[2].rule);
        assert.strictEqual("row3", r2.children[0].children[2].text);
        console.log(JSON.stringify(r, null, "  "));
    });

    it("parse as row", async () => {
        const p = await createSQLParser();
        const r = p.ParseFullDocument("SELECT row1, row2 AS rrr3, row3 FROM table1");
        assert.strictEqual("sql", r.rule);
        assert.strictEqual(1, r.children.length);
        const r2 = r.children[0];
        assert.strictEqual("select", r2.rule);
        assert.strictEqual(2, r2.children.length);

        assert.strictEqual("rows", r2.children[0].rule);
        assert.strictEqual(3, r2.children[0].children.length);
        assert.strictEqual("row", r2.children[0].children[1].rule);
        assert.strictEqual("row2 AS rrr3", r2.children[0].children[1].text);
        assert.strictEqual("row2", r2.children[0].children[1].children[0].text);
        assert.strictEqual("table_column_name", r2.children[0].children[1].children[0].rule);
        assert.strictEqual("rrr3", r2.children[0].children[1].children[1].text);

    });
});
