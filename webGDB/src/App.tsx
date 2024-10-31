// src/App.tsx

import React, { useRef, useState } from "react";
import CodeEditor from "./components/CodeEditor";
import Terminal from "./components/Terminal";
import socket from "./socket";
import { useSocket } from "./hooks/useSocket";

const App: React.FC = () => {
  const codeEditorRef = useRef<any>(null);
  const [terminalOutput, setTerminalOutput] = useState<string>("");
  const [terminalError, setTerminalError] = useState<string>("");
  const [isDebugging, setIsDebugging] = useState<boolean>(false);
  const [variables, setVariables] = useState<any[]>([]);
  const [stackFrames, setStackFrames] = useState<any[]>([]);
  const [gdbMessages, setGdbMessages] = useState<string[]>([]);
  const [debugControlsVisible, setDebugControlsVisible] =
    useState<boolean>(false);

  const handleStdout = (data: { output: string }) => {
    setTerminalOutput((prev) => prev + data.output + "\n");
  };

  const handleStderr = (data: { error: string }) => {
    setTerminalError((prev) => prev + data.error + "\n");
  };

  const handleDebugStopped = (data: { line: string; stk: any; vars: any }) => {
    setDebugControlsVisible(true);
    console.log(data);
  };

  const handleDebugFinished = () => {
    setDebugControlsVisible(false);
    setIsDebugging(false);
    setVariables([]);
    setStackFrames([]);
    setGdbMessages([]);
  };

  useSocket({
    onStdout: handleStdout,
    onStderr: handleStderr,
    onDebugStopped: handleDebugStopped,
    onDebugFinished: handleDebugFinished,
  });

  const handleCompile = () => {
    if (codeEditorRef.current) {
      const code = codeEditorRef.current.getCode();
      socket.emit("codeSubmission", { code });

      setTerminalOutput("");
      setTerminalError("");
    }
  };

  const handleDebug = () => {
    if (codeEditorRef.current) {
      const code = codeEditorRef.current.getCode();
      const breakpoints = codeEditorRef.current.getBreakpoints();
      socket.emit("debugStart", { code, breakpoints });

      setTerminalOutput("");
      setTerminalError("");
      setIsDebugging(true);
    }
  };

  const handleResume = () => {
    socket.emit("debugCommand", { type: "continue" });
  };

  const handleNext = () => {
    socket.emit("debugCommand", { type: "step_over" });
  };

  const handleStepIn = () => {
    socket.emit("debugCommand", { type: "step_into" });
  };

  const handleStepOut = () => {
    socket.emit("debugCommand", { type: "step_out" });
  };

  return (
    <div className="flex h-screen">
      <div className="w-1/2 border-r">
        <CodeEditor ref={codeEditorRef} />
      </div>

      <div className="w-1/2 flex flex-col">
        <div className="p-4 flex space-x-2">
          <button
            className="btn btn-primary flex-grow"
            onClick={handleCompile}
            disabled={isDebugging}
          >
            Compile & Run
          </button>
          <button
            className="btn btn-secondary flex-grow"
            onClick={handleDebug}
            disabled={isDebugging}
          >
            Debug
          </button>
        </div>

        {debugControlsVisible && (
          <div className="p-4 flex space-x-2">
            <button className="btn btn-primary" onClick={handleResume}>
              Resume
            </button>
            <button className="btn btn-primary" onClick={handleNext}>
              Next
            </button>
            <button className="btn btn-primary" onClick={handleStepIn}>
              Step In
            </button>
            <button className="btn btn-primary" onClick={handleStepOut}>
              Step Out
            </button>
          </div>
        )}

        <div className="flex-grow p-4 overflow-auto bg-gray-800 text-white">
          <Terminal output={terminalOutput} error={terminalError} />
        </div>

        {isDebugging && stackFrames.length > 0 && (
          <div className="p-4 bg-gray-100">
            <h2 className="text-lg font-semibold">Stack Frames</h2>
            <ul>
              {stackFrames.map((frame, index) => (
                <li key={index}>
                  #{index} {frame.function} at {frame.file}:{frame.line}
                </li>
              ))}
            </ul>
          </div>
        )}

        {isDebugging && variables.length > 0 && (
          <div className="p-4 bg-gray-100">
            <h2 className="text-lg font-semibold">Variables</h2>
            <ul>
              {variables.map((variable, index) => (
                <li key={index}>
                  {variable.name}: {variable.value}
                </li>
              ))}
            </ul>
          </div>
        )}

        {isDebugging && gdbMessages.length > 0 && (
          <div className="p-4 bg-gray-200 overflow-auto">
            <h2 className="text-lg font-semibold">GDB Messages</h2>
            <ul>
              {gdbMessages.map((msg, index) => (
                <li key={index} className="whitespace-pre-wrap">
                  {msg}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
