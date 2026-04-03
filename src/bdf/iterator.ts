export class LineIterator implements Iterator<string> {
  private _lineNumber = 0;
  private _iterator: Iterator<string>;

  constructor(iter: Iterator<string>) {
    this._iterator = iter;
  }

  get lineNumber(): number {
    return this._lineNumber;
  }

  next(value?: any): IteratorResult<string, any> {
    this._lineNumber++;
    return this._iterator.next(value);
  }

  static from_string(input: string): LineIterator {
    const lines = input.split(/\r?\n/);
    return new LineIterator(lines[Symbol.iterator]());
  }
}
