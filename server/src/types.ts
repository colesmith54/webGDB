// src/types.ts

export interface ExecutionResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
  error?: string;
}
