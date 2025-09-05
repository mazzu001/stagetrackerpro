import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, blob } from "drizzle-orm/sqlite-core";
import { pgTable, text as pgText, integer as pgInteger, timestamp, varchar, index, jsonb } from "drizzle-orm/pg-core";
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
