// src/parsers/variableParser.ts

export function inferTypeFromValue(value: any): string {
  if (typeof value === "object" && value !== null) {
    if ("first" in value && "second" in value) {
      const [firstType, secondType] = inferPairTypes(value);
      return `pair<${firstType}, ${secondType}>`;
    }
    return "struct";
  }

  if (typeof value === "string") {
    value = value.trim();
  } else {
    value = String(value);
  }

  const primitiveType = inferPrimitiveType(value);
  if (primitiveType) {
    return primitiveType;
  }

  if (value.startsWith("std::array") || value.includes("_M_elems =")) {
    const elementType = inferArrayElementType(value);
    return `array<${elementType}>`;
  }

  if (value.startsWith("{first")) {
    const [keyType, valueType] = inferPairTypes(value);
    return `pair<${keyType}, ${valueType}>`;
  }

  const containerType = getContainerType(value);
  if (containerType) {
    const handler = containerTypeHandlers[containerType];
    if (handler) {
      return handler(value);
    } else {
      const elementType = inferElementType(value);
      return `${containerType}<${elementType}>`;
    }
  }

  if (value.startsWith("{") && value.endsWith("}")) {
    const elementType = inferElementType(value);
    return elementType !== "unknown" ? `${elementType}[]` : "struct";
  }

  return "unknown";
}

function inferPrimitiveType(value: string): string | undefined {
  if (/^-?\d+$/.test(value)) {
    return "int";
  }
  if (/^-?\d+\.\d+(e[+-]?\d+)?$/.test(value)) {
    return "double";
  }
  if (/^\d+\s+'.'$/.test(value) || /^'.'$/.test(value)) {
    return "char";
  }
  if (/^".*"$/.test(value)) {
    return "string";
  }

  return undefined;
}

function getContainerType(value: string): string | undefined {
  for (const pattern of stlContainerPatterns) {
    if (pattern.regex.test(value)) {
      return pattern.type;
    }
  }
  return undefined;
}

function inferElementType(value: string): string {
  const firstElementValue = extractFirstElementValue(value);
  return firstElementValue ? inferTypeFromValue(firstElementValue) : "unknown";
}

function inferArrayElementType(value: string): string {
  const elemsMatch = value.match(/_M_elems\s*=\s*({[\s\S]*})/);
  if (!elemsMatch) {
    return "unknown";
  }
  const elementsStr = elemsMatch[1];
  const elements = extractWithinBraces(elementsStr);
  const elementList = splitElements(elements);

  if (elementList.length === 0) {
    return "unknown";
  }

  const firstElement = elementList[0];
  return inferTypeFromValue(firstElement);
}

function inferSetElementType(value: string): string {
  const firstElementValue = extractFirstElementValue(value);
  if (!firstElementValue) {
    return "unknown";
  }

  let valueStr = firstElementValue;
  const equalIndex = firstElementValue.indexOf("=");
  if (equalIndex >= 0) {
    valueStr = firstElementValue.slice(equalIndex + 1).trim();
  } else {
    valueStr = firstElementValue.trim();
  }

  return inferTypeFromValue(valueStr);
}

function inferMapTypes(value: string): [string, string] {
  const match = value.match(/=\s*(\{[\s\S]*\})$/);
  if (!match) {
    return ["unknown", "unknown"];
  }
  const elementsStr = extractWithinBraces(match[1]);
  const pairs = splitElements(elementsStr);

  if (pairs.length === 0) {
    return ["unknown", "unknown"];
  }

  const firstPair = pairs[0];
  const equalIndex = firstPair.indexOf("=");
  if (equalIndex >= 0) {
    let key = firstPair.slice(0, equalIndex).trim();
    key = cleanString(key);
    if (key.startsWith("[") && key.endsWith("]")) {
      key = key.substring(1, key.length - 1).trim();
    }
    key = key.replace(/\\(.)/g, "$1");
    const keyType = inferTypeFromValue(key);

    let value = firstPair.slice(equalIndex + 1).trim();
    const valueType = inferTypeFromValue(value);

    return [keyType, valueType];
  }

  return ["unknown", "unknown"];
}

function inferTupleElementTypes(value: string): string[] {
  const match = value.match(/=\s*(\{[\s\S]*\})$/);
  if (!match) {
    return [];
  }

  const elementsStr = extractWithinBraces(match[1]);
  const regex = /\[\d+\]\s*=\s*(.+?)(?=,\s*\[\d+\]\s*=|$)/g;
  const types: string[] = [];
  let matchItem;

  while ((matchItem = regex.exec(elementsStr)) !== null) {
    const elementValue = matchItem[1].trim();
    const elementType = inferTypeFromValue(elementValue);
    types.push(elementType);
  }

  return types;
}

function inferPairTypes(value: string): [string, string] {
  const innerStr = extractWithinBraces(value);
  const keyValuePairs = parseKeyValuePairs(innerStr);

  if (keyValuePairs && "first" in keyValuePairs && "second" in keyValuePairs) {
    const firstType = inferTypeFromValue(keyValuePairs["first"]);
    const secondType = inferTypeFromValue(keyValuePairs["second"]);

    return [firstType, secondType];
  }

  return ["unknown", "unknown"];
}

export function parseVariables(varsStr: string): string[] {
  const variables: string[] = [];
  let current = "";
  let braceLevel = 0;
  let inQuotes = false;

  for (let i = 0; i < varsStr.length; i++) {
    const char = varsStr[i];

    if (char === '"') {
      let backslashCount = 0;
      let j = i - 1;
      while (j >= 0 && varsStr[j] === "\\") {
        backslashCount++;
        j--;
      }
      if (backslashCount % 2 === 0) {
        inQuotes = !inQuotes;
      }
    }

    if (!inQuotes) {
      if (char === "{") {
        braceLevel++;
      } else if (char === "}") {
        braceLevel--;
      }
    }

    if (char === "," && braceLevel === 0 && !inQuotes) {
      if (current.trim()) {
        variables.push(current.trim());
        current = "";
      }
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    variables.push(current.trim());
  }

  return variables;
}

function extractWithinBraces(str: string): string {
  let braceLevel = 0;
  let inQuotes = false;
  let content = "";
  let started = false;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const prevChar = str[i - 1] || "";

    if (char === '"' && prevChar !== "\\") {
      inQuotes = !inQuotes;
    }

    if (char === "{" && !inQuotes) {
      braceLevel++;
      if (braceLevel === 1) {
        started = true;
        continue;
      }
    } else if (char === "}" && !inQuotes) {
      braceLevel--;
      if (braceLevel === 0) {
        break;
      }
    }

    if (started) {
      content += char;
    }
  }

  return content.trim();
}

function extractFirstElementValue(value: string): string | undefined {
  const match = value.match(/=\s*(\{[\s\S]*\})$/);
  let elementsStr = "";
  if (match) {
    elementsStr = match[1];
  } else {
    const braceIndex = value.indexOf("{");
    if (braceIndex !== -1) {
      elementsStr = value.substring(braceIndex);
    } else {
      return undefined;
    }
  }

  const elements = extractWithinBraces(elementsStr);
  const elementList = splitElements(elements);

  if (elementList.length === 0) {
    return undefined;
  }

  const firstElement = elementList[0];

  let valueStr = firstElement;
  const equalIndex = firstElement.indexOf("=");
  if (equalIndex >= 0) {
    valueStr = firstElement.slice(equalIndex + 1).trim();
  }

  return valueStr;
}

function splitElements(str: string): string[] {
  const elements: string[] = [];
  let current = "";
  let braceLevel = 0;
  let bracketLevel = 0;
  let inQuotes = false;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const prevChar = str[i - 1] || "";

    if (char === '"' && prevChar !== "\\") {
      inQuotes = !inQuotes;
    }

    if (!inQuotes) {
      if (char === "{") {
        braceLevel++;
      } else if (char === "}") {
        braceLevel--;
      } else if (char === "[") {
        bracketLevel++;
      } else if (char === "]") {
        bracketLevel--;
      }
    }

    if (char === "," && braceLevel === 0 && bracketLevel === 0 && !inQuotes) {
      if (current.trim()) {
        elements.push(current.trim());
        current = "";
      }
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    elements.push(current.trim());
  }

  return elements;
}

function parseKeyValuePairs(str: string): Record<string, any> | any[] {
  let isArray = true;
  const obj: Record<string, any> = {};
  const pairs = splitElements(str);

  pairs.forEach((pair) => {
    const equalIndex = pair.indexOf("=");
    if (equalIndex >= 0) {
      let key = pair.slice(0, equalIndex).trim();
      let value = pair.slice(equalIndex + 1).trim();

      key = cleanString(key);
      if (key.startsWith("[") && key.endsWith("]")) {
        key = key.substring(1, key.length - 1).trim();
      }
      key = key.replace(/\\(.)/g, "$1");
      value = parseValue(value.trim());

      if (!/^\d+$/.test(key.trim())) {
        isArray = false;
      }

      obj[key.trim()] = value;
    } else {
      const element = parseValue(pair.trim());
      obj[element] = element;
      isArray = false;
    }
  });

  if (isArray) {
    const arr = [];
    const keys = Object.keys(obj).sort((a, b) => parseInt(a) - parseInt(b));
    for (const key of keys) {
      arr.push(obj[key]);
    }
    return arr;
  } else {
    return obj;
  }
}

export function parseValue(valueStr: string): any {
  if (typeof valueStr !== "string") {
    return valueStr;
  }

  valueStr = valueStr.trim();
  valueStr = valueStr.replace(/\\(.)/g, "$1");

  if (valueStr.length === 0) {
    return valueStr;
  }

  if (/^-?\d+$/.test(valueStr)) {
    return parseInt(valueStr, 10);
  }
  if (/^-?\d+\.\d+(e[+-]?\d+)?$/.test(valueStr)) {
    return parseFloat(valueStr);
  }
  if (/^\d+\s+'.'$/.test(valueStr)) {
    const charMatch = valueStr.match(/'.'/);
    return charMatch ? `'${charMatch[0].charAt(1)}'` : `"${valueStr}"`;
  }
  if (/^'.'$/.test(valueStr)) {
    return `'${valueStr.charAt(1)}'`;
  }
  if (/^".*"$/.test(valueStr)) {
    return `'${cleanString(valueStr)}'`;
  }

  const containerType = getContainerType(valueStr);
  if (containerType) {
    const handler = parseContainerHandlers[containerType];
    return handler ? handler(valueStr) : valueStr;
  }

  if (valueStr.startsWith("{") && valueStr.endsWith("}")) {
    const innerStr = extractWithinBraces(valueStr);
    return innerStr.includes("=")
      ? parseKeyValuePairs(innerStr)
      : splitElements(innerStr).map(parseValue);
  }

  if (valueStr.startsWith("{first")) {
    const innerStr = extractWithinBraces(valueStr);
    return parseKeyValuePairs(innerStr);
  }

  return valueStr;
}

function cleanString(str: string): string {
  if (
    (str.startsWith('"') && str.endsWith('"')) ||
    (str.startsWith("'") && str.endsWith("'"))
  ) {
    str = str.substring(1, str.length - 1);
  }
  return str.replace(/\\(.)/g, "$1");
}

export function extractKeyValue(
  varStr: string
): { name: string; value: string; type: string } | null {
  const nameMatch = varStr.match(/name="((?:\\.|[^"\\])*)"/);
  const valueMatch = varStr.match(/value="((?:\\.|[^"\\])*)"/);

  if (nameMatch && valueMatch) {
    const name = cleanString(nameMatch[1]);
    const value = cleanString(valueMatch[1]);

    const correctedValue = value.replace(/\\'/g, "'");

    const type = inferTypeFromValue(correctedValue);
    return { name, value: correctedValue, type };
  }

  return null;
}

const stlContainerPatterns = [
  { regex: /^std::.*priority_queue/, type: "priority_queue" },
  { regex: /^std::.*forward_list/, type: "forward_list" },
  { regex: /^std::.*list/, type: "list" },
  { regex: /^std::.*stack/, type: "stack" },
  { regex: /^std::.*queue/, type: "queue" },
  { regex: /^std::.*deque/, type: "deque" },
  { regex: /^std::.*array/, type: "array" },
  { regex: /^std::.*unordered_multiset/, type: "unordered_multiset" },
  { regex: /^std::.*multiset/, type: "multiset" },
  { regex: /^std::.*unordered_set/, type: "unordered_set" },
  { regex: /^std::.*set/, type: "set" },
  { regex: /^std::.*unordered_multimap/, type: "unordered_multimap" },
  { regex: /^std::.*multimap/, type: "multimap" },
  { regex: /^std::.*unordered_map/, type: "unordered_map" },
  { regex: /^std::.*map/, type: "map" },
  { regex: /^std::.*tuple/, type: "tuple" },
  { regex: /^std::.*vector/, type: "vector" },
];

const containerTypeHandlers: { [key: string]: (value: string) => string } = {
  vector: (value) => `vector<${inferElementType(value)}>`,
  list: (value) => `list<${inferElementType(value)}>`,
  deque: (value) => `deque<${inferElementType(value)}>`,
  array: (value) => `array<${inferArrayElementType(value)}>`,
  forward_list: (value) => `forward_list<${inferElementType(value)}>`,
  set: (value) => `set<${inferSetElementType(value)}>`,
  unordered_set: (value) => `unordered_set<${inferSetElementType(value)}>`,
  multiset: (value) => `multiset<${inferSetElementType(value)}>`,
  unordered_multiset: (value) =>
    `unordered_multiset<${inferSetElementType(value)}>`,
  map: (value) => {
    const [keyType, valueType] = inferMapTypes(value);
    return `map<${keyType}, ${valueType}>`;
  },
  unordered_map: (value) => {
    const [keyType, valueType] = inferMapTypes(value);
    return `unordered_map<${keyType}, ${valueType}>`;
  },
  multimap: (value) => {
    const [keyType, valueType] = inferMapTypes(value);
    return `multimap<${keyType}, ${valueType}>`;
  },
  unordered_multimap: (value) => {
    const [keyType, valueType] = inferMapTypes(value);
    return `unordered_multimap<${keyType}, ${valueType}>`;
  },
  stack: (value) => `stack<${inferElementType(value)}>`,
  queue: (value) => `queue<${inferElementType(value)}>`,
  priority_queue: (value) => `priority_queue<${inferElementType(value)}>`,
  tuple: (value) => `tuple<${inferTupleElementTypes(value).join(", ")}>`,
};

const parseContainerHandlers: { [key: string]: (value: string) => any } = {
  vector: parseSequenceContainer,
  list: parseSequenceContainer,
  deque: parseSequenceContainer,
  forward_list: parseSequenceContainer,
  array: parseArrayContainer,
  set: parseAssociativeContainer,
  unordered_set: parseAssociativeContainer,
  multiset: parseAssociativeContainer,
  unordered_multiset: parseAssociativeContainer,
  map: parseMapContainer,
  unordered_map: parseMapContainer,
  multimap: parseMapContainer,
  unordered_multimap: parseMapContainer,
  stack: parseNestedContainer,
  queue: parseNestedContainer,
  priority_queue: parseSequenceContainer,
  tuple: parseTupleContainer,
};

function parseSequenceContainer(valueStr: string): any[] {
  const match = valueStr.match(/=\s*({[\s\S]*})$/);
  if (match) {
    const elementsStr = match[1];
    const elements = extractWithinBraces(elementsStr);
    return splitElements(elements).map(parseValue);
  }
  return [];
}

function parseArrayContainer(valueStr: string): any[] {
  const elemsMatch = valueStr.match(/_M_elems\s*=\s*{([\s\S]*)}$/);
  if (elemsMatch) {
    const elements = extractWithinBraces(elemsMatch[0]);
    return splitElements(elements).map(parseValue);
  }
  return [];
}

function parseAssociativeContainer(valueStr: string): any[] {
  const match = valueStr.match(/=\s*({[\s\S]*})$/);
  if (match) {
    const elementsStr = match[1];
    const elements = extractWithinBraces(elementsStr);
    const pairs = splitElements(elements);
    return pairs.map((pair) => {
      const equalIndex = pair.indexOf("=");
      if (equalIndex >= 0) {
        const valueStr = pair.slice(equalIndex + 1).trim();
        return parseValue(valueStr);
      } else {
        return parseValue(pair);
      }
    });
  }
  return [];
}

function parseMapContainer(valueStr: string): any {
  const match = valueStr.match(/=\s*({[\s\S]*})$/);
  if (match) {
    const elementsStr = match[1];
    const elements = extractWithinBraces(elementsStr);
    return parseKeyValuePairs(elements);
  }
  return {};
}

function parseNestedContainer(valueStr: string): any {
  const innerStr = valueStr.split("wrapping:")[1];
  return innerStr ? parseValue(innerStr.trim()) : valueStr;
}

function parseTupleContainer(valueStr: string): any[] {
  const match = valueStr.match(/=\s*({[\s\S]*})$/);
  if (match) {
    const elementsStr = match[1];
    const elements = extractWithinBraces(elementsStr);
    const tuple: any[] = [];
    const regex = /\[\d+\]\s*=\s*(.+?)(?=,\s*\[\d+\]\s*=|$)/g;
    let matchItem;
    while ((matchItem = regex.exec(elements)) !== null) {
      tuple.push(parseValue(matchItem[1].trim()));
    }
    return tuple;
  }
  return [];
}
