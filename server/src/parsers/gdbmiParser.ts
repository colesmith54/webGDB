// src/parsers/gdbmiParser.ts

import { ParsedVariable, ParsedGDBMIOutput } from "../types";
import { Tokenizer } from "./tokenizer";
import { Parser } from "./parser";

export class GDBMIParser {
  private rawOutput: string;

  constructor(rawOutput: string) {
    this.rawOutput = rawOutput;
  }

  public parse(): ParsedGDBMIOutput {
    const variables: ParsedVariable[] = [];

    const variablesMatch = this.rawOutput.match(/variables=\[(.*)\]/s);
    if (!variablesMatch) {
      throw new Error("No variables found in the GDB-MI output.");
    }

    const variablesString = variablesMatch[1];
    const varRegex =
      /\{name="([^"\\]*(?:\\.[^"\\]*)*)",value="([^"\\]*(?:\\.[^"\\]*)*)"\}/g;

    let match;
    while ((match = varRegex.exec(variablesString)) !== null) {
      const name = match[1];
      const rawValue = match[2];

      const value = rawValue.replace(/\\"/g, '"').replace(/\\\\/g, "\\");

      try {
        const parsedValue = this.parseValue(value);
        const type = this.inferType(parsedValue);
        variables.push({ name, type, value: parsedValue });
      } catch (error) {
        console.error(
          `Error parsing variable "${name}": ${(error as Error).message}`
        );
        variables.push({ name, type: "unknown", value: null });
      }
    }

    return { done: true, variables };
  }

  private parseValue(value: string): any {
    const tokenizer = new Tokenizer(value);
    const parser = new Parser(tokenizer);
    return parser.parse();
  }

  private inferType(parsedValue: any): string {
    if (parsedValue && parsedValue.type) {
      return parsedValue.type;
    }
    return "unknown";
  }
}
