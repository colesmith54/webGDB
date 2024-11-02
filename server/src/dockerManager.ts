import Docker, { Container } from "dockerode";
import { CODE_DIR } from "./utils/fileUtils";
import path from "path";

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

export async function createDockerContainer(
  sessionId: string
): Promise<Container> {
  const container = await docker.createContainer({
    Image: "gcc-gdb-image",
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
    name: `container_${sessionId}`,
  });

  await container.start();
  return container;
}

export async function removeDockerContainer(
  container: Container
): Promise<void> {
  try {
    const containerInfo = await container.inspect();

    if (containerInfo.State.Running) {
      await container.stop();
    }
  } catch (error) {
    console.error("Error stopping container:", error);
  }

  try {
    await container.remove({ force: true });
  } catch (error) {
    console.error("Error removing container:", error);
  }
}
