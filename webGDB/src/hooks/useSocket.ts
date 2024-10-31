// src/hooks/useSocket.ts

import { useEffect } from "react";
import socket from "../socket";

interface UseSocketProps {
  onStdout: (data: { output: string }) => void;
  onStderr: (data: { error: string }) => void;
  onDebugStopped?: (data: { line: string; stk: any; vars: any }) => void;
  onDebugFinished?: () => void;
}

export function useSocket({
  onStdout,
  onStderr,
  onDebugStopped,
  onDebugFinished,
}: UseSocketProps) {
  useEffect(() => {
    socket.on("connect", () => {
      console.log("Connected to server via WebSocket");
    });

    socket.on("stdout", onStdout);
    socket.on("stderr", onStderr);

    if (onDebugStopped) {
      socket.on("debugStopped", onDebugStopped);
    }
    if (onDebugFinished) {
      socket.on("debugFinished", onDebugFinished);
    }

    return () => {
      socket.off("connect");
      socket.off("stdout", onStdout);
      socket.off("stderr", onStderr);
      if (onDebugStopped) {
        socket.off("debugStopped", onDebugStopped);
      }
      if (onDebugFinished) {
        socket.off("debugFinished", onDebugFinished);
      }
    };
  }, [onStdout, onStderr, onDebugStopped, onDebugFinished]);
}
