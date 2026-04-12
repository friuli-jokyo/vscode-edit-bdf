export class ParseError extends Error {
  constructor(line: number, message: string) {
    super(`Parse error at line ${line}: ${message}`);
    this.name = "ParseError";
  }
}

export class Warning {
  constructor(line: number, message: string) {
    this.line = line;
    this.message = message;
  }

  line: number;
  message: string;
}
