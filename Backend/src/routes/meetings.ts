import express from "express";
import { Meeting } from "../models/index";
const router = express.Router();

router.get("/:id", async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ error: "Not found" });
    res.json(meeting);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;