// src/hooks/useSocketHandlers.ts

import { useEffect } from "react";
import socket from "../socket";
import { Frame, Variable } from "../types";

interface UseSocketHandlersProps {
  onStdout?: (data: { output: string }) => void;
  onStderr?: (data: { error: string }) => void;
  onCompiled?: () => void;
  onRunFinished?: () => void;
  onDebugStopped?: (data: {
    line: string;
    stk: Frame[];
    vars: Variable[];
  }) => void;
  onDebugFinished?: () => void;
  onConnectFailed?: () => void;
  onConnect?: () => void;
}

export const useSocketHandlers = ({
  onStdout,
  onStderr,
  onCompiled,
  onRunFinished,
  onDebugStopped,
  onDebugFinished,
  onConnectFailed,
  onConnect,
}: UseSocketHandlersProps) => {
  useEffect(() => {
    if (onStdout) {
      socket.on("stdout", onStdout);
    }
    if (onStderr) {
      socket.on("stderr", onStderr);
    }
    if (onCompiled) {
      socket.on("compiled", onCompiled);
    }
    if (onRunFinished) {
      socket.on("runFinished", onRunFinished);
    }
    if (onDebugStopped) {
      socket.on("debugStopped", onDebugStopped);
    }
    if (onDebugFinished) {
      socket.on("debugFinished", onDebugFinished);
    }
    if (onConnectFailed) {
      socket.on("connect_error", onConnectFailed);
      socket.on("connect_failed", onConnectFailed);
      socket.on("disconnect", onConnectFailed);
    }
    if (onConnect) {
      socket.on("connect", onConnect);
    }

    return () => {
      if (onStdout) socket.off("stdout", onStdout);
      if (onStderr) socket.off("stderr", onStderr);
      if (onCompiled) socket.off("compiled", onCompiled);
      if (onRunFinished) socket.off("runFinished", onRunFinished);
      if (onDebugStopped) socket.off("debugStopped", onDebugStopped);
      if (onDebugFinished) socket.off("debugFinished", onDebugFinished);
      if (onConnectFailed) {
        socket.off("connect_error", onConnectFailed);
        socket.off("connect_failed", onConnectFailed);
        socket.off("disconnect", onConnectFailed);
      }
      if (onConnect) socket.off("connect", onConnect);
    };
  }, [
    onStdout,
    onStderr,
    onCompiled,
    onRunFinished,
    onDebugStopped,
    onDebugFinished,
    onConnectFailed,
    onConnect,
  ]);
};
