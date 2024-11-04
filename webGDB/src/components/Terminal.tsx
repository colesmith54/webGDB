// src/components/Terminal.tsx

import React, { useState, useEffect, useRef } from "react";
import { TerminalEntry } from "../types";

interface TerminalProps {
  terminalEntries: TerminalEntry[];
  onSendInput: (input: string) => void;
  canInput: boolean;
}

const Terminal: React.FC<TerminalProps> = ({
  terminalEntries,
  onSendInput,
  canInput,
}) => {
  const [input, setInput] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (canInput && inputRef.current) {
      inputRef.current.focus();
    }

    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [terminalEntries, canInput]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canInput) {
      onSendInput(input);
      setInput("");
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    if (!canInput) return;

    const pastedText = e.clipboardData.getData("Text");
    if (pastedText.includes("\n")) {
      e.preventDefault();
      const lines = pastedText.split(/\r?\n/);
      lines.forEach((line) => {
        onSendInput(line);
      });
      setInput("");
    }
  };

  return (
    <div
      className="bg-black text-white h-full rounded-md p-2 overflow-auto font-mono"
      style={{ scrollbarColor: "#4a4a4a black" }}
      onClick={() => canInput && inputRef.current?.focus()}
    >
      <div>
        {terminalEntries.map((entry, index) => {
          let className = "text-white";
          if (entry.type === "input") className = "text-green-500";
          if (entry.type === "error") className = "text-red-500";

          return (
            <pre key={index} className={className}>
              {entry.text.trim() === "" ? "\u00A0" : entry.text}
            </pre>
          );
        })}

        <div className="flex">
          <form onSubmit={handleSubmit} className="flex-grow">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPaste={handlePaste}
              className={`w-full bg-transparent border-none outline-none text-green-500 ${
                canInput
                  ? "caret-green-500"
                  : "caret-transparent opacity-50 cursor-not-allowed"
              }`}
              autoFocus={canInput}
              disabled={!canInput}
              tabIndex={canInput ? 0 : -1}
            />
          </form>
        </div>
        <div ref={terminalEndRef} />
      </div>
    </div>
  );
};

export default Terminal;
