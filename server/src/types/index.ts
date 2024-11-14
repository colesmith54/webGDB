// src/types/index.ts

import { Readable, Writable } from "stream";

export interface GDBControllerOptions {
  stdin: Writable;
  stdout: Readable;
  stderr: Readable;
  file: string;
}

export interface GDBMIResponse {
  token: number | null;
  type: string;
  message: string;
  payload: string | null;
}

export interface ExecutionResult {
  success: boolean;
  error?: string;
  output?: string;
}

export interface Frame {
  level: string;
  addr: string;
  func: string;
  file: string;
  fullname: string;
  line: string;
  arch: string;
}

export type Variable = {
  name: string;
  type: string;
  value: any;
};

export interface ParsedVariable {
  name: string;
  type: string;
  value: any;
}

export interface ParsedGDBMIOutput {
  done: boolean;
  variables: ParsedVariable[];
}

export enum TokenType {
  Identifier,
  String,
  Number,
  Symbol,
  Char,
  EOF,
}

export interface Token {
  type: TokenType;
  value: string;
}
