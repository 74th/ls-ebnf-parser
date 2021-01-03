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
        const match = trimmedLine.match(/^<?([^<>\s]+)>?\s*::=\s*(\S.*)$/)
        if (!match) {
            throw new Error(`can not parse document line:{$lineNumber}`);
        }
        const name = match[1];
        const fragment = match[2];
        const r = this.parseListNode(fragment, false);
        if (r.fragment) {
            throw new Error(`can not parse document line:{$lineNumber}`);
        }

        return {
            name: name,
            root: r.node,
        }
    }

    private parseListNode(inputFragment: string, hasOpenBracket: boolean): { node: RuleNode, fragment: string } {
        const nodes = [] as RuleNode[];
        let fragment = inputFragment;
        while (true) {
            fragment = fragment.trim();
            if (!fragment) {
                return {
                    node: {
                        type: "list", nodes
                    },
                    fragment: "",
                }
            }
            if (fragment.match(/^"/)) {
                const r = this.parseStringNode(fragment);
                fragment = r.fragment;
                nodes.push(r.node)
                continue;
            }

        }
    }

    private parseStringNode(fragment: string): { node: RuleNode, fragment: string } {
        let escaped = false;
        let text = "";
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
                    case "\"":
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
}
