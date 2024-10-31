import { Container } from "dockerode";
import { Socket } from "socket.io";
import { ExecutionResult } from "./types";
import { PassThrough, Writable, Readable } from "stream";
import { GDBController } from "./gdbController";

export async function compileCodeInContainer(
  container: Container,
  filename: string
): Promise<ExecutionResult> {
  try {
    const compileCommand = [
      "g++",
      "-g",
      "-O0",
      `/code/${filename}`,
      "-o",
      `/code/${filename}.out`,
    ];

    const exec = await container.exec({
      Cmd: compileCommand,
      AttachStdout: true,
      AttachStderr: true,
      AttachStdin: false,
      Tty: false,
    });

    let { stdout, stderr } = await streamToString(exec);
    stdout = stdout.replace(/[^\x20-\x7E\n\r]/g, "");
    stderr = stderr.replace(/[^\x20-\x7E\n\r]/g, "");

    if (stderr) {
      return { success: false, error: stderr };
    }
    return { success: true, output: stdout };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function startDebugSession(
  container: Container,
  filename: string,
  breakpoints: number[],
  socket: Socket
): Promise<void> {
  const gdbCmd = ["gdb", "--interpreter=mi2", `/code/${filename}.out`];

  try {
    const lsExec = await container.exec({
      Cmd: ["ls", `-l`, `/code/${filename}.out`],
      AttachStdout: true,
      AttachStderr: true,
    });

    const { stdout: lsOut, stderr: lsErr } = await streamToString(lsExec);
    if (lsErr || !lsOut) {
      throw new Error(`Binary not found: /code/${filename}.out`);
    }

    const exec = await container.exec({
      Cmd: gdbCmd,
      AttachStdout: true,
      AttachStderr: true,
      AttachStdin: true,
      Tty: false,
    });

    const execStream = await exec.start({ hijack: true, stdin: true });

    const gdbStdin = new PassThrough();
    const gdbStdout = new PassThrough();
    const gdbStderr = new PassThrough();

    execStream.on("data", (chunk: Buffer) => {
      if (!chunk || chunk.length < 2) return;

      const type = chunk[0];
      const data = chunk.slice(1);

      if (type === 1) {
        gdbStdout.write(data);
      } else if (type === 2) {
        gdbStderr.write(data);
      }
    });

    execStream.on("end", () => {
      console.log("exec ended");
      gdbStdout.end();
      gdbStderr.end();
    });

    execStream.on("error", (error) => {
      console.error("execStream error:", error);
      socket.emit("stderr", { error: "GDB stream error occurred" });
    });

    const stdinWritable = new Writable({
      write(chunk, encoding, callback) {
        try {
          execStream.write(chunk, encoding, callback);
        } catch (error) {
          console.error("Error writing to execStream:", error);
          callback(error as Error);
        }
      },
    });

    gdbStdin.pipe(stdinWritable);

    const gdbController = new GDBController({
      stdin: gdbStdin,
      stdout: gdbStdout,
      stderr: gdbStderr,
    });

    (socket as any).gdbController = gdbController;
    socket.on("disconnect", async () => {
      try {
        await gdbController.quit();
      } catch (error) {
        console.error("Error during GDB cleanup:", error);
      }
    });

    gdbController.on("stdout", (data) => {
      socket.emit("stdout", { output: data.output });
    });

    gdbController.on("stderr", (data) => {
      socket.emit("stderr", { error: data.error });
    });

    gdbController.on("breakpoint", async (data) => {
      console.log(data);
      // runCommand not working yet
      // const stk = await gdbController.getStackFrames();
      // const vars = await gdbController.getVariables();

      const stk = "test1";
      const vars = "test2";

      socket.emit("debugStopped", {
        line: data.line,
        stk: stk,
        vars: vars,
      });
    });

    gdbController.on("exit", () => {
      socket.emit("debugFinished");
      gdbController.quit();
    });

    try {
      gdbController.init();

      if (breakpoints && breakpoints.length > 0) {
        console.log("Setting breakpoints:", breakpoints);
        for (const line of breakpoints) {
          await gdbController.setBreakpoint(`/code/${filename}:${line}`);
        }
      }

      await gdbController.run();
    } catch (error) {
      console.error("Error during GDB initialization:", error);
      socket.emit("stderr", {
        error: `Failed to initialize debugger: ${error.message}`,
      });
      throw error;
    }
  } catch (error: any) {
    console.error("Error during debug session setup:", error);
    socket.emit("stderr", {
      error: `Failed to start debug session: ${error.message}`,
    });
    throw error;
  }
}

async function handleBreakpoint(payload: any, socket: Socket) {
  const reason = payload["reason"];
  const frame = payload["frame"];

  if (reason === "breakpoint-hit") {
    socket.emit("debugStopped", {
      reason: "breakpoint-hit",
      frame,
    });

    const gdbController: GDBController = (socket as any).gdbController;
    if (gdbController) {
      try {
        const variables = await gdbController.getVariables();
        socket.emit("debugVariables", { variables });
      } catch (err) {
        console.error("Error fetching variables:", err);
      }
    }
  } else if (reason === "exited-normally") {
    socket.emit("debugFinished", { message: "Program exited normally." });
    const gdbController: GDBController = (socket as any).gdbController;
    if (gdbController) {
      await gdbController.quit();
    }
  }
}

async function streamToString(
  exec: any
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";

    exec.start({ hijack: true, stdin: false }, (err: any, stream: any) => {
      if (err) {
        return reject(err);
      }

      const stdoutStream = new Writable({
        write(chunk, encoding, callback) {
          stdout += chunk.toString();
          callback();
        },
      });

      const stderrStream = new Writable({
        write(chunk, encoding, callback) {
          stderr += chunk.toString();
          callback();
        },
      });

      stream.on("data", (chunk: Buffer) => {
        const type = chunk[0];
        const data = chunk.slice(1);
        if (type === 1) {
          stdoutStream.write(data);
        } else if (type === 2) {
          stderrStream.write(data);
        }
      });

      stream.on("end", () => {
        resolve({ stdout, stderr });
      });

      stream.on("error", (error: any) => {
        reject(error);
      });
    });
  });
}

export default streamToString;
