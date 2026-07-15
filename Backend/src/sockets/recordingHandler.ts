import { Server, Socket } from "socket.io";
import deepgram from "../services/deepgram.service";
import { TranscriptChunk, Meeting } from "../models/index";

export const registerRecordingHandlers = (io: Server, socket: Socket) => {
  let dgConnection: any = null;
  let isDgOpen = false;
  let pendingChunks: Buffer[] = [];
  let meetingId: string | null = null;
  let chunkIndex = 0;

  socket.on("start-recording", async () => {
    if (dgConnection) return;

    const meeting = await Meeting.create({
      status: "active",
      startTime: new Date(),
    });
    meetingId = meeting._id.toString();
    socket.emit("meeting-started", { meetingId });

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

    dgConnection.on("message", async (data: any) => {
      if (data.type === "Results") {
        const transcript = data.channel?.alternatives?.[0]?.transcript;
        if (transcript) {
          socket.emit("transcript", transcript);

          if (meetingId) {
            try {
              await TranscriptChunk.create({
                meetingId,
                text: transcript,
                startTime: data.start,
                endTime: data.start + data.duration,
                confidence: data.channel?.alternatives?.[0]?.confidence,
                isFinal: data.is_final ?? true,
              });
            } catch (err) {
              console.error("Failed to save transcript chunk:", err);
            }
          }
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

  socket.on("end-meeting", async () => {
    if (!meetingId) return;

    if (dgConnection && isDgOpen) {
      dgConnection.socket.close();
    }

    try {
      const chunks = await TranscriptChunk.find({ meetingId })
        .sort({ chunkIndex: 1 })
        .lean();

      const fullTranscript = chunks.map((c: any) => c.text).join(" ");

      await Meeting.findByIdAndUpdate(meetingId, {
        status: "ended",
        endTime: new Date(),
        fullTranscript,
        chunkCount: chunks.length,
      });

      socket.emit("meeting-saved", { meetingId, chunkCount: chunks.length });
    } catch (err) {
      console.error("Failed to finalize meeting:", err);
      socket.emit("meeting-save-error", { message: (err as Error).message });
    }

    dgConnection = null;
    isDgOpen = false;
    meetingId = null;
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
    if (dgConnection && isDgOpen) {
      dgConnection.socket.close();
    }
    dgConnection = null;
    isDgOpen = false;
  });
};
