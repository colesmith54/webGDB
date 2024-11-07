// src/utils/splitter.ts

export function splitElements(elementsStr: string): string[] {
  const elements: string[] = [];
  let braceDepth = 0;
  let current = "";

  for (let i = 0; i < elementsStr.length; i++) {
    const char = elementsStr[i];
    if (char === "{") {
      braceDepth++;
    } else if (char === "}") {
      braceDepth--;
    }

    if (char === "," && braceDepth === 0) {
      elements.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  if (current) {
    elements.push(current.trim());
  }

  return elements;
}

export function splitEntries(entriesStr: string): string[] {
  const entries: string[] = [];
  let braceDepth = 0;
  let current = "";

  for (let i = 0; i < entriesStr.length; i++) {
    const char = entriesStr[i];
    if (char === "{") {
      braceDepth++;
    } else if (char === "}") {
      braceDepth--;
    }

    if (char === "," && braceDepth === 0) {
      entries.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  if (current) {
    entries.push(current.trim());
  }

  return entries;
}
