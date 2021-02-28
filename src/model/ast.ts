import {Range} from './document';
export interface Token {
    rule: string;
    text: string;
    children: Token[];
    range: Range;
}
