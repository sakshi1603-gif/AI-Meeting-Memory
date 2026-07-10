const { DeepgramClient } = require("@deepgram/sdk");
const fetch = require("cross-fetch");
require("dotenv").config();

const deepgram = new DeepgramClient({
  apiKey: process.env.DEEPGRAM_API_KEY,
});

const AUDIO_URL =
  "http://stream.live.vc.bbcmedia.co.uk/bbc_world_service";

async function start() {

  const connection = await deepgram.listen.v1.connect({
    model: "nova-3",
    language: "en-US",
    smart_format: "true",
  });

  connection.on("open", () => {
    console.log("Connected to Deepgram");

    connection.on("message", (data) => {
      if (data.type === "Results") {
        const transcript =
          data.channel.alternatives[0].transcript;

        if (transcript) {
          console.log("Transcript:", transcript);
        }
      }
    });

    connection.on("error", (err) => {
      console.error("Error:", err);
    });

    connection.on("close", () => {
      console.log("Connection Closed");
    });

    fetch(AUDIO_URL)
      .then((res) => res.body)
      .then((stream) => {
        stream.on("readable", () => {
          const chunk = stream.read();

          if (chunk) {
            connection.sendMedia(chunk);
          }
        });
      });
  });

  connection.connect();
  await connection.waitForOpen();
}

start();