import { DeepgramClient } from "@deepgram/sdk";
import dotenv from "dotenv";
dotenv.config();

if (!process.env.DEEPGRAM_API_KEY) {
  throw new Error("DEEPGRAM_API_KEY is missing from .env");
}

const deepgram = new DeepgramClient({
  apiKey: process.env.DEEPGRAM_API_KEY,
});

export default deepgram;