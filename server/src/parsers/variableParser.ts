// src/parsers/variableParser.ts

export function parseVariables(varsStr: string): string[] {
  const variables: string[] = [];
  let current = "";
  let braceLevel = 0;
  let inQuotes = false;

  for (let i = 0; i < varsStr.length; i++) {
    const char = varsStr[i];
    const prevChar = i > 0 ? varsStr[i - 1] : "";

    if (char === '"' && prevChar !== "\\") {
      inQuotes = !inQuotes;
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
    const prevChar = i > 0 ? str[i - 1] : "";

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

function inferTypeFromValue(value: string): string {
  value = value.trim();

  if (/^-?\d+$/.test(value)) {
    return "int";
  }

  if (/^-?\d+\.\d+(e[+-]?\d+)?$/.test(value)) {
    return "double";
  }

  if (/^\d+ '.{1}'$/.test(value) || /^'.'$/.test(value)) {
    return "char";
  }

  if (/^".*"$/.test(value)) {
    return "std::string";
  }

  if (value.startsWith("std::vector")) {
    const elementType = inferElementType(value);
    return `std::vector<${elementType}>`;
  }

  if (value.startsWith("std::__cxx11::list") || value.startsWith("std::list")) {
    const elementType = inferElementType(value);
    return `std::list<${elementType}>`;
  }

  if (value.startsWith("std::deque")) {
    const elementType = inferElementType(value);
    return `std::deque<${elementType}>`;
  }

  if (value.startsWith("std::array")) {
    const elementType = inferElementType(value);
    return `std::array<${elementType}>`;
  }

  if (value.startsWith("std::forward_list")) {
    const elementType = inferElementType(value);
    return `std::forward_list<${elementType}>`;
  }

  if (value.startsWith("std::set") || value.startsWith("std::unordered_set")) {
    const elementType = inferElementType(value);
    return `std::set<${elementType}>`;
  }

  if (
    value.startsWith("std::multiset") ||
    value.startsWith("std::unordered_multiset")
  ) {
    const elementType = inferElementType(value);
    return `std::multiset<${elementType}>`;
  }

  if (value.startsWith("std::map") || value.startsWith("std::unordered_map")) {
    const keyType = inferMapKeyType(value);
    const valueType = inferMapValueType(value);
    return `std::map<${keyType}, ${valueType}>`;
  }

  if (
    value.startsWith("std::multimap") ||
    value.startsWith("std::unordered_multimap")
  ) {
    const keyType = inferMapKeyType(value);
    const valueType = inferMapValueType(value);
    return `std::multimap<${keyType}, ${valueType}>`;
  }

  if (value.startsWith("std::stack")) {
    const elementType = inferElementType(value);
    return `std::stack<${elementType}>`;
  }

  if (value.startsWith("std::queue")) {
    const elementType = inferElementType(value);
    return `std::queue<${elementType}>`;
  }

  if (value.startsWith("std::priority_queue")) {
    const elementType = inferElementType(value);
    return `std::priority_queue<${elementType}>`;
  }

  if (value.startsWith("std::tuple")) {
    const elementTypes = inferTupleElementTypes(value);
    return `std::tuple<${elementTypes.join(", ")}>`;
  }

  if (value.startsWith("{first")) {
    const keyValueTypes = inferPairTypes(value);
    return `std::pair<${keyValueTypes[0]}, ${keyValueTypes[1]}>`;
  }

  if (value.startsWith("{") && value.endsWith("}")) {
    return "struct";
  }

  return "unknown";
}

function inferElementType(value: string): string {
  const match = value.match(/=\s*(\{[\s\S]*\})$/);
  let elementsStr = "";
  if (match) {
    elementsStr = match[1];
  } else {
    const braceIndex = value.indexOf("{");
    if (braceIndex !== -1) {
      elementsStr = value.substring(braceIndex);
    } else {
      return "unknown";
    }
  }

  const elements = extractWithinBraces(elementsStr);
  const elementList = splitElements(elements).map(parseValue);

  if (elementList.length === 0) {
    return "unknown";
  }

  const firstElement = elementList[0];

  return inferPrimitiveType(firstElement);
}

function inferPrimitiveType(value: any): string {
  if (typeof value === "number") {
    if (Number.isInteger(value)) {
      return "int";
    } else {
      return "double";
    }
  }

  if (typeof value === "string") {
    if (value.length === 1) {
      return "char";
    } else {
      return "std::string";
    }
  }

  if (Array.isArray(value)) {
    const nestedType = inferElementType(JSON.stringify(value));
    return `std::vector<${nestedType}>`;
  }

  if (typeof value === "object" && value !== null) {
    return "struct";
  }

  return "unknown";
}

function inferMapKeyType(value: string): string {
  const match = value.match(/=\s*(\{[\s\S]*\})$/);
  if (!match) {
    return "unknown";
  }
  const elementsStr = extractWithinBraces(match[1]);
  const pairs = splitElements(elementsStr);

  if (pairs.length === 0) {
    return "unknown";
  }

  const firstPair = pairs[0];
  const equalIndex = firstPair.indexOf("=");
  if (equalIndex >= 0) {
    let key = firstPair.slice(0, equalIndex).trim();

    key = key.replace(/^\[|\]$/g, "").replace(/^["']|["']$/g, "");

    const parsedKey = parseValue(key);
    return inferPrimitiveType(parsedKey);
  }

  return "unknown";
}

function inferMapValueType(value: string): string {
  const match = value.match(/=\s*(\{[\s\S]*\})$/);
  if (!match) {
    return "unknown";
  }
  const elementsStr = extractWithinBraces(match[1]);
  const pairs = splitElements(elementsStr);

  if (pairs.length === 0) {
    return "unknown";
  }

  const firstPair = pairs[0];
  const equalIndex = firstPair.indexOf("=");
  if (equalIndex >= 0) {
    let val = firstPair.slice(equalIndex + 1).trim();
    const parsedVal = parseValue(val);
    return inferPrimitiveType(parsedVal);
  }

  return "unknown";
}

function inferPairTypes(value: string): [string, string] {
  const innerStr = extractWithinBraces(value);
  const keyValuePairs = parseKeyValuePairs(innerStr);
  const keys = Object.keys(keyValuePairs);

  if (keys.includes("first") && keys.includes("second")) {
    const firstType = inferPrimitiveType(keyValuePairs["first"]);
    const secondType = inferPrimitiveType(keyValuePairs["second"]);
    return [firstType, secondType];
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
    const elementValue = parseValue(matchItem[1].trim());
    const elementType = inferPrimitiveType(elementValue);
    types.push(elementType);
  }

  return types;
}

export function extractKeyValue(
  varStr: string
): { name: string; value: string; type: string } | null {
  const nameMatch = varStr.match(/name="((?:\\.|[^"\\])*)"/);
  const valueMatch = varStr.match(/value="((?:\\.|[^"\\])*)"/);

  if (nameMatch && valueMatch) {
    const name = nameMatch[1].replace(/\\(.)/g, "$1");
    const value = valueMatch[1].replace(/\\(.)/g, "$1");
    const type = inferTypeFromValue(value);
    return { name, value, type };
  }

  return null;
}

function splitElements(str: string): string[] {
  const elements: string[] = [];
  let current = "";
  let braceLevel = 0;
  let bracketLevel = 0;
  let inQuotes = false;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const prevChar = i > 0 ? str[i - 1] : "";

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

      key = key.replace(/\\(.)/g, "$1");

      if (key.startsWith("[") && key.endsWith("]")) {
        key = key.substring(1, key.length - 1).trim();
      }

      if (
        (key.startsWith('"') && key.endsWith('"')) ||
        (key.startsWith("'") && key.endsWith("'"))
      ) {
        key = key.substring(1, key.length - 1);
      }

      value = parseValue(value.trim());

      if (!/^\d+$/.test(key.trim())) {
        isArray = false;
      }

      obj[key.trim()] = value;
    } else {
      console.warn(`Could not parse key-value pair: ${pair}`);
      const element = parseValue(pair.trim());
      obj[element] = element;
      isArray = false;
    }
  });

  if (isArray) {
    const arr = [];
    const keys = Object.keys(obj);
    keys.sort((a, b) => parseInt(a) - parseInt(b));
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
    console.warn(`parseValue received non-string value: ${valueStr}`);
    return valueStr;
  }

  valueStr = valueStr.trim();

  if (valueStr.length === 0) {
    return valueStr;
  }

  if (/^-?\d+$/.test(valueStr)) {
    return parseInt(valueStr, 10);
  }

  if (/^-?\d+\.\d+(e[+-]?\d+)?$/.test(valueStr)) {
    return parseFloat(valueStr);
  }

  if (/^\d+ '.{1}'$/.test(valueStr)) {
    const charMatch = valueStr.match(/'.{1}'$/);
    return charMatch ? charMatch[0].charAt(1) : valueStr;
  }

  if (/^'.'$/.test(valueStr)) {
    return valueStr.charAt(1);
  }

  if (/^".*"$/.test(valueStr)) {
    const unescaped = valueStr.slice(1, -1).replace(/\\(.)/g, "$1");
    return unescaped;
  }

  if (valueStr.startsWith("std::vector")) {
    const match = valueStr.match(/=\s*({[\s\S]*})$/);
    if (match) {
      const elementsStr = match[1];
      const elements = extractWithinBraces(elementsStr);
      return splitElements(elements).map(parseValue);
    }
    return [];
  }

  if (
    valueStr.startsWith("std::__cxx11::list") ||
    valueStr.startsWith("std::list")
  ) {
    const match = valueStr.match(/=\s*({[\s\S]*})$/);
    if (match) {
      const elementsStr = match[1];
      const elements = extractWithinBraces(elementsStr);
      const keyValuePairs = parseKeyValuePairs(elements);
      return keyValuePairs;
    }
    return [];
  }

  if (valueStr.startsWith("std::deque")) {
    const match = valueStr.match(/=\s*({[\s\S]*})$/);
    if (match) {
      const elementsStr = match[1];
      const elements = extractWithinBraces(elementsStr);
      return splitElements(elements).map(parseValue);
    }
    return [];
  }

  if (valueStr.startsWith("std::array")) {
    const elemsMatch = valueStr.match(/_M_elems\s*=\s*{([\s\S]*)}$/);
    if (elemsMatch) {
      const elements = extractWithinBraces(elemsMatch[0]);
      return splitElements(elements).map(parseValue);
    }
    return [];
  }

  if (valueStr.startsWith("std::forward_list")) {
    const match = valueStr.match(/=\s*({[\s\S]*})$/);
    if (match) {
      const elementsStr = match[1];
      const elements = extractWithinBraces(elementsStr);
      const keyValuePairs = parseKeyValuePairs(elements);
      return keyValuePairs;
    }
    return [];
  }

  if (
    valueStr.startsWith("std::set") ||
    valueStr.startsWith("std::unordered_set")
  ) {
    const match = valueStr.match(/=\s*({[\s\S]*})$/);
    if (match) {
      const elementsStr = match[1];
      const elements = extractWithinBraces(elementsStr);
      const pairs = splitElements(elements);
      const values = pairs.map((pair) => {
        const equalIndex = pair.indexOf("=");
        if (equalIndex >= 0) {
          const valueStr = pair.slice(equalIndex + 1).trim();
          return parseValue(valueStr);
        } else {
          return parseValue(pair);
        }
      });
      return values;
    }
    return [];
  }

  if (
    valueStr.startsWith("std::multiset") ||
    valueStr.startsWith("std::unordered_multiset")
  ) {
    const match = valueStr.match(/=\s*({[\s\S]*})$/);
    if (match) {
      const elementsStr = match[1];
      const elements = extractWithinBraces(elementsStr);
      const pairs = splitElements(elements);
      const values = pairs.map((pair) => {
        const equalIndex = pair.indexOf("=");
        if (equalIndex >= 0) {
          const valueStr = pair.slice(equalIndex + 1).trim();
          return parseValue(valueStr);
        } else {
          return parseValue(pair);
        }
      });
      return values;
    }
    return [];
  }

  if (
    valueStr.startsWith("std::map") ||
    valueStr.startsWith("std::unordered_map")
  ) {
    const match = valueStr.match(/=\s*({[\s\S]*})$/);
    if (match) {
      const elementsStr = match[1];
      const elements = extractWithinBraces(elementsStr);
      const obj = parseKeyValuePairs(elements);
      return obj;
    }
    return {};
  }

  if (
    valueStr.startsWith("std::multimap") ||
    valueStr.startsWith("std::unordered_multimap")
  ) {
    const match = valueStr.match(/=\s*({[\s\S]*})$/);
    if (match) {
      const elementsStr = match[1];
      const elements = extractWithinBraces(elementsStr);
      const multiMap: Record<string, any[]> = {};
      const pairs = splitElements(elements);
      pairs.forEach((pair) => {
        const equalIndex = pair.indexOf("=");
        if (equalIndex >= 0) {
          let key = pair.slice(0, equalIndex).trim();
          let value = pair.slice(equalIndex + 1).trim();

          key = key.replace(/\\(.)/g, "$1");

          if (key.startsWith("[") && key.endsWith("]")) {
            key = key.substring(1, key.length - 1).trim();
          }

          if (
            (key.startsWith('"') && key.endsWith('"')) ||
            (key.startsWith("'") && key.endsWith("'"))
          ) {
            key = key.substring(1, key.length - 1);
          }

          value = parseValue(value.trim());

          if (!multiMap[key]) {
            multiMap[key] = [];
          }
          multiMap[key].push(value);
        } else {
          console.warn(`Could not parse key-value pair: ${pair}`);
        }
      });
      return multiMap;
    }
    return {};
  }

  if (valueStr.startsWith("std::stack")) {
    const innerStr = valueStr.split("wrapping:")[1];
    return parseValue(innerStr.trim());
  }

  if (valueStr.startsWith("std::queue")) {
    const innerStr = valueStr.split("wrapping:")[1];
    return parseValue(innerStr.trim());
  }

  if (valueStr.startsWith("std::priority_queue")) {
    const match = valueStr.match(/=\s*({[\s\S]*})$/);
    if (match) {
      const elementsStr = match[1];
      const elements = extractWithinBraces(elementsStr);
      return splitElements(elements).map(parseValue);
    }
    return [];
  }

  if (valueStr.startsWith("{") && valueStr.endsWith("}")) {
    const innerStr = extractWithinBraces(valueStr);
    if (innerStr.includes("=")) {
      const keyValuePairs = parseKeyValuePairs(innerStr);
      if (
        Object.keys(keyValuePairs).length === 1 &&
        "_M_elems" in keyValuePairs
      ) {
        return keyValuePairs["_M_elems"];
      }
      return keyValuePairs;
    } else {
      return splitElements(innerStr).map(parseValue);
    }
  }

  if (valueStr.startsWith("{first")) {
    const innerStr = extractWithinBraces(valueStr);
    const keyValuePairs = parseKeyValuePairs(innerStr);
    return keyValuePairs;
  }

  if (valueStr.startsWith("std::tuple")) {
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

  return valueStr;
}
