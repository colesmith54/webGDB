// src/components/Terminal.tsx

import React, { useState, useEffect, useRef } from "react";

interface TerminalProps {
  output?: string;
  error?: string;
  onSendInput: (input: string) => void;
}

const Terminal: React.FC<TerminalProps> = ({ output, error, onSendInput }) => {
  const [input, setInput] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }

    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [output, error]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() !== "") {
      onSendInput(input);
      setInput("");
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData("Text");
    if (pastedText.includes("\n")) {
      e.preventDefault();
      const lines = pastedText.split(/\r?\n/);
      lines.forEach((line) => {
        if (line.trim() !== "") {
          onSendInput(line);
        }
      });
      setInput("");
    }
  };

  return (
    <div
      className="bg-black text-green-500 h-full rounded-md p-2 overflow-auto font-mono"
      style={{ scrollbarColor: "#4a4a4a black" }}
      onClick={() => inputRef.current?.focus()}
    >
      <div>
        <pre>{output || ""}</pre>
        <pre className="text-red-500">{error || ""}</pre>
        <div className="flex">
          <form onSubmit={handleSubmit} className="flex-grow">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPaste={handlePaste}
              className="w-full bg-transparent border-none outline-none text-green-500 caret-green-500"
              autoFocus
            />
          </form>
        </div>
        <div ref={terminalEndRef} />
      </div>
    </div>
  );
};

export default Terminal;
