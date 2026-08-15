import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";

import { connectMongo } from "./config/mongo.service";
import { registerRecordingHandlers } from "./sockets/recordingHandler";
import meetingsRouter from './routes/meetings';

import queryRouter from './routes/query';
import authRouter from './routes/auth';
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/meetings", meetingsRouter);
app.use('/api', queryRouter);
app.use('/api/auth', authRouter);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

// reject any socket connection that doesn't carry a valid JWT — same secret
// and payload shape as middleware/auth.ts, so a token valid for the REST API
// is valid here too
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error("Unauthorized"));
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { userId: string };
    socket.data.userId = decoded.userId;
    next();
  } catch {
    next(new Error("Unauthorized"));
  }
});

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id, "user:", socket.data.userId);
  registerRecordingHandlers(io, socket);
});

const PORT = process.env.PORT || 5000;

connectMongo().then(() => {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
