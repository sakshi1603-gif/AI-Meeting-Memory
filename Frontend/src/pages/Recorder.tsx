import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import socket from '../socket';
import './Recorder.css';

type RecordingState = 'idle' | 'connecting' | 'recording' | 'stopped' | 'processing' | 'error';

export default function Recorder() {
  const navigate = useNavigate();
  const [state, setState] = useState<RecordingState>('idle');
  const [transcript, setTranscript] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const meetingIdRef = useRef<string | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  // socket listeners — wired exactly to recordingHandler.ts's emit names
  useEffect(() => {
    function onMeetingStarted({ meetingId }: { meetingId: string }) {
      meetingIdRef.current = meetingId;
      setState('recording');
    }
    function onTranscript(text: string) {
      setTranscript((prev) => [...prev, text]);
    }
    function onProcessingStarted() {
      setState('processing');
    }
    function onSummaryReady({ meetingId }: { meetingId: string }) {
      navigate(`/meetings/${meetingId}`);
    }
    function onSummaryError({ message }: { message: string }) {
      // meeting was saved even though summarization failed — still worth visiting
      setErrorMsg(message);
      if (meetingIdRef.current) navigate(`/meetings/${meetingIdRef.current}`);
    }
    function onSaveError({ message }: { message: string }) {
      setErrorMsg(message);
      setState('error');
    }

    socket.on('meeting-started', onMeetingStarted);
    socket.on('transcript', onTranscript);
    socket.on('processing-started', onProcessingStarted);
    socket.on('summary-ready', onSummaryReady);
    socket.on('summary-error', onSummaryError);
    socket.on('meeting-save-error', onSaveError);

    return () => {
      socket.off('meeting-started', onMeetingStarted);
      socket.off('transcript', onTranscript);
      socket.off('processing-started', onProcessingStarted);
      socket.off('summary-ready', onSummaryReady);
      socket.off('summary-error', onSummaryError);
      socket.off('meeting-save-error', onSaveError);
    };
  }, [navigate]);

  // auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  // stop mic + recorder no matter how the component unmounts
  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function handleStart() {
    setErrorMsg(null);
    setTranscript([]);
    setState('connecting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = async (e) => {
        if (e.data.size > 0) {
          const buffer = await e.data.arrayBuffer();
          socket.emit('audio-chunk', buffer);
        }
      };

      socket.emit('start-recording');
      recorder.start(250); // flush a chunk every 250ms
    } catch {
      setErrorMsg('Microphone access was denied or unavailable.');
      setState('error');
    }
  }

  function handleStop() {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    socket.emit('stop-recording');
    setState('stopped');
  }

  function handleEndMeeting() {
    socket.emit('end-meeting');
    setState('processing');
  }

  const isRecording = state === 'recording';
  const isProcessing = state === 'processing';
  const hasStarted = state !== 'idle' && state !== 'error';

  const statusLabel: Record<RecordingState, string> = {
    idle: 'Ready to record',
    connecting: 'Connecting…',
    recording: 'Recording live',
    stopped: 'Recording stopped',
    processing: 'Generating summary…',
    error: 'Something went wrong',
  };

  return (
    <div className="recorder-page">
      <div className="recorder-stage">
        <div className={`recorder-orb${isRecording ? ' recorder-orb-live' : ''}`}>
          <div className="recorder-orb-core" />
        </div>

        <p className={`recorder-status text-mono${isRecording ? ' recorder-status-live' : ''}`}>
          {statusLabel[state]}
        </p>

        {errorMsg && <p className="recorder-error">{errorMsg}</p>}

        <div className="recorder-controls">
          {!hasStarted ? (
            <button className="btn btn-primary" onClick={handleStart}>
              Start recording
            </button>
          ) : (
            <>
              <button className="btn btn-ghost" onClick={handleStop} disabled={!isRecording}>
                Stop recording
              </button>
              <button
                className="btn btn-primary"
                onClick={handleEndMeeting}
                disabled={isProcessing || state === 'connecting'}
              >
                End meeting
              </button>
            </>
          )}
        </div>
      </div>

      <div className="recorder-transcript card">
        <h3>Live transcript</h3>
        {transcript.length === 0 ? (
          <p className="text-faint">Transcript will appear here once you start talking.</p>
        ) : (
          <div className="recorder-transcript-body">
            {transcript.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
            <div ref={transcriptEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}
