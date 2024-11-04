// src/types.ts

export interface ProgramOutput {
  output: string;
}

export interface ProgramError {
  error: string;
}

export interface Variable {
  name: string;
  value: any;
}

export interface StackFrame {
  func: string;
  line: number;
  addr: string;
}

export interface DebugStoppedData {
  line: number;
  stk: StackFrame[];
  vars: Variable[];
}

export type TerminalEntry = {
  type: "input" | "output" | "error";
  text: string;
};
