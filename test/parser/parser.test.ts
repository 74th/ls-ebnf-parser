import { describe, it } from "mocha";
import { RuleParser } from "../../src/ruleparser";
import * as assert from "assert"
import * as fs from "fs/promises";
import { parse } from "path";
import { ListRuleNode, StringRuleNode } from "../../src/model/rule";

describe("parseRules", () => {
    it("parse simple string", async () => {
        const parser = new RuleParser();
        let rule = parser.Parse("name ::= \"text1\" \"text2\"")

        assert.strictEqual(rule.length, 1);
        let rule0 = rule[0];
        assert.strictEqual(rule0.name, "name");
        assert.strictEqual(rule0.root.type, "list");

        let root = rule0.root as ListRuleNode;
        assert.strictEqual(root.nodes[0].type, "string")
        let node = root.nodes[0] as StringRuleNode;
        assert.strictEqual(node.text, "text1")

        assert.strictEqual(root.nodes[1].type, "string")
        node = root.nodes[1] as StringRuleNode;
        assert.strictEqual(node.text, "text2")
    });
});
