# webGDB

A browser-based GDB frontend that can visualize pointer-based data structures

## Setup

**Prerequisites:** Node.js, Docker (running)

### 1. Build the Docker image

```bash
cd server
docker build -t gcc-gdb-image .
```

### 2. Start the server

```bash
cd server
npm install
npm run dev
```

Runs on `http://localhost:3001`.

### 3. Start the frontend

In a separate terminal

```bash
cd webGDB
npm install
npm run dev
```

Open `http://localhost:5173`