// src/gdbController.ts

import { EventEmitter } from "events";
import { Writable, Readable } from "stream";

interface GDBControllerOptions {
  stdin: Writable;
  stdout: Readable;
  stderr: Readable;
}

interface GDBResponse {
  token: number | null;
  type: string;
  message: string;
  payload: any;
}

export class GDBController extends EventEmitter {
  private stdin: Writable;
  private stdout: Readable;
  private stderr: Readable;
  private tokenCounter: number;
  private pendingResponses: Map<number, (response: GDBResponse) => void>;

  constructor(options: GDBControllerOptions) {
    super();
    this.stdin = options.stdin;
    this.stdout = options.stdout;
    this.stderr = options.stderr;
    this.tokenCounter = 1;
    this.pendingResponses = new Map();

    this.stdout.on("data", this.handleStdout.bind(this));
    this.stderr.on("data", this.handleStderr.bind(this));
  }

  private buffer: string = "";

  private handleStdout(data: Buffer) {
    this.buffer += data.toString().replace(/[^\x20-\x7E\n\r]/g, "");
    let boundary = this.buffer.indexOf("\n");
    while (boundary !== -1) {
      const line = this.buffer.substring(0, boundary).trim();
      this.buffer = this.buffer.substring(boundary + 1);
      this.parseLine(line);
      boundary = this.buffer.indexOf("\n");
    }
  }

  private handleStderr(data: Buffer) {
    const errorMsg = data.toString().replace(/[^\x20-\x7E\n\r]/g, "");
    this.emit("stderr", errorMsg);
    this.emit("error", new Error(errorMsg));
  }

  private parseLine(line: string) {
    if (!line) return;

    if (line.includes("bkpt")) {
      const m = line.match(/line="(\d+)"/);
      const lineNum = m ? parseInt(m[1], 10) : null;

      this.emit("breakpoint", { line: lineNum });
      return;
    }

    if (line.includes('=thread-group-exited,id="i1"')) {
      const m = line.match(/exit-code="(\d+)"/);
      const exitCode = m ? parseInt(m[1], 10) : null;
      this.emit("stdout", {
        output: `Program finished with exit code ${exitCode}`,
      });
      return;
    }

    if (line.includes('*stopped,reason="exited-normally"')) {
      this.emit("exit");
      return;
    }

    if (line === "(gdb)") {
      return;
    }

    const header = line.slice(0, 3);
    if (
      header.includes("~") ||
      header.includes("=") ||
      header.includes("&") ||
      header.includes("^") ||
      header.includes("*")
    ) {
      return;
    }

    this.emit("stdout", { output: line });
  }

  public sendCommand(command: string): Promise<GDBResponse> {
    const token = this.tokenCounter++;
    return new Promise((resolve, reject) => {
      if (token > Number.MAX_SAFE_INTEGER - 1) {
        this.tokenCounter = 1;
      }

      this.pendingResponses.set(token, resolve);
      const commandWithToken = `${token}${command}\n`;
      this.stdin.write(commandWithToken, (err) => {
        if (err) {
          this.pendingResponses.delete(token);
          reject(err);
        }
      });
    });
  }

  public async init() {
    await this.sendCommand("-gdb-set mi-async on");
    await this.sendCommand("-enable-pretty-printing");
  }

  public async setBreakpoint(location: string) {
    const response = await this.sendCommand(`-break-insert ${location}`);
    if (response.type !== "^" || !response.payload.startsWith("done")) {
      throw new Error(`Failed to set breakpoint at ${location}`);
    }
  }

  public async run() {
    const response = await this.sendCommand("-exec-run");
    if (response.type !== "^" || !response.payload.startsWith("running")) {
      throw new Error("Failed to start program execution");
    }
  }

  public async continue() {
    const response = await this.sendCommand("-exec-continue");
    if (response.type !== "^" || !response.payload.startsWith("running")) {
      throw new Error("Failed to continue execution");
    }
  }

  public async stepOver() {
    const response = await this.sendCommand("-exec-next");
    if (response.type !== "^" || !response.payload.startsWith("running")) {
      throw new Error("Failed to step over");
    }
  }

  public async stepInto() {
    const response = await this.sendCommand("-exec-step");
    if (response.type !== "^" || !response.payload.startsWith("running")) {
      throw new Error("Failed to step into");
    }
  }

  public async getStackFrames(): Promise<any> {
    const response = await this.sendCommand("-stack-list-frames");
    if (response.type !== "^" || !response.payload.startsWith("done")) {
      throw new Error("Failed to retrieve stack frames");
    }
    return response.payload;
  }

  public async getVariables(): Promise<any> {
    const response = await this.sendCommand(
      "-var-list-children --all-values --simple-values --no-children"
    );
    if (response.type !== "^" || !response.payload.startsWith("done")) {
      throw new Error("Failed to retrieve variables");
    }
    return response.payload;
  }

  public async quit() {
    await this.sendCommand("-gdb-exit");
    this.stdin.end();
  }
}
