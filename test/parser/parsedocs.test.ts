import * as assert from "assert"
import { describe, it } from "mocha";
import { Parser } from "../../src/parser";
import { RuleParser } from "../../src/ruleparser";


describe("ParserFullDocument", () => {
    it("parse simple string", async () => {
        const ruleDoc = `select = "SELECT";`
        const rules = new RuleParser().Parse(ruleDoc);
        const doc = `SELECT`;
        const result = new Parser(rules).ParseFullDocument(doc);
        assert.strictEqual(result.text, "SELECT");
    });
});
