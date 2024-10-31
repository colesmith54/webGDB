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
      Tty: false,
    });

    const compileStream = await compileExec.start({});
    const compileOutput = await cleanStreamToString(compileStream);

    if (compileOutput.trim()) {
      return { success: false, error: compileOutput };
    }

    const runExec = await container.exec({
      Cmd: ["sh", "-c", runCommand],
      AttachStdout: true,
      AttachStderr: true,
      Tty: false,
    });

    const runStream = await runExec.start({});
    const runOutput = await cleanStreamToString(runStream);

    return { success: true, output: runOutput };
  } catch (err) {
    throw err;
  }
}

function cleanStreamToString(stream: Readable): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    stream.on("data", (chunk: Buffer) => {
      if (
        chunk.length >= 8 &&
        chunk[0] <= 2 &&
        chunk[1] === 0 &&
        chunk[2] === 0 &&
        chunk[3] === 0
      ) {
        chunks.push(chunk.slice(8));
      } else {
        chunks.push(chunk);
      }
    });

    stream.on("end", () => {
      const result = Buffer.concat(chunks)
        .toString("utf8")
        .replace(/[\x00-\x09\x0B-\x1F\x7F]/g, "");
      resolve(result);
    });

    stream.on("error", (err: Error) => {
      reject(err);
    });
  });
}
