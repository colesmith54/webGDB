// src/compiler.ts

import { Container, Exec } from "dockerode";
import { Writable, PassThrough } from "stream";
import { Socket } from "socket.io";

export async function compileAndRunCodeInContainer(
  container: Container,
  filename: string,
  socket: Socket
): Promise<{ stdout: string; stderr: string; stdin: PassThrough }> {
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
    socket.emit("stderr", { error: compileOutput.stderr });
    return {
      stdout: "",
      stderr: compileOutput.stderr,
      stdin: new PassThrough(),
    };
  }

  const runExec = await container.exec({
    Cmd: ["sh", "-c", runCommand],
    AttachStdout: true,
    AttachStderr: true,
    AttachStdin: true,
    Tty: false,
  });

  const execStream = await execToStream(container, runExec, socket);

  return execStream;
}

async function execToStream(
  container: Container,
  exec: Exec,
  socket: Socket
): Promise<{ stdout: string; stderr: string; stdin: PassThrough }> {
  return new Promise((resolve, reject) => {
    exec.start({ hijack: true, stdin: true }, (err, stream) => {
      if (err) return reject(err);

      let stdout = "";
      let stderr = "";

      const stdoutStream = new Writable({
        write(chunk, encoding, callback) {
          const chunkStr = chunk.toString();
          stdout += chunkStr;
          socket.emit("stdout", { output: chunkStr });
          callback();
        },
      });

      const stderrStream = new Writable({
        write(chunk, encoding, callback) {
          const chunkStr = chunk.toString();
          stderr += chunkStr;
          socket.emit("stderr", { error: chunkStr });
          callback();
        },
      });

      const stdinStream = new PassThrough();

      container.modem.demuxStream(stream, stdoutStream, stderrStream);

      stdinStream.pipe(stream);

      resolve({ stdout, stderr, stdin: stdinStream });
    });
  });
}

async function execToString(
  container: Container,
  exec: Exec
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    exec.start({ hijack: true, stdin: true }, (err, stream) => {
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
