// src/compiler.ts

import { Container } from "dockerode";
import { ExecutionResult } from "./types";
import { Readable } from "stream";

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
    });

    const compileStream = await compileExec.start({});

    const compileOutput = await streamToString(compileStream);

    if (compileOutput) {
      return { success: false, error: compileOutput };
    } else {
      const runExec = await container.exec({
        Cmd: ["sh", "-c", runCommand],
        AttachStdout: true,
        AttachStderr: true,
      });

      const runStream = await runExec.start({});
      const runOutput = await streamToString(runStream);

      return { success: true, output: runOutput };
    }
  } catch (err) {
    throw err;
  }
}

function streamToString(stream: Readable): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    stream.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    stream.on("error", (err: Error) => {
      reject(err);
    });
  });
}
