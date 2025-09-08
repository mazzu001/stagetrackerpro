import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, blob } from "drizzle-orm/sqlite-core";
import { pgTable, text as pgText, integer as pgInteger, timestamp, varchar, index, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const songs = sqliteTable("songs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull(), // Associate songs with users
  title: text("title").notNull(),
  artist: text("artist").notNull(),
  duration: integer("duration").notNull(), // in seconds
  bpm: integer("bpm"),
  key: text("key"),
  lyrics: text("lyrics"), // lyrics with timestamps
  waveformData: text("waveform_data"), // JSON array of waveform amplitudes
  waveformGenerated: integer("waveform_generated", { mode: 'boolean' }).default(false),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const tracks = sqliteTable("tracks", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  songId: text("song_id").references(() => songs.id).notNull(),
  name: text("name").notNull(),
  trackNumber: integer("track_number").notNull(),
  audioUrl: text("audio_url").notNull(), // Will be blob URL or "blob:stored" for database blobs
  localFileName: text("local_file_name"), // Store original filename for display
  audioData: text("audio_data"), // Base64 encoded audio blob data
  mimeType: text("mime_type").default('audio/mpeg'), // MIME type of audio file
  fileSize: integer("file_size").default(0), // File size in bytes
  volume: integer("volume").default(100), // 0-100
  balance: integer("balance").default(0), // -50 to +50 (L to R)
  isMuted: integer("is_muted", { mode: 'boolean' }).default(false),
  isSolo: integer("is_solo", { mode: 'boolean' }).default(false),
});

// MIDI events table removed - MIDI functionality disabled

export const insertSongSchema = createInsertSchema(songs).omit({
  id: true,
  createdAt: true,
});

export const insertTrackSchema = createInsertSchema(tracks).omit({
  id: true,
});

// MIDI event schema removed - MIDI functionality disabled

export type InsertSong = z.infer<typeof insertSongSchema>;
export type Song = typeof songs.$inferSelect;

export type InsertTrack = z.infer<typeof insertTrackSchema>;
export type Track = typeof tracks.$inferSelect;

// MIDI event types removed - MIDI functionality disabled

export type SongWithTracks = Song & {
  tracks: Track[];
};

// SQLite tables are now only for music data - user data moved to PostgreSQL

// Session storage table for PostgreSQL (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for PostgreSQL (required for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  phone: varchar("phone"),
  profileImageUrl: varchar("profile_image_url"),
  profilePhoto: pgText("profile_photo"), // Base64 encoded image data
  userType: varchar("user_type"), // free, premium, professional
  customBroadcastId: varchar("custom_broadcast_id", { length: 50 }), // User's custom broadcast ID
  subscriptionStatus: pgInteger("subscription_status").default(1), // 1 = free, 2 = premium, 3 = professional
  stripeCustomerId: varchar("stripe_customer_id"),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  subscriptionEndDate: timestamp("subscription_end_date"),
  songCount: pgInteger("song_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// SIMPLE BROADCAST SYSTEM - Pure SQL approach
// Table per broadcaster - tracks which song is currently active
export const broadcastSessions = pgTable("broadcast_sessions", {
  id: varchar("id").primaryKey(), // Broadcast name (e.g. "Matt") 
  name: varchar("name").notNull(), // Display name
  hostEmail: varchar("host_email").notNull(), // Host email
  currentSongId: varchar("current_song_id"), // Points to active song in broadcast_songs
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Song entries - all song data stored here with unique IDs
export const broadcastSongs = pgTable("broadcast_songs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`), // Unique song entry ID
  broadcastId: varchar("broadcast_id").notNull(), // Which broadcast table (e.g. "Matt")
  songTitle: varchar("song_title").notNull(),
  artistName: varchar("artist_name"),
  lyrics: pgText("lyrics"), // Timestamped lyrics like [0:02]She said...
  waveformData: jsonb("waveform_data"), // Waveform visualization data
  position: pgInteger("position").default(0), // Current playback position in seconds
  isPlaying: boolean("is_playing").default(false), // Playback state
  createdAt: timestamp("created_at").defaultNow(),
});

export type BroadcastSession = typeof broadcastSessions.$inferSelect;
export type InsertBroadcastSession = typeof broadcastSessions.$inferInsert;
export type BroadcastSong = typeof broadcastSongs.$inferSelect;
export type InsertBroadcastSong = typeof broadcastSongs.$inferInsert;
