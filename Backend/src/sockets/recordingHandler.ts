import { Server, Socket } from "socket.io";
import deepgram from "../services/deepgram.service";
import { TranscriptChunk, Meeting } from "../models/index";
import { generateAndSaveMemory } from "../services/memory.service";

export const registerRecordingHandlers = (io: Server, socket: Socket) => {
  let dgConnection: any = null;
  let isDgOpen = false;
  let pendingChunks: Buffer[] = [];
  let meetingId: string | null = null;

  socket.on("start-recording", async () => {
    if (dgConnection) return;
    const meeting = await Meeting.create({
      title: "Untitled Meeting",
      status: "active",
      startedAt: new Date(),
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

    dgConnection.on("close", () => {
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
    try {
      if (!meetingId) return;

      const chunks = await TranscriptChunk.find({ meetingId })
        .sort({ startTime: 1 })
        .lean();

      const rawTranscript = chunks.map((c: any) => c.text).join(" ");

      const meeting = await Meeting.findById(meetingId);

      const endedAt = new Date();

      const durationSeconds = meeting?.startedAt
        ? Math.floor((endedAt.getTime() - meeting.startedAt.getTime()) / 1000)
        : 0;

      await Meeting.findByIdAndUpdate(
        meetingId,
        {
          status: "ended",
          endedAt,
          durationSeconds,
          rawTranscript,
        },
        { new: true },
      );

      socket.emit("meeting-saved", {
        meetingId,
        transcriptLength: rawTranscript.length,
      });

      // --- NEW: trigger summarization, but don't block meeting-saved on it ---
      const summarizedMeetingId = meetingId; // capture before reset below
      meetingId = null;
      pendingChunks = [];

      if (rawTranscript.trim().length === 0) {
        socket.emit("summary-error", {
          message: "No transcript captured — nothing to summarize.",
        });
        return;
      }

      socket.emit("processing-started");

      try {
        const structured = await generateAndSaveMemory(
          summarizedMeetingId,
          rawTranscript,
        );
        socket.emit("summary-ready", {
          meetingId: summarizedMeetingId,
          ...structured,
        });
      } catch (summaryErr) {
        console.error("Summarization failed:", summaryErr);
        socket.emit("summary-error", {
          message: "Failed to generate summary.",
        });
      }
    } catch (err) {
      console.error("Failed to finalize meeting:", err);

      socket.emit("meeting-save-error", {
        message: (err as Error).message,
      });
    }
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
