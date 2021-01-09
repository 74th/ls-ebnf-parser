import { Token } from "./model/ast";
import { Rules, RuleNode, Rule, StringRuleNode, GroupRuleNode, ReferenceRuleNode, AlternationRuleNode } from "./model/rule";
import { Range, Position } from "./model/document";

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
        const rule = this.digRule(this.rootRule, doc, { line: 0, character: 0 });
        const result = rule.next();
        if (!result.done) {
            return result.value.token;
        }
        throw new Error("cannot parse document");
    }

    private *digRule(rule: Rule, doc: TextDocument, startPos: Position): Generator<{ end: Position, token: Token }> {
        const node = this.digNode(rule.root, doc, startPos)
        for (let y = node.next(); !y.done; y = node.next()) {
            const r = y.value;
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
            yield {
                end: r.end,
                token: token,
            }
        }
    }

    private *digNode(node: RuleNode, doc: TextDocument, startPos: Position): Generator<{ end: Position, token: Token }> {
        let iter: Generator<{ end: Position, token: Token }> | null = null;
        if (node.type == "string") {
            iter = this.digStringNode(node, doc, startPos);
        }
        if (node.type == "group") {
            iter = this.digGroupNode(node, doc, startPos);
        }
        if (node.type == "reference") {
            iter = this.digReferenceNode(node, doc, startPos);
        }
        if (node.type == "alternation") {
            iter = this.digAlternationNode(node, doc, startPos);
        }
        if (!iter) {
            return;
        }
        for (let y = iter.next(); !y.done; y = iter.next()) {
            yield y.value;
        }
        return;
    }

    private *digStringNode(node: StringRuleNode, doc: TextDocument, startPos: Position): Generator<{ end: Position, token: Token }> {
        const text = doc.getTextFromPosition(startPos, ReadCharacterLength)
        if (text.startsWith(node.text)) {
            const range = doc.getRangeFromPosition(startPos, node.text.length)
            yield {
                end: range.end,
                token: {
                    range,
                    rule: "",
                    text: node.text,
                    children: [],
                }
            }
        }
    }

    private *digGroupNode(node: GroupRuleNode, doc: TextDocument, startPos: Position): Generator<{ end: Position, token: Token }> {
        const iter = this.digGroupNodeNext(node, 0, doc, startPos);
        for (let y = iter.next(); !y.done; y = iter.next()) {
            const r = y.value;
            const range: Range = { start: startPos, end: r.end };
            yield {
                end: r.end,
                token: {
                    range,
                    rule: "",
                    text: doc.getText(range),
                    children: r.children,
                }
            };
        }
    }

    private *digGroupNodeNext(groupNode: GroupRuleNode, next: number, doc: TextDocument, startPos: Position): Generator<{ end: Position, children: Token[] }> {
        const node = groupNode.nodes[next];
        const iter = this.digNode(node, doc, startPos);
        for (let y = iter.next(); !y.done; y = iter.next()) {
            const child = y.value;
            if (next+1 < groupNode.nodes.length) {
                const iter2 = this.digGroupNodeNext(groupNode, next + 1, doc, child.end);
                for (let y2 = iter2.next(); !y2.done; y2 = iter2.next()) {
                    const nextNode = y2.value;
                    yield {
                        end: nextNode.end,
                        children: [child.token, ...nextNode.children],
                    }
                }
            } else {
                // last node in group
                yield {
                    end: child.end,
                    children: [child.token],
                }
            }
        }
    }

    private digReferenceNode(node: ReferenceRuleNode, doc: TextDocument, startPos: Position): Generator<{ end: Position, token: Token }>{
        const rule = this.rules[node.name];
        return this.digRule(rule, doc, startPos)
    }

    private *digAlternationNode(node: AlternationRuleNode, doc: TextDocument, startPos: Position): Generator<{ end: Position, token: Token } > {
        for (let n = 0; n < node.nodes.length; n++) {
            const iter = this.digNode(node.nodes[n], doc, startPos);
            for (let y = iter.next(); !y.done; y = iter.next()) {
                const child = y.value;
                const range: Range = { start: startPos, end: child.end };
                yield {
                    end: child.end,
                    token: {
                        range,
                        rule: "",
                        text: doc.getText(range),
                        children: [child.token],
                    }
                }

            }
        }
    }
}
