import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";

import { connectMongo } from "./services/mongo.service";
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

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
  registerRecordingHandlers(io, socket);
});

const PORT = process.env.PORT || 5000;

connectMongo().then(() => {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});