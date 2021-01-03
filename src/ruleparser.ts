import { Rule, RuleNode } from "./model/rule"

export class RuleParser {

    public Parse(rulesDoc: string) {
        const lines = rulesDoc.split("\n")
        const rules = [] as Rule[];
        lines.forEach((line, lineNumber) => {
            const rule = this.parseLine(line, lineNumber + 1);
            if (rule) {
                rules.push(rule);
            }
        });
        return rules;
    }


    private parseLine(line: string, lineNumber: number): (Rule | null) {
        const trimmedLine = line.trim();
        if (trimmedLine.length == 0) {
            return null;
        }
        const match = trimmedLine.match(/^([^<>]+)\s*=\s*(\S.*)$/)
        if (!match) {
            throw new Error(`can not parse document line:{$lineNumber}`);
        }
        const name = match[1].trim();
        const fragment = match[2];
        try {
            const r = this.parseAlternationNode(fragment, undefined);
            if (r.fragment.trim()) {
                throw new Error(`can not parse document line:{$lineNumber}`);
            }
            return {
                name: name,
                root: r.node,
            }
        } catch (e) {
            throw new Error(`can not parse document line:{$lineNumber}`);
        }
    }

    private parseAlternationNode(inputFragment: string, closeBracket?: string): { node: RuleNode, fragment: string } {
        const alternations = [[]] as RuleNode[][];
        let nodes = alternations[0] as RuleNode[];
        let fragment = inputFragment;
        while (true) {
            fragment = fragment.trim();
            if (!fragment) {
                break;
            }
            if (fragment.match(/^["']/)) {
                // string
                const r = this.parseStringNode(fragment);
                fragment = r.fragment;
                nodes.push(r.node)
                continue;
            }

            if (fragment.match(/^\/.*\//)) {
                // character
                const r = this.parseCharacterNode(fragment);
                fragment = r.fragment;
                nodes.push(r.node)
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
                const n = fragment.substr(2).search(/[*][)]/)
                fragment = fragment.substr(2 + n + 2);
                continue;
            }

            if (fragment.match(/^[(]/)) {
                // alternation or group
                const r = this.parseAlternationNode(fragment.substr(1), ")");
                nodes.push(r.node);
                fragment = r.fragment;
                continue;
            }

            if (fragment.match(/^[/[]/)) {
                // option
                const r = this.parseAlternationNode(fragment.substr(1), "]");
                nodes.push({
                    type: "option",
                    node: r.node,
                });
                fragment = r.fragment;
                continue;
            }

            if (fragment.match(/^[{]/)) {
                // repeat
                const r = this.parseAlternationNode(fragment.substr(1), "}");
                nodes.push({
                    type: "repeat",
                    node: r.node,
                });
                fragment = r.fragment;
                continue;
            }

            if (fragment.match(/^[)\]}]/)) {
                // close group Node
                if (!closeBracket) {
                    throw new Error("cannot parse");
                }
                if (fragment[0] != closeBracket) {
                    throw new Error("cannot parse");
                }
                fragment = fragment.substr(1);
                break;
            }

        }

        if (alternations.length == 1) {
            if (nodes.length == 1) {
                return {
                    node: nodes[0], fragment
                }
            }
            return {
                node: {
                    type: "group", nodes
                }, fragment
            }
        } else {
            const alternationNodes = alternations.map((nodes): RuleNode => {
                if (nodes.length == 1) {
                    return nodes[0];
                }
                return {
                    type: "group", nodes
                }
            })
            return {
                node: {
                    type: "alternation",
                    nodes: alternationNodes,
                },
                fragment,
            }
        }
    }

    private parseStringNode(fragment: string): { node: RuleNode, fragment: string } {
        let escaped = false;
        let text = "";
        let quote = fragment[0];
        for (let i = 1; i < fragment.length; i++) {
            if (escaped) {
                escaped = false
                switch (fragment[i]) {
                    case "n":
                    case "r":
                        text += "\n"
                        break;
                    default:
                        text += fragment[i]
                }
            } else {
                switch (fragment[i]) {
                    case quote:
                        return {
                            node: {
                                type: "string",
                                text
                            },
                            fragment: fragment.substr(i + 1),
                        }
                        break;
                    case "\\":
                        escaped = true;
                        break;
                    default:
                        text += fragment[i];
                }
            }
        }
        throw new Error("parse error");
    }

    private parseCharacterNode(fragment: string): { node: RuleNode, fragment: string } {
        let escaped = false;
        let text = "";
        for (let i = 1; i < fragment.length; i++) {
            if (escaped) {
                escaped = false
                text += fragment[i]
            } else {
                switch (fragment[i]) {
                    case "/":
                        return {
                            node: {
                                type: "regex",
                                regex: new RegExp(text),
                            },
                            fragment: fragment.substr(i + 1),
                        }
                        break;
                    case "\\":
                        escaped = true;
                        break;
                    default:
                        text += fragment[i];
                }
            }
        }
        throw new Error("parse error");
    }
}
