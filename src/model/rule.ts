export interface Rule {
    name: string
    root: RuleNode
}

export type RuleNodeType =
    | "string"
    | "list"
    | "or"
    | "plus"
    | "question"


export interface ListRuleNode {
    type: "list"
    nodes: RuleNode[]
}

export interface StringRuleNode {
    type: "string"
    text: string
}

export interface OrRuleNode {
    type: "or"
    nodes: RuleNode[]
}

export interface PlusRuleNode {
    type: "plus"
    nodes: RuleNode[]
}

export interface QuestionRuleNode {
    type: "question"
    nodes: RuleNode[]
}

export interface ReferenceRuleNode {
    type: "reference"
    name: string
}

export type RuleNode =
    | StringRuleNode
    | ListRuleNode
    | OrRuleNode
    | PlusRuleNode
    | QuestionRuleNode
    | ReferenceRuleNode

export interface Rules {
    rules: Rule[]
    rootRule: string
    reservedWords: string[]
}
