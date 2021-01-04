import { Token } from "./model/ast";
import { Rules } from "./model/rule";

export class Parser {
    private rules: Rules;
    constructor(rules: Rules) {
        this.rules = rules;
    }

    ParseFullDocument(doc: string): Token {
        return {
            children: [],
            start: 0,
            end: 0,
            rule: "",
            text: "",
        };
    }
}
