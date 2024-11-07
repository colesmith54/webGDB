// src/utils/streamUtils.ts

import { Container, Exec } from "dockerode";
import { Writable, PassThrough, Readable } from "stream";
import { Socket } from "socket.io";

export async function executeCommand(
  container: Container,
  cmd: string[],
  options: {
    attachStdout?: boolean;
    attachStderr?: boolean;
    attachStdin?: boolean;
    tty?: boolean;
  } = {}
): Promise<Exec> {
  return container.exec({
    Cmd: cmd,
    AttachStdout: options.attachStdout ?? true,
    AttachStderr: options.attachStderr ?? true,
    AttachStdin: options.attachStdin ?? false,
    Tty: options.tty ?? false,
  });
}

export async function execToString(
  container: Container,
  exec: Exec
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    exec.start({ hijack: true, stdin: false }, (err: any, stream: any) => {
      if (err) {
        return reject(err);
      }

      const stdoutStream = new Writable({
        write(chunk, _, callback) {
          stdout += chunk.toString();
          callback();
        },
      });

      const stderrStream = new Writable({
        write(chunk, _, callback) {
          stderr += chunk.toString();
          callback();
        },
      });

      let stdout = "";
      let stderr = "";

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

      stream.on("error", reject);
      stream.on("end", () => {
        stdoutStream.end();
        stderrStream.end();
      });
    });
  });
}

export async function execToStream(
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

      stream.on("end", () => {
        stdoutStream.end();
        stderrStream.end();
        socket.emit("runFinished");
      });

      stream.on("error", (error: any) => {
        socket.emit("stderr", { error: error.message || String(error) });
        socket.emit("runFinished");
        reject(error);
      });

      resolve({ stdout, stderr, stdin: stdinStream });
    });
  });
}
