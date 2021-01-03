import { describe, it } from "mocha";
import { RuleParser } from "../../src/ruleparser";
import * as assert from "assert"
import * as fs from "fs/promises";
import { parse } from "path";
import { AlternationRuleNode, CharacterRuleNode, GroupRuleNode, StringRuleNode } from "../../src/model/rule";

describe("parseRules", () => {
    it("parse simple string", async () => {
        const parser = new RuleParser();
        const rule = parser.Parse("name ::= \"text1\" \"text2\"")

        assert.strictEqual(rule.length, 1);
        const rule0 = rule[0];
        assert.strictEqual(rule0.name, "name");
        assert.strictEqual(rule0.root.type, "group");

        const root = rule0.root as GroupRuleNode;
        assert.strictEqual(root.nodes[0].type, "string")
        const node0 = root.nodes[0] as StringRuleNode;
        assert.strictEqual(node0.text, "text1")

        assert.strictEqual(root.nodes[1].type, "string")
        const node1 = root.nodes[1] as StringRuleNode;
        assert.strictEqual(node1.text, "text2")
    });

    it("parse character node", async () => {
        const parser = new RuleParser();
        const rule = parser.Parse("name ::= [0-9] [A-Z]")

        assert.strictEqual(rule.length, 1);
        const rule0 = rule[0];
        assert.strictEqual(rule0.root.type, "group");

        const root = rule0.root as GroupRuleNode;
        assert.strictEqual(root.nodes[0].type, "character")
        const node0 = root.nodes[0] as CharacterRuleNode;
        assert.strictEqual(node0.regex.source, "[0-9]")

        assert.strictEqual(root.nodes[1].type, "character")
        const node1 = root.nodes[1] as CharacterRuleNode;
        assert.strictEqual(node1.regex.source, "[A-Z]")
    });

    it("parse simple alternation", async () => {
        const parser = new RuleParser();
        let rule = parser.Parse("name ::= \"text1\" | \"text2\" \"text3\"")

        assert.strictEqual(rule.length, 1);
        const rule0 = rule[0];
        assert.strictEqual(rule0.root.type, "alternation");
        const node0 = rule0.root as AlternationRuleNode;

        assert.strictEqual(node0.nodes.length, 2);
        assert.strictEqual(node0.nodes[0].type, "string");
        assert.strictEqual(node0.nodes[1].type, "group");
    });

    it("parse comment", async () => {
        const parser = new RuleParser();
        let rule = parser.Parse("name ::= \"text1\" (* \"some\" \"comment\" * *) \"text3\"")

        assert.strictEqual(rule.length, 1);
        const rule0 = rule[0];
        assert.strictEqual(rule0.root.type, "group");
        const node0 = rule0.root as GroupRuleNode;

        assert.strictEqual(node0.nodes.length, 2);
    });

    it("parse nested alternation", async () => {
        const parser = new RuleParser();
        let rule = parser.Parse("name ::= \"1\" ( \"2\" | \"3\" \"4\" ) | \"5\" ")

        assert.strictEqual(rule.length, 1);
        const rule0 = rule[0];
        assert.strictEqual(rule0.root.type, "alternation");
        const node0 = rule0.root as AlternationRuleNode;

        assert.strictEqual(node0.nodes.length, 2);
        assert.strictEqual(node0.nodes[0].type, "group");
        assert.strictEqual(node0.nodes[1].type, "string");
        const node00 = node0.nodes[0] as GroupRuleNode;
        assert.strictEqual(node00.nodes.length, 2);
        assert.strictEqual(node00.nodes[1].type, "alternation");
        const node01 = node00.nodes[1] as AlternationRuleNode;
        assert.strictEqual(node01.nodes.length, 2);
        assert.strictEqual(node01.nodes[0].type, "string");
        assert.strictEqual(node01.nodes[1].type, "group");
    });
});
