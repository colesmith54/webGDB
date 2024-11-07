// src/App.tsx

import React, { useRef, useEffect, useReducer } from "react";
import CodeEditor from "./components/CodeEditor";
import Terminal from "./components/Terminal";
import socket from "./socket";
import { useSocketHandlers } from "./hooks/useSocketHandlers.ts";
import { Variable, Frame, TerminalEntry } from "./types";
import DebugControls from "./components/DebugControls";
import StackFrames from "./components/StackFrames";
import Variables from "./components/Variables";

interface AppState {
  terminalEntries: TerminalEntry[];
  isRunning: boolean;
  isDebugging: boolean;
  canInput: boolean;
  variables: Variable[];
  stackFrames: Frame[];
  currentLine: number | null;
  debugControlsVisible: boolean;
  isConnected: boolean;
}

type Action =
  | { type: "ADD_TERMINAL_ENTRY"; entry: TerminalEntry }
  | { type: "SET_TERMINAL_ENTRIES"; entries: TerminalEntry[] }
  | { type: "SET_RUNNING"; isRunning: boolean }
  | { type: "SET_DEBUGGING"; isDebugging: boolean }
  | { type: "SET_CAN_INPUT"; canInput: boolean }
  | { type: "SET_VARIABLES"; variables: Variable[] }
  | { type: "SET_STACK_FRAMES"; stackFrames: Frame[] }
  | { type: "SET_CURRENT_LINE"; line: number | null }
  | { type: "SET_DEBUG_CONTROLS_VISIBLE"; visible: boolean }
  | { type: "SET_CONNECTED"; connected: boolean }
  | { type: "RESET" };

const initialState: AppState = {
  terminalEntries: [],
  isRunning: false,
  isDebugging: false,
  canInput: false,
  variables: [],
  stackFrames: [],
  currentLine: null,
  debugControlsVisible: false,
  isConnected: false,
};

const reducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case "ADD_TERMINAL_ENTRY":
      return {
        ...state,
        terminalEntries: [...state.terminalEntries, action.entry],
      };
    case "SET_TERMINAL_ENTRIES":
      return { ...state, terminalEntries: action.entries };
    case "SET_RUNNING":
      return { ...state, isRunning: action.isRunning, canInput: false };
    case "SET_DEBUGGING":
      return { ...state, isDebugging: action.isDebugging };
    case "SET_CAN_INPUT":
      return { ...state, canInput: action.canInput };
    case "SET_VARIABLES":
      return { ...state, variables: action.variables };
    case "SET_STACK_FRAMES":
      return { ...state, stackFrames: action.stackFrames };
    case "SET_CURRENT_LINE":
      return { ...state, currentLine: action.line };
    case "SET_DEBUG_CONTROLS_VISIBLE":
      return { ...state, debugControlsVisible: action.visible };
    case "SET_CONNECTED":
      return { ...state, isConnected: action.connected };
    case "RESET":
      return { ...initialState, isConnected: state.isConnected };
    default:
      return state;
  }
};

const App: React.FC = () => {
  const codeEditorRef = useRef<any>(null);
  const isDebuggingRef = useRef(false);

  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    isDebuggingRef.current = state.isDebugging;
  }, [state.isDebugging]);

  const handleStdout = (data: { output: string }) => {
    dispatch({
      type: "ADD_TERMINAL_ENTRY",
      entry: { type: "output", text: data.output },
    });
  };

  const handleStderr = (data: { error: string }) => {
    dispatch({
      type: "ADD_TERMINAL_ENTRY",
      entry: { type: "error", text: data.error },
    });
    dispatch({ type: "SET_DEBUG_CONTROLS_VISIBLE", visible: false });
    dispatch({ type: "SET_DEBUGGING", isDebugging: false });
    dispatch({ type: "SET_VARIABLES", variables: [] });
    dispatch({ type: "SET_STACK_FRAMES", stackFrames: [] });
    dispatch({ type: "SET_CURRENT_LINE", line: null });
    dispatch({ type: "SET_RUNNING", isRunning: false });
  };

  const handleCompiled = () => {
    dispatch({ type: "SET_CAN_INPUT", canInput: true });
  };

  const handleRunFinished = () => {
    dispatch({ type: "SET_RUNNING", isRunning: false });
  };

  const handleExit = () => {
    dispatch({ type: "RESET" });
  };

  const handleDebugStopped = (data: {
    line: string;
    stk: Frame[];
    vars: Variable[];
  }) => {
    console.log(data.stk);
    console.log(data.vars);
    dispatch({ type: "SET_DEBUG_CONTROLS_VISIBLE", visible: true });
    dispatch({ type: "SET_DEBUGGING", isDebugging: true });
    dispatch({ type: "SET_RUNNING", isRunning: false });

    const lineNumber = parseInt(data.line, 10);
    dispatch({ type: "SET_CURRENT_LINE", line: lineNumber });

    dispatch({ type: "SET_STACK_FRAMES", stackFrames: data.stk });
    dispatch({ type: "SET_VARIABLES", variables: data.vars });
  };

  const handleDebugFinished = () => {
    dispatch({ type: "SET_DEBUG_CONTROLS_VISIBLE", visible: false });
    dispatch({ type: "SET_DEBUGGING", isDebugging: false });
    dispatch({ type: "SET_VARIABLES", variables: [] });
    dispatch({ type: "SET_STACK_FRAMES", stackFrames: [] });
    dispatch({ type: "SET_CURRENT_LINE", line: null });
    dispatch({ type: "SET_RUNNING", isRunning: false });
  };

  const handleConnect = () => {
    dispatch({ type: "SET_CONNECTED", connected: true });
    dispatch({ type: "RESET" });
  };

  const handleConnectFailed = () => {
    const connectionErrorEntry: TerminalEntry = {
      type: "error",
      text: "Connection Failed: Unable to establish a connection.",
    };
    dispatch({
      type: "SET_TERMINAL_ENTRIES",
      entries: [connectionErrorEntry],
    });
    dispatch({ type: "SET_DEBUG_CONTROLS_VISIBLE", visible: false });
    dispatch({ type: "SET_CONNECTED", connected: false });
    dispatch({ type: "SET_DEBUGGING", isDebugging: false });
    dispatch({ type: "SET_VARIABLES", variables: [] });
    dispatch({ type: "SET_STACK_FRAMES", stackFrames: [] });
    dispatch({ type: "SET_CURRENT_LINE", line: null });
    dispatch({ type: "SET_RUNNING", isRunning: false });
  };

  useSocketHandlers({
    onStdout: handleStdout,
    onStderr: handleStderr,
    onCompiled: handleCompiled,
    onRunFinished: handleRunFinished,
    onDebugStopped: handleDebugStopped,
    onDebugFinished: handleDebugFinished,
    onConnect: handleConnect,
    onConnectFailed: handleConnectFailed,
  });

  const handleCompile = () => {
    if (codeEditorRef.current) {
      const code = codeEditorRef.current.getCode();

      dispatch({ type: "RESET" });
      dispatch({ type: "SET_RUNNING", isRunning: true });

      socket.emit("codeSubmission", { code });
    }
  };

  const handleDebug = () => {
    if (codeEditorRef.current) {
      const code = codeEditorRef.current.getCode();
      const breakpoints = codeEditorRef.current.getBreakpoints();

      dispatch({ type: "RESET" });
      dispatch({ type: "SET_DEBUGGING", isDebugging: true });
      dispatch({ type: "SET_RUNNING", isRunning: true });

      socket.emit("debugStart", { code, breakpoints });
    }
  };

  const handleResume = () => {
    dispatch({ type: "SET_RUNNING", isRunning: true });
    socket.emit("debugCommand", { type: "continue" });
  };

  const handleNext = () => {
    dispatch({ type: "SET_RUNNING", isRunning: true });
    socket.emit("debugCommand", { type: "step_over" });
  };

  const handleStepIn = () => {
    dispatch({ type: "SET_RUNNING", isRunning: true });
    socket.emit("debugCommand", { type: "step_into" });
  };

  const handleStepOver = () => {
    dispatch({ type: "SET_RUNNING", isRunning: true });
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
    socket.emit("input", { input: input + "\n" });
    dispatch({
      type: "ADD_TERMINAL_ENTRY",
      entry: { type: "input", text: input },
    });
  };

  return (
    <div className="flex h-screen flex-col">
      <div className="flex flex-1">
        {/* Code Editor Section */}
        <div className="w-1/2 border-r">
          <CodeEditor
            ref={codeEditorRef}
            handleSetBreakpoint={handleSetBreakpoint}
            handleRemoveBreakpoint={handleRemoveBreakpoint}
            currentLine={state.currentLine}
            isReadOnly={state.isDebugging}
          />
        </div>

        {/* Right Panel: Buttons, Debug Controls, Terminal, StackFrames, Variables */}
        <div className="w-1/2 flex flex-col">
          {/* Action Buttons */}
          <div className="p-4 flex space-x-2">
            <button
              className="btn btn-primary flex-grow"
              onClick={handleCompile}
              disabled={
                state.isDebugging || !state.isConnected || state.isRunning
              }
            >
              Compile & Run
            </button>
            <button
              className="btn btn-secondary flex-grow"
              onClick={handleDebug}
              disabled={
                state.isDebugging || !state.isConnected || state.isRunning
              }
            >
              Debug
            </button>
          </div>

          {/* Debug Controls */}
          {state.debugControlsVisible && (
            <DebugControls
              onResume={handleResume}
              onNext={handleNext}
              onStepIn={handleStepIn}
              onStepOver={handleStepOver}
              onExit={handleExit}
              isRunning={state.isRunning}
            />
          )}

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto flex flex-col">
            {/* Terminal */}
            <div className="p-4 bg-gray-800 text-white min-h-[33vh] flex-shrink-0">
              <Terminal
                terminalEntries={state.terminalEntries}
                onSendInput={handleSendInput}
                canInput={state.canInput}
              />
            </div>

            {/* Stack Frames */}
            {state.isDebugging && state.stackFrames.length > 0 && (
              <StackFrames stackFrames={state.stackFrames} />
            )}

            {/* Variables */}
            {state.isDebugging && state.variables.length > 0 && (
              <Variables variables={state.variables} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
