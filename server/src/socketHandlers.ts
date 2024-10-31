// src/socketHandlers.ts

import { Socket } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import { createDockerContainer, removeDockerContainer } from "./dockerManager";
import { compileAndRunCodeInContainer } from "./compiler";
import { ExecutionResult } from "./types";
import {
  ensureCodeDirExists,
  saveCodeToFile,
  deleteFile,
} from "./utils/fileUtils";
import { Container } from "dockerode";

export function handleSocketConnection(socket: Socket): void {
  console.log("Client connected:", socket.id);

  (async () => {
    try {
      const sessionId = uuidv4();
      const container = await createDockerContainer(sessionId);

      (socket as any).container = container;
      console.log(`Docker container created for client ${socket.id}`);
    } catch (error) {
      console.error("Error creating Docker container:", error);
      socket.emit("connectionError", {
        error: "Failed to create execution environment.",
      });
      socket.disconnect(true);
    }
  })();

  socket.on("codeSubmission", async (data) => {
    console.log("Received code submission from", socket.id);

    const { code } = data;
    const sessionId = uuidv4();
    const filename = `code_${sessionId}.cpp`;

    ensureCodeDirExists();
    const filepath = saveCodeToFile(code, filename);

    try {
      const clientContainer: Container = (socket as any).container;
      if (!clientContainer) {
        throw new Error("No Docker container associated with this client.");
      }

      const executionResult: ExecutionResult =
        await compileAndRunCodeInContainer(clientContainer, filename);

      if (executionResult.success) {
        socket.emit("programOutput", { output: executionResult.output });
      } else {
        socket.emit("programError", { error: executionResult.error });
      }
    } catch (error: any) {
      console.error("Error during code execution:", error);
      socket.emit("programError", { error: error.message });
    } finally {
      deleteFile(filepath);
    }
  });

  socket.on("disconnect", async () => {
    console.log("Client disconnected:", socket.id);
    const clientContainer: Container = (socket as any).container;
    if (clientContainer) {
      await removeDockerContainer(clientContainer);
      console.log(`Docker container removed for client ${socket.id}`);
    }
  });
}
