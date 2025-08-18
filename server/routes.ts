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

  app.post("/api/songs/:songId/tracks", async (req, res) => {
    try {
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
        name: req.body.name,
        trackNumber: parseInt(req.body.trackNumber) || (existingTracks.length + 1),
        audioUrl: req.body.audioUrl, // This will be the blob URL for local files
        volume: parseInt(req.body.volume) || 100,
        balance: parseInt(req.body.balance) || 0,
        isMuted: req.body.isMuted === true,
        isSolo: req.body.isSolo === true
      };

      const validatedData = insertTrackSchema.parse(trackData);
      const track = await storage.createTrack(validatedData);

      // Update song duration based on provided duration or keep existing
      const trackDuration = parseInt(req.body.duration) || 0;
      if (trackDuration > 0) {
        const maxDuration = Math.max(song.duration, trackDuration);
        await storage.updateSong(req.params.songId, { duration: maxDuration });
      }

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

  // Add specific route for updating tracks within songs
  app.patch("/api/songs/:songId/tracks/:trackId", async (req, res) => {
    try {
      const partialData = insertTrackSchema.partial().parse(req.body);
      const track = await storage.updateTrack(req.params.trackId, partialData);
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

  // Persistence routes for auto-saving
  app.post("/api/persistence/save", (req, res) => {
    try {
      const data = storage.getAllData();
      res.json({ 
        success: true, 
        data,
        timestamp: new Date().toISOString() 
      });
    } catch (error) {
      res.status(500).json({ success: false, error: "Failed to get data" });
    }
  });

  app.post("/api/persistence/load", (req, res) => {
    try {
      const { songs, tracks, midiEvents } = req.body;
      storage.loadData(songs || [], tracks || [], midiEvents || []);
      res.json({ success: true, message: "Data loaded successfully" });
    } catch (error) {
      res.status(500).json({ success: false, error: "Failed to load data" });
    }
  });

  // Lyrics search route
  app.post("/api/lyrics/search", async (req, res) => {
    try {
      const { title, artist } = req.body;
      
      if (!title || !artist) {
        return res.status(400).json({ 
          success: false, 
          error: "Both title and artist are required" 
        });
      }

      // Clean up artist and title for better API results
      const cleanArtist = encodeURIComponent(artist.trim());
      const cleanTitle = encodeURIComponent(title.trim());
      
      // Use Lyrics.ovh API (free, no API key required)
      const lyricsUrl = `https://api.lyrics.ovh/v1/${cleanArtist}/${cleanTitle}`;
      
      console.log(`Searching lyrics for "${title}" by ${artist}...`);
      
      const response = await fetch(lyricsUrl);
      
      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.log('API returned non-JSON response, likely rate limited or down');
        return res.json({
          success: false,
          error: "Lyrics service temporarily unavailable",
          message: "The lyrics service is currently unavailable. Please try again later or enter lyrics manually."
        });
      }
      
      const data = await response.json();
      
      if (response.ok && data.lyrics) {
        console.log(`Found lyrics for "${title}" by ${artist}`);
        res.json({
          success: true,
          lyrics: data.lyrics.trim(),
          source: "Lyrics.ovh"
        });
      } else {
        console.log(`No lyrics found for "${title}" by ${artist}`);
        res.json({
          success: false,
          error: "Lyrics not found",
          message: `Could not find lyrics for "${title}" by ${artist}. Try checking the spelling or enter them manually.`
        });
      }
      
    } catch (error) {
      console.error("Lyrics search error:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to search for lyrics",
        message: "Network error occurred while searching for lyrics. Please check your internet connection."
      });
    }
  });

  // Set up auto-save callback
  storage.setAutoSaveCallback(() => {
    console.log("Auto-save triggered");
  });

  const httpServer = createServer(app);
  return httpServer;
}
