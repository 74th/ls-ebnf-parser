export interface Rule {
    name: string;
    root: RuleNode;
}

export type RuleNodeType =
    | 'string'
    | 'regex'
    | 'group'
    | 'option'
    | 'repeat'
    | 'option';

export interface GroupRuleNode {
    type: 'group';
    nodes: RuleNode[];
}

export interface StringRuleNode {
    type: 'string';
    text: string;
}

export interface RegexRuleNode {
    type: 'regex';
    regex: string;
    regexp?: RegExp;
}

export interface AlternationRuleNode {
    type: 'alternation';
    nodes: RuleNode[];
}

export interface RepeatRuleNode {
    type: 'repeat';
    node: RuleNode;
}

export interface OptionRuleNode {
    type: 'option';
    node: RuleNode;
}

export interface ReferenceRuleNode {
    type: 'reference';
    name: string;
}

export type RuleNode =
    | StringRuleNode
    | RegexRuleNode
    | GroupRuleNode
    | AlternationRuleNode
    | RepeatRuleNode
    | OptionRuleNode
    | ReferenceRuleNode;

export interface Rules {
    rules: Rule[];
    rootRule: string;
    reservedWords: string[];
    tokenExcludeRules: string[];
}
