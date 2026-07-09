const socket = io("http://localhost:3000");

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");

let mediaRecorder;
let stream;

const startRecording = async () => {
  stream = await navigator.mediaDevices.getUserMedia({
    audio: true,
  });

  mediaRecorder = new MediaRecorder(stream);

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      console.log("Sending chunk:", event.data.size);
      socket.emit("audio-chunk", event.data);
    }
  };

  // Generate an audio chunk every 250 ms
  //Every 250 milliseconds, MediaRecorder will fire:mediaRecorder.ondataavailable
  mediaRecorder.start(250);
};

const stopRecording = () => {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();

    // Turn off the microphone
    stream.getTracks().forEach((track) => track.stop());
  }
};

startBtn.addEventListener("click", startRecording);
stopBtn.addEventListener("click", stopRecording);
    