import * as assert from "assert"
import { describe, it } from "mocha";
import { Parser } from "../../src/parser";
import { RuleParser } from "../../src/ruleparser";


describe("ParserFullDocument", () => {
    it("parse simple string", async () => {
        const ruleDoc = `select = "SELECT";`;
        const rules = new RuleParser().Parse(ruleDoc);
        const doc = `SELECT`;
        const result = new Parser(rules).ParseFullDocument(doc);
        assert.strictEqual(result.text, "SELECT");
        assert.strictEqual(result.rule, "select");
    });

    it("parse simple reference", async () => {
        const ruleDoc = `item1 = item2;item2 = item3; item3 = "SELECT";`;
        const rules = new RuleParser().Parse(ruleDoc);
        const doc = `SELECT`;
        const result = new Parser(rules).ParseFullDocument(doc);
        assert.strictEqual(result.text, "SELECT");
        assert.strictEqual(result.rule, "item1");
        assert.strictEqual(result.children.length, 1);
        assert.strictEqual(result.children[0].rule, "item2");
        assert.strictEqual(result.children[0].children.length, 1);
        assert.strictEqual(result.children[0].children[0].rule, "item3");
    });

    it("parse group reference", async () => {
        const ruleDoc = `item1 = item2 item3; item2 = "SELECT"; item3 = "*";`;
        const rules = new RuleParser().Parse(ruleDoc);
        const doc = `SELECT*`;
        const result = new Parser(rules).ParseFullDocument(doc);
        assert.strictEqual(result.text, "SELECT*");
        assert.strictEqual(result.rule, "item1");
        assert.strictEqual(result.children.length, 2);
        assert.strictEqual(result.children[0].rule, "item2");
        assert.strictEqual(result.children[0].text, "SELECT");
        assert.strictEqual(result.children[1].rule, "item3");
        assert.strictEqual(result.children[1].text, "*");
    });
});
