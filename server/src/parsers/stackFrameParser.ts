// src/parsers/stackFrameParser.ts

import { Frame } from "../types";

export function parseStackFrames(framesStr: string): Frame[] {
  const frameRegex = /{([^}]+)}/g;
  const frames: Frame[] = [];
  let match;

  while ((match = frameRegex.exec(framesStr)) !== null) {
    const frameStr = match[1];
    const frameObj: any = {};
    const keyValueRegex = /(\w+)="([^"]*)"/g;
    let kvMatch;
    while ((kvMatch = keyValueRegex.exec(frameStr)) !== null) {
      frameObj[kvMatch[1]] = kvMatch[2];
    }
    frames.push(frameObj as Frame);
  }

  return frames;
}
