import { Server, Socket } from "socket.io";
import deepgram from "../config/deepgram.service";
import { TranscriptChunk, Meeting } from "../models/index";
import {
  generateAndSaveMemory,
  embedMeeting,
} from "../services/memory.service";

export const registerRecordingHandlers = (io: Server, socket: Socket) => {
  const userId = socket.data.userId as string | undefined;

  let dgConnection: any = null;
  let isDgOpen = false;
  let pendingChunks: Buffer[] = [];
  let meetingId: string | null = null;

  // Shared by "end-meeting" (user clicked end) and "disconnect"
  // (refresh / tab closed / network drop).
  const finalizeMeeting = async (userEnded: boolean) => {
    const currentMeetingId = meetingId;
    if (!currentMeetingId || !userId) return;
    meetingId = null; // claim immediately: a second trigger returns above
    pendingChunks = [];

    const emit = (event: string, payload?: unknown) => {
      if (userEnded) socket.emit(event, payload);
    };

    try {
      const chunks = await TranscriptChunk.find({ meetingId: currentMeetingId })
        .sort({ startTime: 1 })
        .lean();

      const rawTranscript = chunks.map((c: any) => c.text).join(" ");

      // Dropped before anything was transcribed: don't leave an empty meeting behind
      if (!userEnded && rawTranscript.trim().length === 0) {
        await Meeting.deleteOne({ _id: currentMeetingId, userId });
        return;
      }

      const meeting = await Meeting.findOne({ _id: currentMeetingId, userId });
      const endedAt = new Date();
      const durationSeconds = meeting?.startedAt
        ? Math.floor((endedAt.getTime() - meeting.startedAt.getTime()) / 1000)
        : 0;

      await Meeting.findOneAndUpdate(
        { _id: currentMeetingId, userId },
        { status: "ended", endedAt, durationSeconds, rawTranscript },
        { new: true },
      );

      emit("meeting-saved", {
        meetingId: currentMeetingId,
        transcriptLength: rawTranscript.length,
      });

      if (rawTranscript.trim().length === 0) {
        emit("summary-error", {
          message: "No transcript captured — nothing to summarize.",
        });
        return;
      }

      emit("processing-started");

      // summary and embeddings are independent: one failing must not block the other
      const t0 = Date.now();
      const [summaryRes, embedRes] = await Promise.allSettled([
        (async () => {
          const s = await generateAndSaveMemory(
            currentMeetingId,
            rawTranscript,
          );
          console.log(`[timing] summary ms: ${Date.now() - t0}`);
          return s;
        })(),
        (async () => {
          await embedMeeting(currentMeetingId, userId);
          console.log(`[timing] embed ms: ${Date.now() - t0}`);
        })(),
      ]);
      console.log(`[timing] pipeline total ms: ${Date.now() - t0}`);

      if (embedRes.status === "rejected") {
        console.error("Embedding failed:", embedRes.reason);
      }

      if (summaryRes.status === "fulfilled") {
        emit("summary-ready", {
          meetingId: currentMeetingId,
          ...summaryRes.value,
        });
      } else {
        console.error("Summarization failed after retries:", summaryRes.reason);
        emit("summary-error", {
          message:
            "Summary failed after retries. The transcript is saved and still searchable.",
        });
      }
    } catch (err) {
      console.error("Failed to finalize meeting:", err);
      emit("meeting-save-error", { message: (err as Error).message });
    }
  };

  socket.on("start-recording", async () => {
    if (dgConnection) return;

    if (!userId) {
      socket.emit("meeting-save-error", { message: "Unauthorized" });
      return;
    }

    const meeting = await Meeting.create({
      userId,
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

    console.log("Audio chunk received:", buffer.length, "bytes");

    if (dgConnection && isDgOpen) {
      try {
        dgConnection.sendMedia(buffer);
      } catch (err) {
        console.error("Failed to send audio:", err);
        pendingChunks.push(buffer);
      }
    } else {
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

  socket.on("end-meeting", () => {
    void finalizeMeeting(true);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
    if (dgConnection && isDgOpen) {
      dgConnection.socket.close();
    }
    dgConnection = null;
    isDgOpen = false;
    void finalizeMeeting(false); // recovers or cleans up a meeting left open by a refresh
  });
};
