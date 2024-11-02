// src/App.tsx

import React, { useRef, useState, useEffect } from "react";
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
  const [debugControlsVisible, setDebugControlsVisible] =
    useState<boolean>(false);

  const isDebuggingRef = useRef(isDebugging);
  useEffect(() => {
    isDebuggingRef.current = isDebugging;
  }, [isDebugging]);

  const handleStdout = (data: { output: string }) => {
    setTerminalOutput((prev) => prev + data.output + "\n");
  };

  const handleStderr = (data: { error: string }) => {
    setTerminalError((prev) => prev + data.error + "\n");
    setDebugControlsVisible(false);
    setIsDebugging(false);
    setVariables([]);
    setStackFrames([]);
  };

  const handleExit = () => {
    setTerminalOutput("");
    setTerminalError("");
    setDebugControlsVisible(false);
    setIsDebugging(false);
    setVariables([]);
    setStackFrames([]);
  };

  const handleDebugStopped = (data: { line: string; stk: any; vars: any }) => {
    setDebugControlsVisible(true);
    setIsDebugging(true);

    console.log(data);
  };

  const handleDebugFinished = () => {
    console.log("Debug finished");
    setDebugControlsVisible(false);
    setIsDebugging(false);
    setVariables([]);
    setStackFrames([]);
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
      setDebugControlsVisible(false);
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
      setDebugControlsVisible(true);
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

  const handleStepOver = () => {
    socket.emit("debugCommand", { type: "step_over" });
  };

  const handleSetBreakpoint = (line: number) => {
    console.log(isDebuggingRef.current);
    if (isDebuggingRef.current) {
      socket.emit("debugCommand", {
        type: "set_breakpoint",
        location: line,
      });
    }
  };

  const handleRemoveBreakpoint = (line: number) => {
    if (isDebuggingRef.current) {
      socket.emit("debugCommand", {
        type: "remove_breakpoint",
        location: line,
      });
    }
  };

  return (
    <div className="flex h-screen">
      <div className="w-1/2 border-r">
        <CodeEditor
          ref={codeEditorRef}
          handleSetBreakpoint={handleSetBreakpoint}
          handleRemoveBreakpoint={handleRemoveBreakpoint}
        />
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
            <div className="flex space-x-4 flex-grow">
              <button className="btn btn-primary" onClick={handleResume}>
                Resume
              </button>
              <button className="btn btn-primary" onClick={handleNext}>
                Next
              </button>
              <button className="btn btn-primary" onClick={handleStepIn}>
                Step In
              </button>
              <button className="btn btn-primary" onClick={handleStepOver}>
                Step Over
              </button>
            </div>

            <button className="btn btn-secondary ml-auto" onClick={handleExit}>
              Exit
            </button>
          </div>
        )}

        <div className="h-1/2 p-4 overflow-auto bg-gray-800 text-white">
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
      </div>
    </div>
  );
};

export default App;
