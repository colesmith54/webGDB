// src/socketHandlers/index.ts

import { Socket } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import {
  createDockerContainer,
  removeDockerContainer,
} from "../utils/dockerUtils";
import { handleCodeSubmission, handleProgramInput } from "./executionHandler";
import { handleDebugStart, handleDebugCommand } from "./debugHandler";

export async function handleSocketConnection(socket: Socket): Promise<void> {
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
    return;
  }

  socket.on("codeSubmission", (data) => handleCodeSubmission(socket, data));
  socket.on("input", (data) => handleProgramInput(socket, data));
  socket.on("debugStart", (data) => handleDebugStart(socket, data));
  socket.on("debugCommand", (data) => handleDebugCommand(socket, data));

  socket.on("disconnect", async () => {
    console.log("Client disconnected:", socket.id);
    const clientContainer = (socket as any).container;
    if (clientContainer) {
      await removeDockerContainer(clientContainer);
      console.log(`Docker container removed for client ${socket.id}`);
    }
  });
}
