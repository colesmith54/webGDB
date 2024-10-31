// src/socket.ts

import { io, Socket } from "socket.io-client";

const SOCKET_URL = "http://localhost:3001";

const socket: Socket = io(SOCKET_URL);

export default socket;
