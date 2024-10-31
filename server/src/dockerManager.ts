// src/dockerManager.ts

import Docker, { Container } from "dockerode";
import { CODE_DIR } from "./utils/fileUtils";
import path from "path";

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

export async function createDockerContainer(
  sessionId: string
): Promise<Container> {
  const containerName = `container_${sessionId}`;

  const container = await docker.createContainer({
    Image: "gcc:latest",
    name: containerName,
    Tty: false,
    Cmd: ["tail", "-f", "/dev/null"],
    OpenStdin: false,
    StdinOnce: false,
    Volumes: {
      "/code": {},
    },
    HostConfig: {
      Binds: [`${CODE_DIR}:/code`],
      AutoRemove: false,
      NetworkMode: "none",
      Memory: 512 * 1024 * 1024,
      CpuShares: 256,
    },
  });

  await container.start();

  console.log(`Docker container ${containerName} created and started.`);

  return container;
}

export async function removeDockerContainer(
  container: Container
): Promise<void> {
  try {
    const containerInfo = await container.inspect();

    if (containerInfo.State.Running) {
      await container.stop();
      console.log(`Docker container ${containerInfo.Name} stopped.`);
    }
  } catch (error) {
    console.error("Error stopping container:", error);
  }

  try {
    await container.remove({ force: true });
    console.log(`Docker container ${container.id} removed.`);
  } catch (error) {
    console.error("Error removing container:", error);
  }
}

export async function executeCommandInContainer(
  container: Container,
  command: string[]
): Promise<{ stdout: string; stderr: string }> {
  const exec = await container.exec({
    Cmd: command,
    AttachStdout: true,
    AttachStderr: true,
  });

  const stream = await exec.start({});

  const output = await new Promise<{ stdout: string; stderr: string }>(
    (resolve, reject) => {
      let stdout = "";
      let stderr = "";

      stream.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      stream.on("error", (err: Error) => {
        reject(err);
      });

      stream.on("end", () => {
        resolve({ stdout, stderr });
      });
    }
  );

  return output;
}
