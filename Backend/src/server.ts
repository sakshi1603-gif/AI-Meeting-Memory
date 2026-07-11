import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import deepgram from "./services/deepgram.service";

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  let dgConnection: any = null;
  let isDgOpen = false;
  let pendingChunks: Buffer[] = [];

  socket.on("start-recording", async () => {
    if (dgConnection) return; // already recording, ignore duplicate

    try {
      dgConnection = await deepgram.listen.v1.connect({
        model: "nova-3",
        language: "en",
        smart_format: "true",
      });
    } catch (err) {
      console.error("Failed to create Deepgram connection:", err);
      dgConnection = null;
      return;
    }

    dgConnection.on("open", () => {
      console.log("Deepgram Connected");
      isDgOpen = true;

      if (pendingChunks.length > 0) {
        console.log(`Flushing ${pendingChunks.length} buffered chunks`);
        for (const buf of pendingChunks) {
          dgConnection.socket.send(buf);
        }
        pendingChunks = [];
      }
    });

    dgConnection.on("message", (data: any) => {
      console.log("DG message:", JSON.stringify(data));
      if (data.type === "Results") {
        const transcript = data.channel?.alternatives?.[0]?.transcript;
        if (transcript) {
          socket.emit("transcript", transcript);
        }
      }
    });

    dgConnection.on("close", (event: any) => {
      console.log(
        "Deepgram closed. code:",
        event?.code,
        "reason:",
        event?.reason,
      );
      isDgOpen = false;
      dgConnection = null;
    });

    dgConnection.on("error", (err: any) => {
      console.error("Deepgram error event:", err);
      isDgOpen = false;
    });

    try {
      dgConnection.connect();
      await dgConnection.waitForOpen();
    } catch (err) {
      console.error("Deepgram waitForOpen failed:", err);
      dgConnection = null;
    }
  });

  socket.on("audio-chunk", (chunk) => {
    const buffer = Buffer.from(chunk);

    if (dgConnection && isDgOpen) {
      try {
        dgConnection.socket.send(buffer);
      } catch (e) {
        console.error("send threw:", e);
      }
    } else if (dgConnection) {
      // Deepgram connection is still opening — buffer so we don't lose
      // the WebM header from the very first chunk.
      pendingChunks.push(buffer);
    }
  });

  socket.on("stop-recording", () => {
    if (dgConnection && isDgOpen) {
      dgConnection.socket.close();
    }
    dgConnection = null;
    isDgOpen = false;
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
    if (dgConnection && isDgOpen) {
      dgConnection.socket.close();
    }
    dgConnection = null;
    isDgOpen = false;
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
