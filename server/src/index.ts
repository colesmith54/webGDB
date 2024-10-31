// src/index.ts

import express from "express";
import http from "http";
import { Server } from "socket.io";
import { handleSocketConnection } from "./socketHandlers";

const app = express();
const PORT = process.env.PORT || 3001;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.on("connection", handleSocketConnection);

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
