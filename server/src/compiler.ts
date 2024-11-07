// src/compiler.ts

import { Container } from "dockerode";
import { Socket } from "socket.io";
import { PassThrough } from "stream";
import {
  executeCommand,
  execToStream,
  execToString,
} from "./utils/streamUtils";

export async function compileAndRunCodeInContainer(
  container: Container,
  filename: string,
  socket: Socket
): Promise<{ stdout: string; stderr: string; stdin: PassThrough }> {
  const compileCommand = `g++ /code/${filename} -o /code/${filename}.out`;
  const runCommand = `/code/${filename}.out`;

  try {
    const compileExec = await executeCommand(
      container,
      ["sh", "-c", compileCommand],
      {
        attachStdout: true,
        attachStderr: true,
        tty: false,
      }
    );

    const compileOutput = await execToString(container, compileExec);

    if (compileOutput.stderr.trim()) {
      socket.emit("stderr", { error: compileOutput.stderr });
      socket.emit("runFinished");
      return {
        stdout: "",
        stderr: compileOutput.stderr,
        stdin: new PassThrough(),
      };
    }

    const runExec = await executeCommand(container, ["sh", "-c", runCommand], {
      attachStdout: true,
      attachStderr: true,
      attachStdin: true,
      tty: false,
    });

    const execStream = await execToStream(container, runExec, socket);

    return execStream;
  } catch (error: any) {
    socket.emit("stderr", { error: error.message || String(error) });
    socket.emit("runFinished");
    return {
      stdout: "",
      stderr: error.message || String(error),
      stdin: new PassThrough(),
    };
  }
}
