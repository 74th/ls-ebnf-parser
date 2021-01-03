import { describe, it } from "mocha";
import { RuleParser } from "../../src/ruleparser";
import * as assert from "assert"
import * as fs from "fs/promises";
import { parse } from "path";
import { AlternationRuleNode, RegexRuleNode, GroupRuleNode, StringRuleNode, OptionRuleNode, RepeatRuleNode } from "../../src/model/rule";

describe("parseRules", () => {
    it("parse simple string", async () => {
        const parser = new RuleParser();
        const rule = parser.Parse("name = \"text1\" \"text2\";")

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

    it("parse multiple rules ", async () => {
        const parser = new RuleParser();
        const rule = parser.Parse("name1 = \"text1\"; name2 = \"text2\";")

        assert.strictEqual(rule.length, 2);
        assert.strictEqual(rule[0].name, "name1");
        assert.strictEqual(rule[0].root.type, "string");
        const node0 = rule[0].root as StringRuleNode;
        assert.strictEqual(node0.text, "text1");
        assert.strictEqual(rule[1].name, "name2");
        assert.strictEqual(rule[1].root.type, "string");
        const node1 = rule[1].root as StringRuleNode;
        assert.strictEqual(node1.text, "text2");
    });

    it("parse character node", async () => {
        const parser = new RuleParser();
        const rule = parser.Parse("name = /[0-9]/ /[A-Z]/;")

        assert.strictEqual(rule.length, 1);
        const rule0 = rule[0];
        assert.strictEqual(rule0.root.type, "group");

        const root = rule0.root as GroupRuleNode;
        assert.strictEqual(root.nodes[0].type, "regex")
        const node0 = root.nodes[0] as RegexRuleNode;
        assert.strictEqual(node0.regex.source, "[0-9]")

        assert.strictEqual(root.nodes[1].type, "regex")
        const node1 = root.nodes[1] as RegexRuleNode;
        assert.strictEqual(node1.regex.source, "[A-Z]")
    });

    it("parse simple alternation", async () => {
        const parser = new RuleParser();
        let rule = parser.Parse("name = \"text1\" | \"text2\" \"text3\";")

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
        let rule = parser.Parse("name = \"text1\" (* \"some\" \"comment\" * *) \"text3\"; (* name2 = \"comment\" *)")

        assert.strictEqual(rule.length, 1);
        const rule0 = rule[0];
        assert.strictEqual(rule0.root.type, "group");
        const node0 = rule0.root as GroupRuleNode;

        assert.strictEqual(node0.nodes.length, 2);
    });

    it("parse nested alternation", async () => {
        const parser = new RuleParser();
        let rule = parser.Parse("name = \"1\" ( \"2\" | \"3\" \"4\" ) | \"5\" ;")

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

    it("parse option", async () => {
        const parser = new RuleParser();
        let rule = parser.Parse("name = [ \"1\" \"2\" ] \"3\" [\"4\"] ;")

        assert.strictEqual(rule.length, 1);
        const rule0 = rule[0];
        const rootNode = rule0.root as GroupRuleNode;

        assert.strictEqual(rootNode.nodes.length, 3);
        assert.strictEqual(rootNode.nodes[0].type, "option");
        const node0 = rootNode.nodes[0] as OptionRuleNode;
        assert.strictEqual(node0.node.type, "group");

        assert.strictEqual(rootNode.nodes[2].type, "option");
        const node2 = rootNode.nodes[2] as OptionRuleNode;
        assert.strictEqual(node2.node.type, "string");
    });

    it("parse repeat", async () => {
        const parser = new RuleParser();
        let rule = parser.Parse("name = { \"1\" \"2\" } \"3\" {\"4\"} ;")

        assert.strictEqual(rule.length, 1);
        const rule0 = rule[0];
        const rootNode = rule0.root as GroupRuleNode;

        assert.strictEqual(rootNode.nodes.length, 3);
        assert.strictEqual(rootNode.nodes[0].type, "repeat");
        const node0 = rootNode.nodes[0] as RepeatRuleNode;
        assert.strictEqual(node0.node.type, "group");

        assert.strictEqual(rootNode.nodes[2].type, "repeat");
        const node2 = rootNode.nodes[2] as RepeatRuleNode;
        assert.strictEqual(node2.node.type, "string");
    });

    it("parse error", async () => {
        const parser = new RuleParser();
        try {
            parser.Parse("name \n = \n ; \n \"1\" \n")
            assert.fail();
        }
        catch (e) {
            assert.strictEqual(e.message, "cannot parse lineNumber:3")
        }
    });
});
