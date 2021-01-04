import { Rule, RuleNode, Rules } from "./model/rule";

class parseError extends Error {
    public fragmentSize: number;
    constructor(message: string, fragmentSize: number) {
        super(message);
        this.fragmentSize = fragmentSize;
    }
}

export class RuleParser {

    public Parse(rulesDoc: string, reservedWords: string[]): Rules {
        const referencedNames = [] as string[];
        let fragment = rulesDoc;
        const rules = [] as Rule[];
        try {
            for (; ;) {
                const r = this.parseRule(fragment, referencedNames);
                if (r) {
                    rules.push(r.rule);
                    fragment = r.fragment;
                    continue;
                }
                break;
            }
        } catch (e) {
            if (e instanceof parseError) {
                const lineNumber = rulesDoc
                    .substr(0, rulesDoc.length - e.fragmentSize)
                    .split("\n").length;
                throw new Error(`${e.message} lineNumber:${lineNumber}`);
            }
            throw e;
        }
        this.checkReferences(rules, referencedNames);
        return {
            rules: rules,
            rootRule: rules[0].name,
            reservedWords: reservedWords
        };
    }

    private parseRule(
        inputFragment: string,
        referenceNames: string[],
    ): { rule: Rule; fragment: string } | null {
        let fragment = inputFragment.trimStart();
        for (; ;) {
            if (fragment.length == 0) {
                return null;
            }

            if (fragment.match(/^[(][*]/)) {
                // comment
                const n = fragment.substr(2).search(/[*][)]/);
                fragment = fragment.substr(2 + n + 2);
                continue;
            }
            break;
        }

        const match = fragment.match(/^([\w]+)\s*=/);
        if (!match) {
            throw new parseError("can not parse document", fragment.length);
        }
        const name = match[1].trimStart();
        fragment = fragment.substr(match[0].length);
        const r = this.parseAlternationNode(fragment, ";", referenceNames);
        return {
            rule: {
                name: name,
                root: r.node,
            },
            fragment: r.fragment,
        };
    }

    private parseAlternationNode(
        inputFragment: string,
        closeBracket: string,
        referenceNames: string[],
    ): { node: RuleNode; fragment: string } {
        const alternations = [[]] as RuleNode[][];
        let nodes = alternations[0] as RuleNode[];
        let fragment = inputFragment;
        for (; ;) {
            fragment = fragment.trimStart();
            if (!fragment) {
                break;
            }
            if (fragment.match(/^["']/)) {
                // string
                const r = this.parseStringNode(fragment);
                fragment = r.fragment;
                nodes.push(r.node);
                continue;
            }

            if (fragment.match(/^\/.*\//)) {
                // regex
                const r = this.parseCharacterNode(fragment);
                fragment = r.fragment;
                nodes.push(r.node);
                continue;
            }

            if (fragment.match(/^\w/)) {
                // reference
                const r = this.parseReferenceNode(fragment, referenceNames);
                fragment = r.fragment;
                nodes.push(r.node);
                continue;
            }

            if (fragment.match(/^,/)) {
                // concatenation
                fragment = fragment.substr(1);
                continue;
            }

            if (fragment.match(/^[|]/)) {
                // alternation
                nodes = [];
                alternations.push(nodes);
                fragment = fragment.substr(1);
                continue;
            }

            if (fragment.match(/^[(][*]/)) {
                // comment
                const n = fragment.substr(2).search(/[*][)]/);
                fragment = fragment.substr(2 + n + 2);
                continue;
            }

            if (fragment.match(/^[(]/)) {
                // alternation or group
                const r = this.parseAlternationNode(fragment.substr(1), ")", []);
                nodes.push(r.node);
                fragment = r.fragment;
                continue;
            }

            if (fragment.match(/^[/[]/)) {
                // option
                const r = this.parseAlternationNode(fragment.substr(1), "]", []);
                nodes.push({
                    type: "option",
                    node: r.node,
                });
                fragment = r.fragment;
                continue;
            }

            if (fragment.match(/^[{]/)) {
                // repeat
                const r = this.parseAlternationNode(fragment.substr(1), "}", []);
                nodes.push({
                    type: "repeat",
                    node: r.node,
                });
                fragment = r.fragment;
                continue;
            }

            if (fragment.match(/^[)\]};]/)) {
                // close group Node
                if (!closeBracket) {
                    throw new parseError("cannot parse", fragment.length);
                }
                if (fragment[0] != closeBracket) {
                    throw new parseError("cannot parse", fragment.length);
                }
                fragment = fragment.substr(1);
                break;
            }

        }

        if (alternations.length == 1) {
            if (nodes.length == 0) {
                throw new parseError("cannot parse", fragment.length);
            }
            if (nodes.length == 1) {
                return {
                    node: nodes[0],
                    fragment,
                };
            }
            return {
                node: {
                    type: "group",
                    nodes,
                },
                fragment,
            };
        } else {
            const alternationNodes = alternations.map(
                (nodes): RuleNode => {
                    if (nodes.length == 0) {
                        throw new parseError("cannot parse", fragment.length);
                    }
                    if (nodes.length == 1) {
                        return nodes[0];
                    }
                    return {
                        type: "group",
                        nodes,
                    };
                }
            );
            return {
                node: {
                    type: "alternation",
                    nodes: alternationNodes,
                },
                fragment,
            };
        }
    }

    private parseStringNode(
        fragment: string
    ): { node: RuleNode; fragment: string } {
        let escaped = false;
        let text = "";
        const quote = fragment[0];
        for (let i = 1; i < fragment.length; i++) {
            if (escaped) {
                escaped = false;
                switch (fragment[i]) {
                    case "n":
                    case "r":
                        text += "\n";
                        break;
                    default:
                        text += fragment[i];
                }
            } else {
                switch (fragment[i]) {
                    case quote:
                        return {
                            node: {
                                type: "string",
                                text,
                            },
                            fragment: fragment.substr(i + 1),
                        };
                        break;
                    case "\\":
                        escaped = true;
                        break;
                    default:
                        text += fragment[i];
                }
            }
        }
        throw new parseError("parse error", fragment.length);
    }

    private parseCharacterNode(
        fragment: string
    ): { node: RuleNode; fragment: string } {
        let escaped = false;
        let text = "";
        for (let i = 1; i < fragment.length; i++) {
            if (escaped) {
                escaped = false;
                text += fragment[i];
            } else {
                switch (fragment[i]) {
                    case "/":
                        return {
                            node: {
                                type: "regex",
                                regex: text,
                            },
                            fragment: fragment.substr(i + 1),
                        };
                        break;
                    case "\\":
                        escaped = true;
                        break;
                    default:
                        text += fragment[i];
                }
            }
        }
        throw new parseError("parse error", fragment.length);
    }

    private parseReferenceNode(
        fragment: string,
        referencedNames: string[],
    ): { node: RuleNode; fragment: string } {
        const name = fragment.match(/^\w+/);
        if (!name) {
            throw new Error("implemented error");
        }
        referencedNames.push(name[0]);
        return {
            node: {
                type: "reference",
                name: name[0],
            },
            fragment: fragment.substr(name[0].length),
        }
    }

    private checkReferences(
        rules: Rule[],
        referencedNames: string[],
    ) {
        const ruleNames = {} as { [index: string]: boolean; };
        rules.forEach((rule) => {
            ruleNames[rule.name] = true;
        });
        referencedNames.forEach((name) => {
            if (!ruleNames[name]) {
                throw new Error(`found undefined reference ${name}`);
            }
        });
    }
}
