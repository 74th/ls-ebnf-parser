export interface Position {
    character: number,
    line: number,
}

export interface Range {
    start: Position,
    end: Position,
}
