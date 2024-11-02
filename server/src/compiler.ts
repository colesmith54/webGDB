import { Container, Exec } from "dockerode";
import { ExecutionResult } from "./types";
import { Writable } from "stream";

export async function compileAndRunCodeInContainer(
  container: Container,
  filename: string
): Promise<ExecutionResult> {
  try {
    const compileCommand = `g++ /code/${filename} -o /code/${filename}.out`;
    const runCommand = `/code/${filename}.out`;

    const compileExec = await container.exec({
      Cmd: ["sh", "-c", compileCommand],
      AttachStdout: true,
      AttachStderr: true,
      Tty: false,
    });

    const compileOutput = await execToString(container, compileExec);

    if (compileOutput.stderr.trim()) {
      return { success: false, error: compileOutput.stderr };
    }

    const runExec = await container.exec({
      Cmd: ["sh", "-c", runCommand],
      AttachStdout: true,
      AttachStderr: true,
      Tty: false,
    });

    const runOutput = await execToString(container, runExec);

    if (runOutput.stderr.trim()) {
      return { success: false, error: runOutput.stderr };
    }

    return { success: true, output: runOutput.stdout };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function execToString(
  container: Container,
  exec: Exec
): Promise<{ stdout: string; stderr: string }> {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    exec.start({ hijack: true, stdin: false }, (err, stream) => {
      if (err) return reject(err);

      let stdout = "";
      let stderr = "";

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

      container.modem.demuxStream(stream, stdoutStream, stderrStream);

      let stdoutFinished = false;
      let stderrFinished = false;

      stdoutStream.on("finish", () => {
        stdoutFinished = true;
        if (stdoutFinished && stderrFinished) {
          resolve({ stdout, stderr });
        }
      });

      stderrStream.on("finish", () => {
        stderrFinished = true;
        if (stdoutFinished && stderrFinished) {
          resolve({ stdout, stderr });
        }
      });

      stream.on("error", (error: any) => {
        reject(error);
      });

      stream.on("end", () => {
        stdoutStream.end();
        stderrStream.end();
      });
    });
  });
}
