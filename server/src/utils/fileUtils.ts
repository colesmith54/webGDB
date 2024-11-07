// src/utils/fileUtils.ts

import fs from "fs";
import path from "path";

export const CODE_DIR = path.resolve(__dirname, "../../code");

export function ensureCodeDirExists(): void {
  if (!fs.existsSync(CODE_DIR)) {
    fs.mkdirSync(CODE_DIR, { recursive: true });
  }
}

export function saveCodeToFile(code: string, filename: string): string {
  const filepath = path.join(CODE_DIR, filename);
  fs.writeFileSync(filepath, code, { encoding: "utf-8" });
  return filepath;
}

export function deleteFile(filepath: string): void {
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
  }
}
