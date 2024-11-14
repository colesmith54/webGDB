// src/controllers/gdbController.ts

import { EventEmitter } from "events";
import { Writable, Readable } from "stream";
import { GDBMIResponse, GDBControllerOptions, Variable, Frame } from "../types";
import { parseStackFrames } from "../parsers/stackFrameParser";
import { GDBMIParser } from "../parsers/gdbmiParser";

export class GDBController extends EventEmitter {
  private stdin: Writable;
  private stdout: Readable;
  private stderr: Readable;
  private file: string;
  private tokenCounter: number;
  private pendingResponses: Map<number, (response: GDBMIResponse) => void>;
  private breakpoints: Map<number, number>;
  private isEnded: boolean = false;

  constructor(options: GDBControllerOptions) {
    super();
    this.stdin = options.stdin;
    this.stdout = options.stdout;
    this.stderr = options.stderr;
    this.file = options.file;
    this.tokenCounter = 1;
    this.pendingResponses = new Map();
    this.breakpoints = new Map();

    this.stdout.on("data", this.handleStdout.bind(this));
    this.stderr.on("data", this.handleStderr.bind(this));

    this.stdin.on("error", (err) => {
      console.error("stdin stream encountered an error:", err);
      this.emit("error", err);
    });

    this.stdin.on("finish", () => {
      console.log("stdin stream has finished writing.");
    });

    this.stdin.on("close", () => {
      console.log("stdin stream has been closed.");
    });
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
    console.log(line);

    if (!line) {
      this.emit("stdout", { output: "" });
      return;
    }

    if (line === "(gdb)") {
      return;
    }

    const end_marker = '~"[Inferior';
    if (line.includes(end_marker)) {
      const idx = line.indexOf(end_marker);
      this.emit("stdout", { output: line.substring(0, idx) });
      return;
    }

    const tokenMatch = line.match(/^(\d+)?([\^=~&\*])(\w+)(?:,([^]*))?$/);
    if (tokenMatch) {
      const token = tokenMatch[1] ? parseInt(tokenMatch[1], 10) : null;
      const responseType = tokenMatch[2];
      const responseIdentifier = tokenMatch[3];

      if (token !== null) {
        const responseHandler = this.pendingResponses.get(token);
        if (responseHandler) {
          const response: GDBMIResponse = {
            token,
            type: responseType,
            message: line,
            payload: responseIdentifier,
          };

          this.pendingResponses.delete(token);
          responseHandler(response);
          return;
        }
      }
    }

    if (line.includes('*stopped,reason="breakpoint-hit"')) {
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

  public sendCommand(command: string): Promise<GDBMIResponse> {
    if (this.isEnded) {
      return Promise.reject(
        new Error("Cannot send command, GDBController has been quit.")
      );
    }

    const token = this.tokenCounter++;
    return new Promise((resolve, reject) => {
      if (token > Number.MAX_SAFE_INTEGER - 1) {
        this.tokenCounter = 1;
      }

      const timeout = setTimeout(() => {
        this.pendingResponses.delete(token);
        reject(new Error(`Command "${command}" timed out after 2 seconds`));
      }, 2000);

      const commandWithToken = `${token}${command}\n`;
      this.stdin.write(commandWithToken, (err) => {
        if (err) {
          clearTimeout(timeout);
          this.pendingResponses.delete(token);
          reject(err);
        }
      });

      const originalResolve = resolve;
      this.pendingResponses.set(token, (response: GDBMIResponse) => {
        clearTimeout(timeout);
        originalResolve(response);
      });
    });
  }

  public async init() {
    await this.sendCommand("-enable-pretty-printing");
  }

  public async setBreakpoint(line: number) {
    const location = `${this.file}:${line}`;
    const response = await this.sendCommand(`-break-insert ${location}`);

    if (response.type !== "^" || !response.payload.startsWith("done")) {
      throw new Error(`Failed to set breakpoint at ${location}`);
    }

    const match = response.message.match(/number="(\d+)"/);
    if (!match) {
      throw new Error("Failed to parse breakpoint ID");
    }

    this.breakpoints.set(line, parseInt(match[1], 10));
  }

  public async removeBreakpoint(line: number) {
    const breakpointId = this.breakpoints.get(line);

    if (!breakpointId) {
      throw new Error(`Breakpoint not found at line ${line}`);
    }

    const response = await this.sendCommand(`-break-delete ${breakpointId}`);
    if (response.type !== "^" || !response.payload.startsWith("done")) {
      throw new Error(`Failed to remove breakpoint at ${line}`);
    }

    this.breakpoints.delete(line);
  }

  public sendProgramInput(input: string): void {
    if (this.isEnded) {
      this.emit(
        "error",
        new Error("Cannot send input, debug session has ended.")
      );
      return;
    }

    this.stdin.write(input + "\n", (err) => {
      if (err) {
        this.emit("error", new Error("Failed to send input to the program."));
      } else {
        this.emit("inputSent", input);
      }
    });
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

  public async stepOut() {
    const response = await this.sendCommand("-exec-finish");
    if (response.type !== "^" || !response.payload.startsWith("running")) {
      throw new Error("Failed to step out");
    }
  }

  public async getVariables(): Promise<any> {
    try {
      const response = await this.sendCommand(
        "-stack-list-variables --all-values"
      );

      if (response.type !== "^" || !response.payload.startsWith("done")) {
        throw new Error("Failed to retrieve variables");
      }

      const parser = new GDBMIParser(response.message);
      const result = parser.parse();

      const json = JSON.stringify(result, null, 2);
      console.log(json);
      return result;
    } catch (error) {
      console.error("Error in getVariables:", error);
      throw error;
    }
  }

  public async getStackFrames(): Promise<Frame[]> {
    const response = await this.sendCommand("-stack-list-frames");
    if (response.type !== "^" || !response.payload.startsWith("done")) {
      throw new Error("Failed to retrieve stack frames");
    }

    const framesMatch = response.message.match(/stack=\[(.*)\]/);
    if (!framesMatch) {
      throw new Error("Invalid stack frames format");
    }

    const framesStr = framesMatch[1];
    return parseStackFrames(framesStr);
  }

  public async quit() {
    if (this.isEnded) {
      console.warn("GDBController has already been quit.");
      return;
    }
    this.isEnded = true;

    try {
      await this.sendCommand("-gdb-exit");
      this.stdin.end();
    } catch (error) {
      console.error("Failed to exit GDB:", error);
    }

    for (const [_, resolve] of this.pendingResponses) {
      resolve({
        token: null,
        type: "error",
        message: "GDBController has been quit.",
        payload: null,
      });
    }
    this.pendingResponses.clear();
  }
}
