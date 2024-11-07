// src/socketHandlers/executionHandler.ts

import { Socket } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import { compileAndRunCodeInContainer } from "../compiler";
import {
  ensureCodeDirExists,
  saveCodeToFile,
  deleteFile,
} from "../utils/fileUtils";
import { Container } from "dockerode";

export async function handleCodeSubmission(
  socket: Socket,
  data: any
): Promise<void> {
  const { code } = data;
  const sessionId = uuidv4();
  const filename = `code_${sessionId}.cpp`;

  ensureCodeDirExists();
  const filepath = saveCodeToFile(code, filename);

  try {
    const clientContainer: Container = (socket as any).container;
    if (!clientContainer) {
      socket.emit("stderr", {
        error: "No Docker container associated with this client.",
      });
      throw new Error("No Docker container associated with this client.");
    }

    const execStream = await compileAndRunCodeInContainer(
      clientContainer,
      filename,
      socket
    );

    (socket as any).execStream = execStream;
    console.log("Code compiled and executed for ", socket.id);
    socket.emit("compiled");
  } catch (error: any) {
    console.error("Error during code execution:", error);
    socket.emit("programError", { error: error.message });
  } finally {
    deleteFile(filepath);
  }
}

export function handleProgramInput(socket: Socket, data: any): void {
  const { input } = data;

  const gdbController: any = (socket as any).gdbController;

  if (gdbController) {
    try {
      gdbController.sendProgramInput(input);
      console.log(`Debug input received from client ${socket.id}: ${input}`);
    } catch (error) {
      console.error("Error sending input to debugger:", error);
      socket.emit("programError", {
        error: "Failed to send input to debugger.",
      });
    }
  } else {
    const execStream: any = (socket as any).execStream;
    if (execStream && execStream.stdin) {
      execStream.stdin.write(input + "\n");
      console.log(`Input received from client ${socket.id}: ${input}`);
    } else {
      socket.emit("programError", { error: "No execution stream found." });
    }
  }
}
