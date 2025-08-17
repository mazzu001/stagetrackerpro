import type { Express, Request } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertSongSchema, insertTrackSchema, insertMidiEventSchema } from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req: any, file: any, cb: any) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  }),
  fileFilter: (req: any, file: any, cb: any) => {
    const allowedTypes = ['.mp3', '.wav', '.ogg', '.m4a'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only audio files are allowed.'));
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve uploaded files
  app.use("/uploads", express.static(uploadDir));

  // Songs routes
  app.get("/api/songs", async (req, res) => {
    try {
      const songs = await storage.getAllSongs();
      res.json(songs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch songs" });
    }
  });

  app.get("/api/songs/:id", async (req, res) => {
    try {
      const song = await storage.getSongWithTracks(req.params.id);
      if (!song) {
        return res.status(404).json({ message: "Song not found" });
      }
      res.json(song);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch song" });
    }
  });

  app.post("/api/songs", async (req, res) => {
    try {
      const validatedData = insertSongSchema.parse(req.body);
      const song = await storage.createSong(validatedData);
      res.status(201).json(song);
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Failed to create song" });
      }
    }
  });

  app.patch("/api/songs/:id", async (req, res) => {
    try {
      const partialData = insertSongSchema.partial().parse(req.body);
      const song = await storage.updateSong(req.params.id, partialData);
      if (!song) {
        return res.status(404).json({ message: "Song not found" });
      }
      res.json(song);
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Failed to update song" });
      }
    }
  });

  app.delete("/api/songs/:id", async (req, res) => {
    try {
      const success = await storage.deleteSong(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Song not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete song" });
    }
  });

  // Tracks routes
  app.get("/api/songs/:songId/tracks", async (req, res) => {
    try {
      const tracks = await storage.getTracksBySongId(req.params.songId);
      res.json(tracks);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch tracks" });
    }
  });

  app.post("/api/songs/:songId/tracks", upload.single('audioFile'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Audio file is required" });
      }

      // Check if song exists and track limit
      const song = await storage.getSong(req.params.songId);
      if (!song) {
        return res.status(404).json({ message: "Song not found" });
      }

      const existingTracks = await storage.getTracksBySongId(req.params.songId);
      if (existingTracks.length >= 6) {
        return res.status(400).json({ message: "Maximum 6 tracks allowed per song" });
      }

      const trackData = {
        songId: req.params.songId,
        name: req.body.name || req.file.originalname,
        trackNumber: parseInt(req.body.trackNumber) || (existingTracks.length + 1),
        audioUrl: `/uploads/${req.file.filename}`,
        volume: parseInt(req.body.volume) || 100,
        isMuted: req.body.isMuted === 'true',
        isSolo: req.body.isSolo === 'true'
      };

      const validatedData = insertTrackSchema.parse(trackData);
      const track = await storage.createTrack(validatedData);

      // Update song duration based on longest track (mock implementation for now)
      // In a real app, you'd analyze the actual audio file duration
      const mockDuration = 180 + Math.floor(Math.random() * 120); // 3-5 minutes
      const maxDuration = Math.max(song.duration, mockDuration);
      await storage.updateSong(req.params.songId, { duration: maxDuration });

      res.status(201).json(track);
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Failed to create track" });
      }
    }
  });

  app.patch("/api/tracks/:id", async (req, res) => {
    try {
      const partialData = insertTrackSchema.partial().parse(req.body);
      const track = await storage.updateTrack(req.params.id, partialData);
      if (!track) {
        return res.status(404).json({ message: "Track not found" });
      }
      res.json(track);
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Failed to update track" });
      }
    }
  });

  app.delete("/api/tracks/:id", async (req, res) => {
    try {
      const success = await storage.deleteTrack(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Track not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete track" });
    }
  });

  // MIDI Events routes
  app.get("/api/songs/:songId/midi-events", async (req, res) => {
    try {
      const events = await storage.getMidiEventsBySongId(req.params.songId);
      res.json(events);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch MIDI events" });
    }
  });

  app.post("/api/songs/:songId/midi-events", async (req, res) => {
    try {
      const eventData = {
        ...req.body,
        songId: req.params.songId
      };
      const validatedData = insertMidiEventSchema.parse(eventData);
      const event = await storage.createMidiEvent(validatedData);
      res.status(201).json(event);
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Failed to create MIDI event" });
      }
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
