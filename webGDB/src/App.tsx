// src/App.tsx

import React, { useRef, useState } from "react";
import CodeEditor from "./components/CodeEditor";
import Terminal from "./components/Terminal";
import socket from "./socket";
import { useSocket } from "./hooks/useSocket";

const App: React.FC = () => {
  const codeEditorRef = useRef<any>(null);
  const [terminalOutput, setTerminalOutput] = useState<string>("");

  const handleProgramOutput = (data: { output: string }) => {
    setTerminalOutput(data.output);
  };

  const handleProgramError = (data: { error: string }) => {
    setTerminalOutput(data.error);
  };

  useSocket({
    onProgramOutput: handleProgramOutput,
    onProgramError: handleProgramError,
  });

  const handleCompile = () => {
    if (codeEditorRef.current) {
      const code = codeEditorRef.current.getCode();
      socket.emit("codeSubmission", { code });
      setTerminalOutput("// Compiling and executing...");
    }
  };

  return (
    <div className="flex h-screen">
      <div className="w-1/2 border-r">
        <CodeEditor ref={codeEditorRef} />
      </div>

      <div className="w-1/2 flex flex-col">
        <div className="p-4">
          <button
            className="btn btn-primary btn-outline"
            onClick={handleCompile}
          >
            Compile & Run
          </button>
        </div>

        <div className="flex-grow p-4">
          <Terminal output={terminalOutput} />
        </div>
      </div>
    </div>
  );
};

export default App;
