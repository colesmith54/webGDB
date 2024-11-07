// src/socketHandlers/debugHandler.ts

import { Socket } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import { compileCodeInContainer, startDebugSession } from "../debugger";
import { GDBController } from "../controllers/gdbController";
import {
  ensureCodeDirExists,
  saveCodeToFile,
  deleteFile,
} from "../utils/fileUtils";
import { Container } from "dockerode";

export async function handleDebugStart(
  socket: Socket,
  data: any
): Promise<void> {
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
    socket.emit("compiled");
  } catch (error: any) {
    socket.emit("stderr", { error: error.message });
  } finally {
    deleteFile(filepath);
  }
}

export async function handleDebugCommand(
  socket: Socket,
  data: any
): Promise<void> {
  const { type, location } = data;
  const gdbController: GDBController | undefined = (socket as any)
    .gdbController;

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
          if (location) {
            await gdbController.setBreakpoint(location);
            console.log("Breakpoint set at", location);
          } else {
            throw new Error("Breakpoint location not provided.");
          }
          break;
        case "remove_breakpoint":
          if (location) {
            await gdbController.removeBreakpoint(location);
            console.log("Breakpoint removed at", location);
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

  socket.emit("compiled");
}
