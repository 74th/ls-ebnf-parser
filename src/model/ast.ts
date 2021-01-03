export interface Token {
    rule: string;
    text: string;
    children: Token[];
    start: number;
    end: number;
}