export interface Rule {
    name: string
    root: RuleNode
}

export type RuleNodeType =
    | "string"
    | "character"
    | "group"
    | "option"
    | "repeat"
    | "option"


export interface GroupRuleNode {
    type: "group"
    nodes: RuleNode[]
}

export interface StringRuleNode {
    type: "string"
    text: string
}

export interface CharacterRuleNode {
    type: "character"
    regex: RegExp
}

export interface AlternationRuleNode {
    type: "alternation"
    nodes: RuleNode[]
}

export interface RepeatRuleNode {
    type: "repeat"
    nodes: RuleNode[]
}

export interface OptionRuleNode {
    type: "option"
    nodes: RuleNode[]
}

export interface ReferenceRuleNode {
    type: "reference"
    name: string
}

export type RuleNode =
    | StringRuleNode
    | CharacterRuleNode
    | GroupRuleNode
    | AlternationRuleNode
    | RepeatRuleNode
    | OptionRuleNode
    | ReferenceRuleNode

export interface Rules {
    rules: Rule[]
    rootRule: string
    reservedWords: string[]
}
