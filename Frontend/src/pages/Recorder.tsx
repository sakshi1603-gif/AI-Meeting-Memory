import "../App.css";
import socket from "../socket";
import { useRef, useState, useEffect } from "react";

function Recorder() {
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const [transcript, setTranscript] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);

  const StartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      socket.emit("start-recording");

      mediaRecorder.current = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });

      mediaRecorder.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          socket.emit("audio-chunk", event.data);
        }
      };

      mediaRecorder.current.start(250);
      setIsRecording(true);
    } catch (err) {
      console.error("Could not start recording:", err);
    }
  };

  const StopRecording = () => {
    if (mediaRecorder.current && mediaRecorder.current.state === "recording") {
      mediaRecorder.current.stop();
      mediaRecorder.current.stream.getTracks().forEach((track) => track.stop());
      socket.emit("stop-recording");
    }
    setIsRecording(false);
  };

  useEffect(() => {
    const handleTranscript = (text: string) => {
      setTranscript((prev) => [...prev, text]);
    };

    socket.on("transcript", handleTranscript);
    return () => {
      socket.off("transcript", handleTranscript);
    };
  }, []);

  return (
    <>
      <button onClick={StartRecording} disabled={isRecording}>
        start recording
      </button>
      <button onClick={StopRecording} disabled={!isRecording}>
        stop recording
      </button>
      <button onClick={() => socket.emit("end-meeting")}>
        End meeting
      </button>
      <div>
        {transcript.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>
    </>
  );
}

export default Recorder;