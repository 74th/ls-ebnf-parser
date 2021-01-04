import { Token } from "./model/ast";
import { Rules, RuleNode, Rule, StringRuleNode, GroupRuleNode, ReferenceRuleNode, AlternationRuleNode } from "./model/rule";
import { Range, Position } from "./model/document";
import { isConstructorDeclaration } from "typescript";

class TextDocument {
    private lines: string[];
    constructor() {
        this.lines = [""];
    }

    updateFullDocument(text: string) {
        this.lines = text.split("\n")
    }

    getText(range: Range): string {
        if (range.end.line < range.start.line) {
            throw new Error("invalid range");
        }
        if (range.end.line == range.start.line && range.end.character < range.start.character) {
            throw new Error("invalid range");
        }
        if (this.lines.length <= range.start.line) {
            return "";
        }
        if (range.start.line == range.end.line) {
            return this.lines[range.start.line].substring(range.start.character, range.end.character);
        }
        let text = "";
        if (this.lines[range.start.line].length > range.start.character) {
            text += this.lines[range.start.line].substr(range.start.character);
        }
        for (let l = range.start.line + 1; l < this.lines.length && l < range.end.line; l++) {
            text += "\n" + this.lines[l];
        }
        if (this.lines.length > range.end.line) {
            return text
        }
        text += this.lines[range.end.line].substr(0, range.end.character);
        return text
    }
    getTextFromPosition(position: Position, length: number): string {
        if (this.lines.length <= position.line) {
            return "";
        }
        let text = this.lines[position.line].substr(position.character, length);
        if (text.length == length) {
            return text;
        }
        for (let l = position.line + 1; l < this.lines.length; l++) {
            text += "\n";
            if (text.length == length) {
                break;
            }
            text += this.lines[l].substring(0, length - text.length);
            if (text.length == length) {
                break;
            }
        }
        return text;
    }

    getRangeFromPosition(start: Position, length: number): Range {
        if (this.lines.length <= start.line) {
            const eof: Position = {
                line: this.lines.length - 1,
                character: this.lines[this.lines.length - 1].length,
            };
            return {
                start: eof, end: eof,
            };
        }
        let rest = length;
        if (this.lines[start.line].length > start.character) {
            if (this.lines[start.line].length - start.character > rest) {
                return {
                    start,
                    end: {
                        line: start.line,
                        character: start.character + rest,
                    }
                }
            }
            rest -= this.lines[start.line].length - start.character;
        }
        for (let l = start.line + 1; l < this.lines.length; l++) {
            rest -= 1;
            if (rest == 0) {
                return {
                    start,
                    end: {
                        line: l,
                        character: 0,
                    }
                }
            }
            if (rest <= this.lines[l].length) {
                return {
                    start,
                    end: {
                        line: l,
                        character: rest,
                    }
                }
            }
            rest -= this.lines[l].length;
        }
        return {
            start,
            end: {
                line: this.lines.length - 1,
                character: this.lines[this.lines.length - 1].length,
            }
        }
    }
}

const ReadCharacterLength = 1000;

export class Parser {

    public rules: { [index: string]: Rule; };
    public tokenExcludeRules: { [index: string]: boolean; };
    public reservedWords: { [index: string]: boolean; };
    public rootRule: Rule;

    constructor(rules: Rules) {
        this.rules = {};
        rules.rules.forEach((rule) => {
            this.rules[rule.name] = rule;
        });
        this.reservedWords = {};
        rules.reservedWords.forEach((word) => {
            this.reservedWords[word] = true;
        });
        this.tokenExcludeRules = {};
        rules.tokenExcludeRules.forEach((name) => {
            this.tokenExcludeRules[name] = false;
        });
        this.rootRule = this.rules[rules.rootRule];
    }

    public ParseFullDocument(text: string): Token {
        const doc = new TextDocument();
        doc.updateFullDocument(text);
        const result = this.digRule(this.rootRule, doc, { line: 0, character: 0 });
        if (result) {
            return result.token;
        }
        throw new Error("cannot parse document");
    }

    private digRule(rule: Rule, doc: TextDocument, startPos: Position): ({ end: Position, token: Token } | null) {
        const r = this.digNode(rule.root, doc, startPos)
        if (!r) {
            return null;
        }
        const token: Token = {
            range: {
                start: startPos,
                end: r.end,
            },
            children: r.token.children,
            text: "",
            rule: rule.name,
        };
        token.text = doc.getText(token.range);
        if (r.token.rule) {
            // Reference Node
            token.children = [r.token]
        }
        if (this.tokenExcludeRules[rule.name]) {
            token.rule = "";
        }
        return {
            end: r.end,
            token: token,
        }
    }

    private digNode(node: RuleNode, doc: TextDocument, startPos: Position): ({ end: Position, token: Token } | null) {
        if (node.type == "string") {
            return this.digStringNode(node, doc, startPos);
        }
        if (node.type == "group") {
            return this.digGroupNode(node, doc, startPos);
        }
        if (node.type == "reference") {
            return this.digReferenceNode(node, doc, startPos);
        }
        if (node.type == "alternation") {
            return this.digReferenceNode(node, doc, startPos);
        }
        return null;
    }

    private digStringNode(node: StringRuleNode, doc: TextDocument, startPos: Position): ({ end: Position, token: Token } | null) {
        const text = doc.getTextFromPosition(startPos, ReadCharacterLength)
        if (text.startsWith(node.text)) {
            const range = doc.getRangeFromPosition(startPos, node.text.length)
            return {
                end: range.end,
                token: {
                    range,
                    rule: "",
                    text: node.text,
                    children: [],
                }
            }
        }
        return null;
    }

    private digGroupNode(node: GroupRuleNode, doc: TextDocument, startPos: Position): ({ end: Position, token: Token } | null) {
        let pos = startPos;
        const children = [] as Token[];
        for (let n = 0; n < node.nodes.length; n++) {
            const r = this.digNode(node.nodes[n], doc, pos);
            if (!r) {
                return null;
            }
            if (r.token.rule) {
                children.push(r.token);
            } else {
                children.push(...r.token.children)
            }
            pos = r.end;
        }
        const range: Range = { start: startPos, end: pos };

        return {
            end: pos,
            token: {
                range,
                rule: "",
                text: doc.getText(range),
                children: children,
            }
        };
    }

    private digReferenceNode(node: ReferenceRuleNode, doc: TextDocument, startPos: Position): ({ end: Position, token: Token } | null) {
        const rule = this.rules[node.name];
        return this.digRule(rule, doc, startPos)
    }

    private digAlternationNode(node: AlternationRuleNode, doc: TextDocument, startPos: Position): ({ end: Position, token: Token } | null) {
        let pos = startPos;
        const children = [] as Token[];
        for (let n = 0; n < node.nodes.length; n++) {
            const r = this.digNode(node.nodes[n], doc, pos);
            if (r) {
                // TODO: this is right?
                // optionやrepeat、alternationも、可能性あるものを全部返す。すると、end違いとかもでてくる。
                // 上位の検査では、全てのケースをテストしなければならない。
                return {
                }
                if (r.token.rule) {
                    children.push(r.token);
                } else {
                    children.push(...r.token.children)
                }
                pos = r.end;
            }
        }
        const range: Range = { start: startPos, end: pos };

        return {
            end: pos,
            token: {
                range,
                rule: "",
                text: doc.getText(range),
                children: children,
            }
        };
    }
}
i
