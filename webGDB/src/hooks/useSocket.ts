// src/hooks/useSocket.ts

import { useEffect } from "react";
import socket from "../socket";

interface UseSocketProps {
  onStdout?: (data: { output: string }) => void;
  onStderr?: (data: { error: string }) => void;
  onDebugStopped?: (data: { line: string; stk: any; vars: any }) => void;
  onDebugFinished?: () => void;
  onDisconnect?: (reason: string) => void;
  onConnectFailed?: () => void;
  onConnect?: () => void;
}

export const useSocket = ({
  onStdout,
  onStderr,
  onDebugStopped,
  onDebugFinished,
  onDisconnect,
  onConnectFailed,
  onConnect,
}: UseSocketProps) => {
  useEffect(() => {
    if (onStdout) {
      socket.on("stdout", onStdout);
    }
    if (onStderr) {
      socket.on("stderr", onStderr);
    }
    if (onDebugStopped) {
      socket.on("debugStopped", onDebugStopped);
    }
    if (onDebugFinished) {
      socket.on("debugFinished", onDebugFinished);
    }
    if (onDisconnect) {
      socket.on("disconnect", (reason: string) => {
        onDisconnect(reason);
      });
    }
    if (onConnectFailed) {
      socket.on("connect_error", () => {
        onConnectFailed();
      });
      socket.on("connect_failed", () => {
        onConnectFailed();
      });
    }
    if (onConnect) {
      socket.on("connect", () => {
        onConnect();
      });
    }

    return () => {
      if (onStdout) socket.off("stdout", onStdout);
      if (onStderr) socket.off("stderr", onStderr);
      if (onDebugStopped) socket.off("debugStopped", onDebugStopped);
      if (onDebugFinished) socket.off("debugFinished", onDebugFinished);
      if (onDisconnect) socket.off("disconnect", onDisconnect);
      if (onConnectFailed) socket.off("connect_failed", onConnectFailed);
      if (onConnect) socket.off("connect", onConnect);
    };
  }, [
    onStdout,
    onStderr,
    onDebugStopped,
    onDebugFinished,
    onDisconnect,
    onConnectFailed,
    onConnect,
  ]);
};
