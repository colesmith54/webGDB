// src/socketHandlers.ts

import { Socket } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import { createDockerContainer, removeDockerContainer } from "./dockerManager";
import { compileAndRunCodeInContainer } from "./compiler";
import { compileCodeInContainer, startDebugSession } from "./debugger";
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
        socket.emit("stderr", {
          error: "No Docker container associated with this client.",
        });
        throw new Error("No Docker container associated with this client.");
      }

      const executionResult: ExecutionResult =
        await compileAndRunCodeInContainer(clientContainer, filename);

      if (executionResult.success) {
        socket.emit("stdout", { output: executionResult.output });
      } else {
        socket.emit("stderr", { error: executionResult.error });
      }
    } catch (error: any) {
      console.error("Error during code execution:", error);
      socket.emit("programError", { error: error.message });
    } finally {
      deleteFile(filepath);
    }
  });

  socket.on("debugStart", async (data) => {
    console.log("Received debug start from", socket.id);

    const { code, breakpoints } = data;
    const sessionId = uuidv4();
    const filename = `code_${sessionId}.cpp`;

    ensureCodeDirExists();
    const filepath = saveCodeToFile(code, filename);

    try {
      const clientContainer: Container = (socket as any).container;
      if (!clientContainer) {
        throw new Error("No Docker container associated with this client.");
      }

      const compilationResult = await compileCodeInContainer(
        clientContainer,
        filename
      );

      if (!compilationResult.success) {
        socket.emit("stderr", { error: compilationResult.error });
        return;
      }

      await startDebugSession(clientContainer, filename, breakpoints, socket);
      console.log("Debug session started.");
    } catch (error: any) {
      console.error("Error during debugging:", error);
      socket.emit("stderr", { error: error.message });
    } finally {
      deleteFile(filepath);
    }
  });

  socket.on("debugCommand", async (data) => {
    const { type, location } = data;
    const gdbController: any = (socket as any).gdbController;
    if (gdbController) {
      try {
        switch (type) {
          case "continue":
            await gdbController.continue();
            break;
          case "step_over":
            await gdbController.stepOver();
            break;
          case "step_into":
            await gdbController.stepInto();
            break;
          case "step_out":
            await gdbController.stepOut();
            break;
          case "set_breakpoint":
            console.log("Setting breakpoint at", location);
            if (location) {
              await gdbController.setBreakpoint(location);
            } else {
              throw new Error("Breakpoint location not provided.");
            }
            break;
          case "remove_breakpoint":
            console.log("Removing breakpoint at", location);
            if (location) {
              await gdbController.removeBreakpoint(location);
            } else {
              throw new Error("Breakpoint location not provided.");
            }
            break;
          default:
            socket.emit("programError", { error: "Unknown command type." });
        }
      } catch (error: any) {
        console.error("GDB Command Error:", error);
        socket.emit("programError", { error: error.message });
      }
    } else {
      socket.emit("programError", { error: "GDB session not initialized." });
    }
  });

  socket.on("disconnect", async () => {
    console.log("Client disconnected:", socket.id);
    const clientContainer: Container = (socket as any).container;
    if (clientContainer) {
      const gdbController: any = (socket as any).gdbController;
      if (gdbController) {
        try {
          await gdbController.quit();
        } catch (err) {
          console.error("Error quitting GDB:", err);
        }
      }
      await removeDockerContainer(clientContainer);
      console.log(`Docker container removed for client ${socket.id}`);
    }
  });
}
