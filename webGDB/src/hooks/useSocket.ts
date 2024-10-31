// src/hooks/useSocket.ts

import { useEffect } from "react";
import socket from "../socket";

interface UseSocketProps {
  onProgramOutput: (data: { output: string }) => void;
  onProgramError: (data: { error: string }) => void;
}

export function useSocket({ onProgramOutput, onProgramError }: UseSocketProps) {
  useEffect(() => {
    socket.on("connect", () => {
      console.log("Connected to server via WebSocket");
    });

    socket.on("programOutput", onProgramOutput);
    socket.on("programError", onProgramError);

    return () => {
      socket.off("connect");
      socket.off("programOutput", onProgramOutput);
      socket.off("programError", onProgramError);
    };
  }, [onProgramOutput, onProgramError]);
}
