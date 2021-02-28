import {Token} from './model/ast';
import {
    Rules,
    RuleNode,
    Rule,
    StringRuleNode,
    GroupRuleNode,
    ReferenceRuleNode,
    AlternationRuleNode,
    OptionRuleNode,
    RepeatRuleNode,
    RegexRuleNode,
} from './model/rule';
import {Range, Position} from './model/document';

type digNodeIter = Generator<{end: Position; token: Token}>;

class TextDocument {
    private lines: string[];
    constructor() {
        this.lines = [''];
    }

    updateFullDocument(text: string) {
        this.lines = text.split('\n');
    }

    getText(range: Range): string {
        if (range.end.line < range.start.line) {
            throw new Error('invalid range');
        }
        if (
            range.end.line == range.start.line &&
            range.end.character < range.start.character
        ) {
            throw new Error('invalid range');
        }
        if (this.lines.length <= range.start.line) {
            return '';
        }
        if (range.start.line == range.end.line) {
            return this.lines[range.start.line].substring(
                range.start.character,
                range.end.character
            );
        }
        let text = '';
        if (this.lines[range.start.line].length > range.start.character) {
            text += this.lines[range.start.line].substr(range.start.character);
        }
        for (
            let l = range.start.line + 1;
            l < this.lines.length && l < range.end.line;
            l++
        ) {
            text += '\n' + this.lines[l];
        }
        if (this.lines.length > range.end.line) {
            return text;
        }
        text += this.lines[range.end.line].substr(0, range.end.character);
        return text;
    }
    getTextFromPosition(position: Position, length: number): string {
        if (this.lines.length <= position.line) {
            return '';
        }
        let text = this.lines[position.line].substr(position.character, length);
        if (text.length == length) {
            return text;
        }
        for (let l = position.line + 1; l < this.lines.length; l++) {
            text += '\n';
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
                start: eof,
                end: eof,
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
                    },
                };
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
                    },
                };
            }
            if (rest <= this.lines[l].length) {
                return {
                    start,
                    end: {
                        line: l,
                        character: rest,
                    },
                };
            }
            rest -= this.lines[l].length;
        }
        return {
            start,
            end: {
                line: this.lines.length - 1,
                character: this.lines[this.lines.length - 1].length,
            },
        };
    }
}

const ReadCharacterLength = 1000;

export class Parser {
    public rules: {[index: string]: Rule};
    public tokenExcludeRules: {[index: string]: boolean};
    public reservedWords: {[index: string]: boolean};
    public rootRule: Rule;

    constructor(rules: Rules) {
        this.rules = {};
        rules.rules.forEach(rule => {
            this.rules[rule.name] = rule;
        });
        this.reservedWords = {};
        rules.reservedWords.forEach(word => {
            this.reservedWords[word] = true;
        });
        this.tokenExcludeRules = {};
        rules.tokenExcludeRules.forEach(name => {
            this.tokenExcludeRules[name] = true;
        });
        this.rootRule = this.rules[rules.rootRule];
    }

    public ParseFullDocument(text: string): Token {
        const doc = new TextDocument();
        doc.updateFullDocument(text);
        const rule = this.digRule(this.rootRule, doc, {line: 0, character: 0});
        const result = rule.next();
        if (!result.done) {
            return result.value.token;
        }
        throw new Error('cannot parse document');
    }

    private *digRule(
        rule: Rule,
        doc: TextDocument,
        startPos: Position
    ): digNodeIter {
        const node = this.digNode(rule.root, doc, startPos);
        for (let y = node.next(); !y.done; y = node.next()) {
            const r = y.value;
            const token: Token = {
                range: {
                    start: startPos,
                    end: r.end,
                },
                children: r.token.children,
                text: '',
                rule: rule.name,
            };
            token.text = doc.getText(token.range);
            if (r.token.rule) {
                // Reference Node
                token.children = [r.token];
            }
            if (this.tokenExcludeRules[rule.name]) {
                token.rule = '';
            }
            yield {
                end: r.end,
                token: token,
            };
        }
    }

    private *digNode(
        node: RuleNode,
        doc: TextDocument,
        startPos: Position
    ): digNodeIter {
        let iter: Generator<{end: Position; token: Token}> | null = null;
        switch (node.type) {
            case 'string':
                iter = this.digStringNode(node, doc, startPos);
                break;
            case 'regex':
                iter = this.digRegexNode(node, doc, startPos);
                break;
            case 'group':
                iter = this.digGroupNode(node, doc, startPos);
                break;
            case 'reference':
                iter = this.digReferenceNode(node, doc, startPos);
                break;
            case 'alternation':
                iter = this.digAlternationNode(node, doc, startPos);
                break;
            case 'option':
                iter = this.digOptionNode(node, doc, startPos);
                break;
            case 'repeat':
                iter = this.digRepeatNode(node, doc, startPos);
                break;
            default:
                return;
        }
        for (let y = iter.next(); !y.done; y = iter.next()) {
            yield y.value;
        }
        return;
    }

    private *digStringNode(
        node: StringRuleNode,
        doc: TextDocument,
        startPos: Position
    ): digNodeIter {
        const text = doc.getTextFromPosition(startPos, ReadCharacterLength);
        if (text.startsWith(node.text)) {
            const range = doc.getRangeFromPosition(startPos, node.text.length);
            yield {
                end: range.end,
                token: {
                    range,
                    rule: '',
                    text: node.text,
                    children: [],
                },
            };
        }
    }

    private *digRegexNode(
        node: RegexRuleNode,
        doc: TextDocument,
        startPos: Position
    ): digNodeIter {
        if (!node.regexp) {
            node.regexp = new RegExp(node.regex);
        }
        const text = doc.getTextFromPosition(startPos, ReadCharacterLength);
        const r = node.regexp.exec(text);
        if (r) {
            const range = doc.getRangeFromPosition(startPos, r[0].length);
            yield {
                end: range.end,
                token: {
                    range,
                    rule: '',
                    text: '',
                    children: [],
                },
            };
        }
    }

    private *digGroupNode(
        node: GroupRuleNode,
        doc: TextDocument,
        startPos: Position
    ): digNodeIter {
        let children: Token[] = [];
        const iters: {iter: digNodeIter; nPrevChildren: number}[] = [];
        let iter = this.digNode(node.nodes[0], doc, startPos);
        for (;;) {
            const r = iter.next();
            if (!r.done) {
                if (iters.length + 1 == node.nodes.length) {
                    // last node
                    const range: Range = {start: startPos, end: r.value.end};
                    let c: Token[];
                    if (r.value.token.rule) {
                        c = [...children, r.value.token];
                    } else {
                        c = [...children, ...r.value.token.children];
                    }
                    yield {
                        end: r.value.end,
                        token: {
                            range,
                            rule: '',
                            text: doc.getText(range),
                            children: c,
                        },
                    };
                    continue;
                }

                iters.push({iter, nPrevChildren: children.length});
                if (r.value.token.rule) {
                    children.push(r.value.token);
                } else {
                    children.push(...r.value.token.children);
                }
                iter = this.digNode(node.nodes[iters.length], doc, r.value.end);
                continue;
            }

            const p = iters.pop();
            if (!p) {
                return;
            }
            iter = p.iter;
            children = children.slice(0, p.nPrevChildren);
        }
    }

    private digReferenceNode(
        node: ReferenceRuleNode,
        doc: TextDocument,
        startPos: Position
    ): digNodeIter {
        const rule = this.rules[node.name];
        return this.digRule(rule, doc, startPos);
    }

    private *digAlternationNode(
        node: AlternationRuleNode,
        doc: TextDocument,
        startPos: Position
    ): digNodeIter {
        for (let n = 0; n < node.nodes.length; n++) {
            const iter = this.digNode(node.nodes[n], doc, startPos);
            for (let y = iter.next(); !y.done; y = iter.next()) {
                const child = y.value;
                const range: Range = {start: startPos, end: child.end};
                let children: Token[];
                if (child.token.rule) {
                    children = [child.token];
                } else {
                    children = child.token.children;
                }
                yield {
                    end: child.end,
                    token: {
                        range,
                        rule: '',
                        text: doc.getText(range),
                        children,
                    },
                };
            }
        }
    }

    private *digOptionNode(
        node: OptionRuleNode,
        doc: TextDocument,
        startPos: Position
    ): digNodeIter {
        const iter = this.digNode(node.node, doc, startPos);

        for (let y = iter.next(); !y.done; y = iter.next()) {
            const child = y.value;
            const range: Range = {start: startPos, end: child.end};
            let children: Token[];
            if (child.token.rule) {
                children = [child.token];
            } else {
                children = child.token.children;
            }
            yield {
                end: child.end,
                token: {
                    range,
                    rule: '',
                    text: doc.getText(range),
                    children,
                },
            };
        }
        yield {
            end: startPos,
            token: {
                range: {start: startPos, end: startPos},
                rule: '',
                text: '',
                children: [],
            },
        };
    }

    private *digRepeatNode(
        node: RepeatRuleNode,
        doc: TextDocument,
        startPos: Position
    ): digNodeIter {
        let iter = this.digNode(node.node, doc, startPos);
        let children: Token[] = [];
        const iters: {
            iter: digNodeIter;
            nPrevChildren: number;
            end: Position;
        }[] = [];
        for (;;) {
            const r = iter.next();
            if (!r.done) {
                const nPrevChildren = children.length;
                if (r.value.token.rule) {
                    children.push(r.value.token);
                } else {
                    children.push(...r.value.token.children);
                }
                iters.push({
                    iter,
                    nPrevChildren: nPrevChildren,
                    end: r.value.end,
                });

                iter = this.digNode(node.node, doc, r.value.end);
                continue;
            }

            const prev = iters.pop();
            if (!prev) {
                return;
            }
            const range = {start: startPos, end: prev.end};
            yield {
                end: prev.end,
                token: {
                    range,
                    rule: '',
                    text: doc.getText(range),
                    children: [...children],
                },
            };

            iter = prev.iter;
            children = children.slice(0, prev.nPrevChildren);
        }
    }
}
