import type { Express, Request } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertSongSchema, insertTrackSchema, insertMidiEventSchema } from "@shared/schema";
import { setupAuth, isAuthenticated, requireSubscription } from "./replitAuth";
import Stripe from "stripe";
import multer from "multer";
import path from "path";
import fs from "fs";
import { promises as fsPromises } from "fs";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  storage: multer.memoryStorage(), // Use memory storage to access file.buffer
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
  // Auth middleware disabled for testing
  // await setupAuth(app);

  // Auth routes disabled for testing
  app.get('/api/auth/user', async (req: any, res) => {
    // Return dummy user for testing without authentication
    res.json({
      id: "test-user",
      email: "test@example.com",
      firstName: "Test",
      lastName: "User"
    });
  });

  // Stripe subscription routes (authentication disabled)
  app.post('/api/create-subscription', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      let user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.stripeSubscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
          expand: ['latest_invoice.payment_intent'],
        });

        const invoice = subscription.latest_invoice as any;
        res.json({
          subscriptionId: subscription.id,
          clientSecret: invoice?.payment_intent?.client_secret,
        });
        return;
      }
      
      if (!user.email) {
        return res.status(400).json({ message: 'No user email on file' });
      }

      const customer = await stripe.customers.create({
        email: user.email,
        name: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : undefined,
      });

      // Create a price for the subscription
      const price = await stripe.prices.create({
        currency: 'usd',
        unit_amount: 499, // $4.99 in cents
        recurring: {
          interval: 'month',
        },
        product_data: {
          name: 'Stage Performance App - Pro',
        },
      });

      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{
          price: price.id,
        }],
        payment_behavior: 'default_incomplete',
        payment_settings: {
          save_default_payment_method: 'on_subscription',
        },
        expand: ['latest_invoice.payment_intent'],
      });

      console.log('Created subscription:', subscription.id);
      console.log('Latest invoice:', subscription.latest_invoice);
      console.log('Payment intent:', (subscription.latest_invoice as any)?.payment_intent);

      await storage.updateUserStripeInfo(userId, customer.id, subscription.id);
  
      const invoice = subscription.latest_invoice as any;
      const clientSecret = invoice?.payment_intent?.client_secret;
      
      console.log('Sending response with clientSecret:', clientSecret ? 'Present' : 'Missing');
      
      res.json({
        subscriptionId: subscription.id,
        clientSecret: clientSecret,
        status: subscription.status,
        invoice_status: invoice?.status,
      });
    } catch (error: any) {
      console.error('Subscription creation error:', error);
      return res.status(400).json({ error: { message: error.message } });
    }
  });

  // Check subscription status
  app.get('/api/subscription/status', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!user.stripeSubscriptionId) {
        return res.json({ hasSubscription: false });
      }

      const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
      
      res.json({
        hasSubscription: true,
        status: subscription.status,
        currentPeriodEnd: (subscription as any).current_period_end,
        cancelAtPeriodEnd: (subscription as any).cancel_at_period_end,
      });
    } catch (error) {
      console.error('Error checking subscription status:', error);
      res.status(500).json({ message: "Failed to check subscription status" });
    }
  });

  // Cancel subscription (authentication disabled)
  app.post('/api/subscription/cancel', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || !user.stripeSubscriptionId) {
        return res.status(404).json({ message: "No subscription found" });
      }

      const subscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
      
      res.json({
        message: "Subscription will be canceled at the end of the current period",
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      });
    } catch (error) {
      console.error('Error canceling subscription:', error);
      res.status(500).json({ message: "Failed to cancel subscription" });
    }
  });

  // Serve uploaded files
  app.use("/uploads", express.static(uploadDir));

  // Songs routes (authentication disabled for testing)
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
      console.log('DELETE request received for song ID:', req.params.id);
      const success = await storage.deleteSong(req.params.id);
      if (!success) {
        console.log('Song deletion failed - not found:', req.params.id);
        return res.status(404).json({ message: "Song not found" });
      }
      console.log('Song deletion successful:', req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error('Error in DELETE /api/songs/:id:', error);
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

  // Upload audio file and store in database as base64
  app.post("/api/tracks/:id/audio", upload.single('audio'), async (req, res) => {
    try {
      const trackId = req.params.id;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ message: "No audio file provided" });
      }

      // Convert file buffer to base64
      const audioData = file.buffer.toString('base64');
      
      // Store in database
      await storage.storeAudioFile(trackId, audioData, file.mimetype, file.size);

      res.json({ 
        message: "Audio file stored successfully",
        trackId,
        size: file.size,
        mimeType: file.mimetype,
        success: true
      });
    } catch (error) {
      console.error('Error storing audio file:', error);
      res.status(500).json({ message: "Failed to store audio file" });
    }
  });

  // Get audio file from database
  app.get("/api/tracks/:id/audio", async (req, res) => {
    try {
      const trackId = req.params.id;
      const audioFile = await storage.getAudioFileData(trackId);

      if (!audioFile) {
        return res.status(404).json({ message: "Audio file not found" });
      }

      // Convert base64 back to buffer
      const buffer = Buffer.from(audioFile.data, 'base64');
      
      res.set({
        'Content-Type': audioFile.mimeType,
        'Content-Length': audioFile.size.toString(),
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
      });

      res.send(buffer);
    } catch (error) {
      console.error('Error retrieving audio file:', error);
      res.status(500).json({ message: "Failed to retrieve audio file" });
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

  // Legacy persistence routes (no-op - data is now in cloud database)
  app.post("/api/persistence/save", (req, res) => {
    res.json({ 
      success: true, 
      message: "Data is automatically saved to cloud database",
      timestamp: new Date().toISOString() 
    });
  });

  app.post("/api/persistence/load", (req, res) => {
    res.json({ success: true, message: "Data is loaded from cloud database automatically" });
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

  // Waveform caching routes
  app.post("/api/waveforms/:songId", async (req, res) => {
    try {
      const { songId } = req.params;
      const { waveformData } = req.body;
      
      if (!Array.isArray(waveformData)) {
        return res.status(400).json({ error: 'Invalid waveform data' });
      }
      
      await storage.saveWaveform(songId, waveformData);
      res.json({ success: true, message: 'Waveform saved successfully' });
    } catch (error) {
      console.error('Error saving waveform:', error);
      res.status(500).json({ error: 'Failed to save waveform' });
    }
  });

  app.get("/api/waveforms/:songId", async (req, res) => {
    try {
      const { songId } = req.params;
      const waveformData = await storage.getWaveform(songId);
      
      if (waveformData) {
        res.json({ success: true, waveformData });
      } else {
        res.status(404).json({ success: false, message: 'Waveform not found' });
      }
    } catch (error) {
      console.error('Error loading waveform:', error);
      res.status(500).json({ error: 'Failed to load waveform' });
    }
  });

  // Set up auto-save callback
  storage.setAutoSaveCallback(() => {
    console.log("Auto-save triggered");
  });

  // File Registry API for persistent file tracking
  const REGISTRY_FILE_PATH = path.join(process.cwd(), "data", "file-registry.json");

  // Ensure data directory exists
  const dataDir = path.dirname(REGISTRY_FILE_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  app.get("/api/file-registry", async (req, res) => {
    try {
      if (fs.existsSync(REGISTRY_FILE_PATH)) {
        const registryData = await fsPromises.readFile(REGISTRY_FILE_PATH, 'utf8');
        const registry = JSON.parse(registryData);
        res.json(registry);
      } else {
        // Return empty registry
        const emptyRegistry = {
          version: '1.0.0',
          lastUpdated: Date.now(),
          files: []
        };
        res.json(emptyRegistry);
      }
    } catch (error) {
      console.error('Error reading file registry:', error);
      res.status(500).json({ message: "Failed to read file registry" });
    }
  });

  app.post("/api/file-registry", async (req, res) => {
    try {
      const registryData = JSON.stringify(req.body, null, 2);
      await fsPromises.writeFile(REGISTRY_FILE_PATH, registryData, 'utf8');
      console.log('File registry saved successfully');
      res.json({ success: true });
    } catch (error) {
      console.error('Error saving file registry:', error);
      res.status(500).json({ message: "Failed to save file registry" });
    }
  });

  // File Path Configuration API for persistent file location tracking
  const FILE_PATHS_CONFIG_PATH = path.join(process.cwd(), "data", "file-paths-config.json");

  app.get("/api/file-paths", async (req, res) => {
    try {
      if (fs.existsSync(FILE_PATHS_CONFIG_PATH)) {
        const configData = await fsPromises.readFile(FILE_PATHS_CONFIG_PATH, 'utf8');
        const config = JSON.parse(configData);
        res.json(config);
      } else {
        // Return empty config
        const emptyConfig = {
          version: '1.0.0',
          lastUpdated: Date.now(),
          mappings: []
        };
        res.json(emptyConfig);
      }
    } catch (error) {
      console.error('Error reading file paths config:', error);
      res.status(500).json({ message: "Failed to read file paths config" });
    }
  });

  app.post("/api/file-paths", async (req, res) => {
    try {
      const configData = JSON.stringify(req.body, null, 2);
      await fsPromises.writeFile(FILE_PATHS_CONFIG_PATH, configData, 'utf8');
      console.log(`File paths config saved with ${req.body.mappings?.length || 0} mappings`);
      res.json({ success: true });
    } catch (error) {
      console.error('Error saving file paths config:', error);
      res.status(500).json({ message: "Failed to save file paths config" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
