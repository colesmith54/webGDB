// src/parsers/parser.ts

import { TokenType, Token } from "../types";
import { Tokenizer } from "./tokenizer";

export class Parser {
  private tokenizer: Tokenizer;
  private currentToken: Token;

  constructor(tokenizer: Tokenizer) {
    this.tokenizer = tokenizer;
    this.currentToken = this.tokenizer.getNextToken();
  }

  private eat(type: TokenType, value?: string): void {
    if (
      this.currentToken.type === type &&
      (value === undefined || this.currentToken.value === value)
    ) {
      this.currentToken = this.tokenizer.getNextToken();
    } else {
      throw new Error(
        `Unexpected token: expected ${TokenType[type]} '${value}', got ${
          TokenType[this.currentToken.type]
        } '${
          this.currentToken.value
        }' at position ${this.tokenizer.getPosition()}`
      );
    }
  }

  private readQualifiedName(): string {
    let name = this.currentToken.value;
    this.eat(TokenType.Identifier);

    while (
      this.currentToken.type === TokenType.Symbol &&
      this.currentToken.value === "::"
    ) {
      name += this.currentToken.value;
      this.eat(TokenType.Symbol, "::");

      // @ts-ignore
      if (this.currentToken.type === TokenType.Identifier) {
        name += this.currentToken.value;
        this.eat(TokenType.Identifier);
      } else {
        throw new Error(`Expected identifier after '::'`);
      }
    }

    return name;
  }

  public parse(): any {
    return this.parseValue();
  }

  private parseValue(): any {
    if (this.currentToken.type === TokenType.Identifier) {
      const qualifiedName = this.readQualifiedName();
      switch (qualifiedName) {
        case "std::unordered_map":
          return this.parseUnorderedMap();
        case "std::unordered_set":
          return this.parseUnorderedSet();
        case "std::vector":
          return this.parseVector();
        case "std::list":
        case "std::__cxx11::list":
          return this.parseList();
        case "std::forward_list":
          return this.parseForwardList();
        case "std::deque":
          return this.parseDeque();
        case "std::pair":
        case "pair":
          return this.parsePair();
        case "std::tuple":
          return this.parseTuple();
        case "std::set":
          return this.parseSet();
        case "std::map":
          return this.parseMap();
        case "std::stack":
          return this.parseStack();
        case "std::priority_queue":
          return this.parsePriorityQueue();
        default:
          return qualifiedName;
      }
    } else if (
      this.currentToken.type === TokenType.Symbol &&
      this.currentToken.value === "{"
    ) {
      const savedPosition = this.tokenizer.getPosition();
      const savedChar = this.tokenizer.currentChar;

      this.eat(TokenType.Symbol, "{");
      const potentialEqualToken = this.tokenizer.peekNextToken();

      if (
        potentialEqualToken.type === TokenType.Symbol &&
        potentialEqualToken.value === "="
      ) {
        return this.parseComposite();
      } else {
        this.tokenizer.position = savedPosition;
        this.tokenizer.currentChar = savedChar;
        this.currentToken = { type: TokenType.Symbol, value: "{" };

        return this.parseArray();
      }
    } else if (this.currentToken.type === TokenType.String) {
      const value = this.currentToken.value;
      this.eat(TokenType.String);
      return { type: "string", value: value };
    } else if (this.currentToken.type === TokenType.Number) {
      const numberValue = parseFloat(this.currentToken.value);
      this.eat(TokenType.Number);

      // @ts-ignore
      if (this.currentToken.type === TokenType.Char) {
        const charValue = this.currentToken.value;
        this.eat(TokenType.Char);
        return { type: "char", value: charValue };
      }

      return { type: "number", value: numberValue };
    } else if (this.currentToken.type === TokenType.Char) {
      const value = this.currentToken.value;
      this.eat(TokenType.Char);
      return { type: "char", value: value };
    } else {
      throw new Error(`Unexpected token in value: ${this.currentToken.value}`);
    }
  }

  private parseArray(): any {
    this.eat(TokenType.Symbol, "{");
    const elems: any[] = [];

    while (
      !(
        this.currentToken.type === TokenType.Symbol &&
        this.currentToken.value === "}"
      )
    ) {
      const elem = this.parseValue();
      elems.push(elem);

      if (
        this.currentToken.type === TokenType.Symbol &&
        this.currentToken.value === ","
      ) {
        this.eat(TokenType.Symbol, ",");
      }
    }

    this.eat(TokenType.Symbol, "}");

    return { type: "array", value: elems };
  }

  private parseUnorderedMap(): any {
    const typeDescription = this.parseTypeDescription();
    const size = this.extractSize(typeDescription, "element");

    if (
      this.currentToken.type === TokenType.Symbol &&
      this.currentToken.value === "="
    ) {
      this.eat(TokenType.Symbol, "=");
      this.eat(TokenType.Symbol, "{");

      const map: Record<string, any> = {};

      while (
        !(
          this.currentToken.type === TokenType.Symbol &&
          // @ts-ignore
          this.currentToken.value === "}"
        )
      ) {
        this.eat(TokenType.Symbol, "[");
        const key = this.parseValue();
        this.eat(TokenType.Symbol, "]");

        this.eat(TokenType.Symbol, "=");

        const value = this.parseValue();

        const serializedKey =
          typeof key === "object" ? JSON.stringify(key) : key.toString();

        map[serializedKey] = value;

        if (
          this.currentToken.type === TokenType.Symbol &&
          // @ts-ignore
          this.currentToken.value === ","
        ) {
          this.eat(TokenType.Symbol, ",");
        }
      }

      this.eat(TokenType.Symbol, "}");

      return { type: "std::unordered_map", size, value: map };
    } else {
      return { type: "std::unordered_map", size, value: {} };
    }
  }

  private parseMap(): any {
    const typeDescription = this.parseTypeDescription();
    const size = this.extractSize(typeDescription, "element");

    if (
      this.currentToken.type === TokenType.Symbol &&
      this.currentToken.value === "="
    ) {
      this.eat(TokenType.Symbol, "=");
      this.eat(TokenType.Symbol, "{");

      const map: Record<string, any> = {};

      while (
        !(
          this.currentToken.type === TokenType.Symbol &&
          // @ts-ignore
          this.currentToken.value === "}"
        )
      ) {
        this.eat(TokenType.Symbol, "[");
        const key = this.parseValue();
        this.eat(TokenType.Symbol, "]");

        this.eat(TokenType.Symbol, "=");

        const value = this.parseValue();

        const serializedKey =
          typeof key === "object" ? JSON.stringify(key) : key.toString();

        map[serializedKey] = value;

        if (
          this.currentToken.type === TokenType.Symbol &&
          // @ts-ignore
          this.currentToken.value === ","
        ) {
          this.eat(TokenType.Symbol, ",");
        }
      }

      this.eat(TokenType.Symbol, "}");

      return { type: "std::map", size, value: map };
    } else {
      return { type: "std::map", size, value: {} };
    }
  }

  private parseVector(): any {
    const typeDescription = this.parseTypeDescription();
    const { length, capacity } = this.extractLengthCapacity(typeDescription);

    if (
      this.currentToken.type === TokenType.Symbol &&
      this.currentToken.value === "="
    ) {
      this.eat(TokenType.Symbol, "=");
      this.eat(TokenType.Symbol, "{");

      const items: any[] = [];

      while (
        !(
          this.currentToken.type === TokenType.Symbol &&
          // @ts-ignore
          this.currentToken.value === "}"
        )
      ) {
        const item = this.parseValue();
        items.push(item);

        if (
          this.currentToken.type === TokenType.Symbol &&
          // @ts-ignore
          this.currentToken.value === ","
        ) {
          this.eat(TokenType.Symbol, ",");
        }
      }

      this.eat(TokenType.Symbol, "}");

      return {
        type: "std::vector",
        length: length,
        capacity: capacity,
        value: items,
      };
    } else {
      return {
        type: "std::vector",
        length: length,
        capacity: capacity,
        value: [],
      };
    }
  }

  private parseList(): any {
    const typeDescription = this.parseTypeDescription();

    if (
      this.currentToken.type === TokenType.Symbol &&
      this.currentToken.value === "="
    ) {
      this.eat(TokenType.Symbol, "=");
      this.eat(TokenType.Symbol, "{");

      const list: any[] = [];

      while (
        !(
          this.currentToken.type === TokenType.Symbol &&
          // @ts-ignore
          this.currentToken.value === "}"
        )
      ) {
        this.eat(TokenType.Symbol, "[");
        const index = parseInt(this.currentToken.value, 10);
        this.eat(TokenType.Number);
        this.eat(TokenType.Symbol, "]");
        this.eat(TokenType.Symbol, "=");

        const value = this.parseValue();
        list[index] = value;

        if (
          this.currentToken.type === TokenType.Symbol &&
          // @ts-ignore
          this.currentToken.value === ","
        ) {
          this.eat(TokenType.Symbol, ",");
        }
      }

      this.eat(TokenType.Symbol, "}");

      return { type: "std::list", value: list };
    } else {
      return { type: "std::list", value: [] };
    }
  }

  private parseForwardList(): any {
    const typeDescription = this.parseTypeDescription();

    if (
      this.currentToken.type === TokenType.Symbol &&
      this.currentToken.value === "="
    ) {
      this.eat(TokenType.Symbol, "=");
      this.eat(TokenType.Symbol, "{");

      const forwardList: any[] = [];

      while (
        !(
          this.currentToken.type === TokenType.Symbol &&
          // @ts-ignore
          this.currentToken.value === "}"
        )
      ) {
        this.eat(TokenType.Symbol, "[");
        const index = parseInt(this.currentToken.value, 10);
        this.eat(TokenType.Number);
        this.eat(TokenType.Symbol, "]");
        this.eat(TokenType.Symbol, "=");

        const value = this.parseValue();
        forwardList.push(value);

        if (
          this.currentToken.type === TokenType.Symbol &&
          // @ts-ignore
          this.currentToken.value === ","
        ) {
          this.eat(TokenType.Symbol, ",");
        }
      }

      this.eat(TokenType.Symbol, "}");

      return { type: "std::forward_list", value: forwardList };
    } else {
      return { type: "std::forward_list", value: [] };
    }
  }

  private parseDeque(): any {
    const typeDescription = this.parseTypeDescription();
    const size = this.extractSize(typeDescription, "element");

    if (
      this.currentToken.type === TokenType.Symbol &&
      this.currentToken.value === "="
    ) {
      this.eat(TokenType.Symbol, "=");
      this.eat(TokenType.Symbol, "{");

      const deque: any[] = [];

      while (
        !(
          this.currentToken.type === TokenType.Symbol &&
          // @ts-ignore
          this.currentToken.value === "}"
        )
      ) {
        const item = this.parseValue();
        deque.push(item);

        if (
          this.currentToken.type === TokenType.Symbol &&
          // @ts-ignore
          this.currentToken.value === ","
        ) {
          this.eat(TokenType.Symbol, ",");
        }
      }

      this.eat(TokenType.Symbol, "}");

      return { type: "std::deque", size, value: deque };
    } else {
      return { type: "std::deque", size, value: [] };
    }
  }

  private parsePair(): any {
    this.eat(TokenType.Symbol, "{");
    this.eat(TokenType.Identifier, "first");
    this.eat(TokenType.Symbol, "=");
    const first = this.parseValue();
    this.eat(TokenType.Symbol, ",");
    this.eat(TokenType.Identifier, "second");
    this.eat(TokenType.Symbol, "=");
    const second = this.parseValue();
    this.eat(TokenType.Symbol, "}");
    return { type: "std::pair", first, second };
  }

  private parseTuple(): any {
    const typeDescription = this.parseTypeDescription();

    if (
      this.currentToken.type === TokenType.Symbol &&
      this.currentToken.value === "="
    ) {
      this.eat(TokenType.Symbol, "=");
      this.eat(TokenType.Symbol, "{");

      const tuple: Record<number, any> = {};

      while (
        !(
          this.currentToken.type === TokenType.Symbol &&
          // @ts-ignore
          this.currentToken.value === "}"
        )
      ) {
        this.eat(TokenType.Symbol, "[");
        const index = parseInt(this.currentToken.value, 10);
        this.eat(TokenType.Number);
        this.eat(TokenType.Symbol, "]");
        this.eat(TokenType.Symbol, "=");

        const value = this.parseValue();
        tuple[index] = value;

        if (
          this.currentToken.type === TokenType.Symbol &&
          // @ts-ignore
          this.currentToken.value === ","
        ) {
          this.eat(TokenType.Symbol, ",");
        }
      }

      this.eat(TokenType.Symbol, "}");

      return { type: "std::tuple", value: tuple };
    } else {
      return { type: "std::tuple", value: {} };
    }
  }

  private parseSet(): any {
    const typeDescription = this.parseTypeDescription();
    const size = this.extractSize(typeDescription, "elements");

    if (
      this.currentToken.type === TokenType.Symbol &&
      this.currentToken.value === "="
    ) {
      this.eat(TokenType.Symbol, "=");
      this.eat(TokenType.Symbol, "{");

      const set: any[] = [];

      while (
        !(
          this.currentToken.type === TokenType.Symbol &&
          // @ts-ignore
          this.currentToken.value === "}"
        )
      ) {
        this.eat(TokenType.Symbol, "[");
        const index = parseInt(this.currentToken.value, 10);
        this.eat(TokenType.Number);
        this.eat(TokenType.Symbol, "]");
        this.eat(TokenType.Symbol, "=");

        const value = this.parseValue();
        set.push(value);

        if (
          this.currentToken.type === TokenType.Symbol &&
          // @ts-ignore
          this.currentToken.value === ","
        ) {
          this.eat(TokenType.Symbol, ",");
        }
      }

      this.eat(TokenType.Symbol, "}");

      return { type: "std::set", size, value: set };
    } else {
      return { type: "std::set", size, value: [] };
    }
  }

  private parseUnorderedSet(): any {
    const typeDescription = this.parseTypeDescription();
    const size = this.extractSize(typeDescription, "element");

    if (
      this.currentToken.type === TokenType.Symbol &&
      this.currentToken.value === "="
    ) {
      this.eat(TokenType.Symbol, "=");
      this.eat(TokenType.Symbol, "{");

      const unorderedSet: any[] = [];

      while (
        !(
          this.currentToken.type === TokenType.Symbol &&
          // @ts-ignore
          this.currentToken.value === "}"
        )
      ) {
        this.eat(TokenType.Symbol, "[");
        const index = parseInt(this.currentToken.value, 10);
        this.eat(TokenType.Number);
        this.eat(TokenType.Symbol, "]");
        this.eat(TokenType.Symbol, "=");

        const value = this.parseValue();
        unorderedSet.push(value);

        if (
          this.currentToken.type === TokenType.Symbol &&
          // @ts-ignore
          this.currentToken.value === ","
        ) {
          this.eat(TokenType.Symbol, ",");
        }
      }

      this.eat(TokenType.Symbol, "}");

      return { type: "std::unordered_set", size, value: unorderedSet };
    } else {
      return { type: "std::unordered_set", size, value: [] };
    }
  }

  private parseStack(): any {
    this.eat(TokenType.Identifier, "wrapping");
    this.eat(TokenType.Symbol, ":");
    const wrapped = this.parseValue();
    return { type: "std::stack", wrapped };
  }

  private parsePriorityQueue(): any {
    this.eat(TokenType.Identifier, "wrapping");
    this.eat(TokenType.Symbol, ":");
    const wrapped = this.parseValue();
    return { type: "std::priority_queue", wrapped };
  }

  private parseComposite(): any {
    const composite: any = {};

    while (
      !(
        this.currentToken.type === TokenType.Symbol &&
        this.currentToken.value === "}"
      )
    ) {
      let key;
      if (
        this.currentToken.type === TokenType.Symbol &&
        this.currentToken.value === "["
      ) {
        this.eat(TokenType.Symbol, "[");
        key = this.parseValue();
        this.eat(TokenType.Symbol, "]");
      } else {
        key = this.parseValue();
      }

      const serializedKey =
        typeof key === "object" ? JSON.stringify(key) : key.toString();

      this.eat(TokenType.Symbol, "=");

      const value = this.parseValue();

      composite[serializedKey] = value;

      if (
        this.currentToken.type === TokenType.Symbol &&
        this.currentToken.value === ","
      ) {
        this.eat(TokenType.Symbol, ",");
      } else if (
        this.currentToken.type === TokenType.Symbol &&
        this.currentToken.value === "}"
      ) {
        break;
      } else {
        throw new Error(
          `Expected ',' or '}', got '${
            this.currentToken.value
          }' at position ${this.tokenizer.getPosition()}`
        );
      }
    }

    this.eat(TokenType.Symbol, "}");

    if (
      Object.keys(composite).length === 2 &&
      "first" in composite &&
      "second" in composite
    ) {
      return {
        type: "std::pair",
        first: composite["first"],
        second: composite["second"],
      };
    }

    if ("_M_elems" in composite) {
      return {
        type: "array",
        value: composite["_M_elems"].value,
      };
    }

    return composite;
  }

  private parseTypeDescription(): string {
    let typeDesc = "";
    while (
      !(
        this.currentToken.type === TokenType.Symbol &&
        (this.currentToken.value === "=" ||
          this.currentToken.value === "{" ||
          this.currentToken.value === "}")
      ) &&
      this.currentToken.type !== TokenType.EOF
    ) {
      typeDesc += this.currentToken.value + " ";
      this.eat(this.currentToken.type, this.currentToken.value);
    }
    return typeDesc.trim();
  }

  private extractSize(description: string, keyword: string): number {
    const regex = new RegExp(`(\\d+)\\s+${keyword}`);
    const match = description.match(regex);
    if (match) {
      return parseInt(match[1], 10);
    }
    return 0;
  }

  private extractLengthCapacity(description: string): {
    length: number;
    capacity: number;
  } {
    const lengthMatch = description.match(/length\s+(\d+)/);
    const capacityMatch = description.match(/capacity\s+(\d+)/);
    const length = lengthMatch ? parseInt(lengthMatch[1], 10) : 0;
    const capacity = capacityMatch ? parseInt(capacityMatch[1], 10) : 0;
    return { length, capacity };
  }
}
