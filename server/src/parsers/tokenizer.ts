// src/parsers/tokenizer.ts

import { TokenType, Token } from "../types";

export class Tokenizer {
  private input: string;
  public position: number;
  public currentChar: string | null;
  private symbols = "{}[]=,<>'\":;";

  constructor(input: string) {
    this.input = input;
    this.position = 0;
    this.currentChar = this.input.charAt(this.position) || null;
  }

  private advance(): void {
    this.position += 1;
    if (this.position >= this.input.length) {
      this.currentChar = null;
    } else {
      this.currentChar = this.input.charAt(this.position);
    }
  }

  private peekChar(): string | null {
    if (this.position + 1 >= this.input.length) {
      return null;
    }
    return this.input.charAt(this.position + 1);
  }

  private skipWhitespace(): void {
    while (this.currentChar && /\s/.test(this.currentChar)) {
      this.advance();
    }
  }

  private string(): string {
    let result = "";
    this.advance();
    while (this.currentChar && this.currentChar !== '"') {
      if (this.currentChar === "\\") {
        this.advance();
        if (this.currentChar) {
          result += this.currentChar;
          this.advance();
        }
      } else {
        result += this.currentChar;
        this.advance();
      }
    }
    this.advance();
    return result;
  }

  private number(): string {
    let result = "";
    if (this.currentChar === "-" || this.currentChar === "+") {
      result += this.currentChar;
      this.advance();
    }
    while (this.currentChar && /[0-9.]/.test(this.currentChar)) {
      result += this.currentChar;
      this.advance();
    }
    return result;
  }

  private identifier(): string {
    let result = "";
    while (this.currentChar && /[a-zA-Z0-9_<>\'_]/.test(this.currentChar)) {
      result += this.currentChar;
      this.advance();
    }
    return result;
  }

  public getNextToken(): Token {
    while (this.currentChar !== null) {
      if (/\s/.test(this.currentChar)) {
        this.skipWhitespace();
        continue;
      }

      if (this.currentChar === "'") {
        this.advance();
        if (this.currentChar) {
          const char = this.currentChar;
          this.advance();
          if (this.currentChar === "'") {
            this.advance();
            return { type: TokenType.Char, value: char };
          } else {
            throw new Error(
              `Invalid character literal at position ${this.getPosition()}`
            );
          }
        } else {
          throw new Error(
            `Invalid character literal at position ${this.getPosition()}`
          );
        }
      }

      if (this.currentChar === '"') {
        const value = this.string();
        return { type: TokenType.String, value };
      }

      if (
        /[0-9]/.test(this.currentChar) ||
        ((this.currentChar === "-" || this.currentChar === "+") &&
          /[0-9]/.test(this.peekChar()))
      ) {
        const value = this.number();
        return { type: TokenType.Number, value };
      }

      if (/[a-zA-Z_]/.test(this.currentChar)) {
        const value = this.identifier();
        return { type: TokenType.Identifier, value };
      }

      if (this.currentChar === ":") {
        if (this.peekChar() === ":") {
          this.advance();
          this.advance();
          return { type: TokenType.Symbol, value: "::" };
        } else {
          this.advance();
          return { type: TokenType.Symbol, value: ":" };
        }
      }

      if (this.symbols.includes(this.currentChar)) {
        const value = this.currentChar;
        this.advance();
        return { type: TokenType.Symbol, value };
      }

      throw new Error(
        `Unknown character: ${
          this.currentChar
        } at position ${this.getPosition()}`
      );
    }

    return { type: TokenType.EOF, value: "" };
  }

  public getPosition(): number {
    return this.position;
  }

  public peekNextToken(): Token {
    const currentPosition = this.position;
    const currentChar = this.currentChar;

    const nextToken = this.getNextToken();

    this.position = currentPosition;
    this.currentChar = currentChar;

    return nextToken;
  }
}
