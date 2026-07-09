const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const audioPlayer = document.getElementById("audioPlayer");

let mediaRecorder;
let audioChunks = [];

const startRecording = async () => {
  // Ask microphone permission
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: true,
  });

  // Create recorder
  mediaRecorder = new MediaRecorder(stream);

  // Reset old chunks
  audioChunks = [];

  // Collect audio data
  mediaRecorder.ondataavailable = (event) => {
    audioChunks.push(event.data);
  };

  // When recording stops
  mediaRecorder.onstop = () => {
    const blob = new Blob(audioChunks, {
      type: "audio/webm",
    });

    console.log("Final Size:", blob.size);

    const url = URL.createObjectURL(blob);

    audioPlayer.src = url;

    // Optional: play automatically
    audioPlayer.play();

    audioChunks = [];
  };

  mediaRecorder.start();
};

const stopRecording = () => {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
};

startBtn.addEventListener("click", startRecording);
stopBtn.addEventListener("click", stopRecording);