// Types for `linebreak` (the Unicode line breaking algorithm, UAX #14), which ships none.
declare module 'linebreak' {
  export default class LineBreaker {
    constructor(text: string);
    nextBreak(): { position: number; required: boolean } | null;
  }
}
