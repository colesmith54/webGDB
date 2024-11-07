// src/types.ts

export interface ProgramOutput {
  output: string;
}

export interface ProgramError {
  error: string;
}

export interface DebugStoppedData {
  line: number;
  stk: Frame[];
  vars: Variable[];
}

export type TerminalEntry = {
  type: "input" | "output" | "error";
  text: string;
};

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
export interface Variable {
  name: string;
  type: string;
  value: any;
}
