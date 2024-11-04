// src/App.tsx

import React, { useRef, useState, useEffect } from "react";
import CodeEditor from "./components/CodeEditor";
import Terminal from "./components/Terminal";
import socket from "./socket";
import { useSocket } from "./hooks/useSocket";
import { Variable, StackFrame } from "./types";
import { TerminalEntry } from "./types";

const App: React.FC = () => {
  const codeEditorRef = useRef<any>(null);
  const [terminalEntries, setTerminalEntries] = useState<TerminalEntry[]>([]);

  const [canInput, setCanInput] = useState<boolean>(false);
  const [isDebugging, setIsDebugging] = useState<boolean>(false);

  const [variables, setVariables] = useState<Variable[]>([]);
  const [stackFrames, setStackFrames] = useState<StackFrame[]>([]);
  const [currentLine, setCurrentLine] = useState<number | null>(null);

  const [debugControlsVisible, setDebugControlsVisible] =
    useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  const isDebuggingRef = useRef(isDebugging);
  useEffect(() => {
    isDebuggingRef.current = isDebugging;
  }, [isDebugging]);

  const handleStdout = (data: { output: string }) => {
    setTerminalEntries((prev) => [
      ...prev,
      { type: "output", text: data.output },
    ]);
  };

  const handleStderr = (data: { error: string }) => {
    setTerminalEntries((prev) => [
      ...prev,
      { type: "error", text: data.error },
    ]);
    setDebugControlsVisible(false);
    setIsDebugging(false);
    setVariables([]);
    setStackFrames([]);
    setCurrentLine(null);
  };

  const handleExit = () => {
    setTerminalEntries([]);
    setDebugControlsVisible(false);
    setIsDebugging(false);
    setVariables([]);
    setStackFrames([]);
    setCurrentLine(null);
  };

  const handleDebugStopped = (data: {
    line: string;
    stk: StackFrame[];
    vars: Variable[];
  }) => {
    setDebugControlsVisible(true);
    setIsDebugging(true);
    setCanInput(false);

    const lineNumber = parseInt(data.line, 10);
    setCurrentLine(lineNumber);

    const parsedStackFrames: StackFrame[] = data.stk.map((frame: any) => ({
      addr: frame.addr,
      func: frame.func,
      level: frame.level,
      line: parseInt(frame.line, 10),
    }));
    setStackFrames(parsedStackFrames);

    const parsedVariables: Variable[] = data.vars.map((variable: any) => ({
      name: variable.name,
      value: variable.value,
    }));
    setVariables(parsedVariables);
  };

  const handleDebugFinished = () => {
    setDebugControlsVisible(false);
    setIsDebugging(false);
    setVariables([]);
    setStackFrames([]);
    setCurrentLine(null);
    setCanInput(false);
  };

  const handleConnect = () => {
    setIsConnected(true);
    setTerminalEntries([]);
  };

  const handleConnectFailed = () => {
    const errorMessage = "Connection Failed: Unable to establish a connection.";
    setTerminalEntries([{ type: "error", text: errorMessage }]);
    setDebugControlsVisible(false);
    setIsConnected(false);
    setIsDebugging(false);
    setVariables([]);
    setStackFrames([]);
    setCurrentLine(null);
  };

  const handleRunFinished = () => {
    setCanInput(false);
  };

  useSocket({
    onStdout: handleStdout,
    onStderr: handleStderr,
    onRunFinished: handleRunFinished,
    onDebugStopped: handleDebugStopped,
    onDebugFinished: handleDebugFinished,
    onConnect: handleConnect,
    onConnectFailed: handleConnectFailed,
  });

  const handleCompile = () => {
    if (codeEditorRef.current) {
      const code = codeEditorRef.current.getCode();

      setTerminalEntries([]);
      setDebugControlsVisible(false);
      setCurrentLine(null);
      setCanInput(true);

      socket.emit("codeSubmission", { code });
    }
  };

  const handleDebug = () => {
    if (codeEditorRef.current) {
      const code = codeEditorRef.current.getCode();
      const breakpoints = codeEditorRef.current.getBreakpoints();

      setTerminalEntries([]);
      setIsDebugging(true);
      setCurrentLine(null);
      setCanInput(true);

      socket.emit("debugStart", { code, breakpoints });
    }
  };

  const handleResume = () => {
    setCanInput(true);
    socket.emit("debugCommand", { type: "continue" });
  };

  const handleNext = () => {
    setCanInput(true);
    socket.emit("debugCommand", { type: "step_over" });
  };

  const handleStepIn = () => {
    setCanInput(true);
    socket.emit("debugCommand", { type: "step_into" });
  };

  const handleStepOver = () => {
    setCanInput(true);
    socket.emit("debugCommand", { type: "step_over" });
  };

  const handleSetBreakpoint = (line: number) => {
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

  const handleSendInput = (input: string) => {
    input = input + "\n";
    socket.emit("input", { input });
    setTerminalEntries((prev) => [...prev, { type: "input", text: input }]);
  };

  return (
    <div className="flex h-screen flex-col">
      <div className="flex flex-1">
        <div className="w-1/2 border-r">
          <CodeEditor
            ref={codeEditorRef}
            handleSetBreakpoint={handleSetBreakpoint}
            handleRemoveBreakpoint={handleRemoveBreakpoint}
            currentLine={currentLine}
            isReadOnly={isDebugging}
          />
        </div>

        <div className="w-1/2 flex flex-col">
          <div className="p-4 flex space-x-2">
            <button
              className="btn btn-primary flex-grow"
              onClick={handleCompile}
              disabled={isDebugging || !isConnected}
            >
              Compile & Run
            </button>
            <button
              className="btn btn-secondary flex-grow"
              onClick={handleDebug}
              disabled={isDebugging || !isConnected}
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

              <button
                className="btn btn-secondary ml-auto"
                onClick={handleExit}
              >
                Exit
              </button>
            </div>
          )}

          <div className="h-1/3 p-4 overflow-auto bg-gray-800 text-white">
            <Terminal
              terminalEntries={terminalEntries}
              onSendInput={handleSendInput}
              canInput={canInput}
            />
          </div>

          {isDebugging && stackFrames.length > 0 && (
            <div className="p-4 bg-gray-800 w-full">
              <h2 className="text-lg font-semibold mb-2">Stack Frames</h2>
              <table className="table-auto w-full text-left">
                <thead>
                  <tr>
                    <th className="px-4 py-2">#</th>
                    <th className="px-4 py-2">Function</th>
                    <th className="px-4 py-2">Address</th>
                    <th className="px-4 py-2">File (line)</th>
                  </tr>
                </thead>
                <tbody>
                  {stackFrames.map((frame, index) => (
                    <tr key={index}>
                      <td className="border px-4 py-2">{index}</td>
                      <td className="border px-4 py-2">{frame.func}</td>
                      <td className="border px-4 py-2">{frame.addr}</td>
                      <td className="border px-4 py-2">
                        main.cpp:{frame.line}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {isDebugging && variables.length > 0 && (
            <div className="p-4 bg-gray-800 w-full">
              <h2 className="text-lg font-semibold mb-2">Variables</h2>
              <ul>
                {variables.map((variable, index) => (
                  <li key={index} className="border-b py-1">
                    {variable.name}: {variable.value}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
