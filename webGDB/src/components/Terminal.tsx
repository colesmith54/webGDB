// src/components/Terminal.tsx

import React from "react";

interface TerminalProps {
  output?: string;
}

const Terminal: React.FC<TerminalProps> = ({ output, error }) => {
  return (
    <div className="bg-black text-green-500 h-full rounded-md p-2 overflow-auto font-mono">
      <pre>{output || ""}</pre>
      <pre className="text-red-500">{error || ""}</pre>
    </div>
  );
};

export default Terminal;
