import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, blob } from "drizzle-orm/sqlite-core";
import { pgTable, text as pgText, integer as pgInteger, timestamp } from "drizzle-orm/pg-core";
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

// User table for subscription tracking  
export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text("email").unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  profileImageUrl: text("profile_image_url"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionStatus: text("subscription_status"), // active, canceled, incomplete, etc.
  subscriptionEndDate: text("subscription_end_date"), // ISO datetime string
  songCount: integer("song_count").default(0),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

export const insertUserSchema = createInsertSchema(users).omit({
  createdAt: true,
  updatedAt: true,
});

export const upsertUserSchema = createInsertSchema(users).omit({
  createdAt: true,
  updatedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type User = typeof users.$inferSelect;

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = sqliteTable("sessions", {
  sid: text("sid").primaryKey(),
  sess: text("sess").notNull(), // JSON string instead of jsonb
  expire: text("expire").notNull(), // ISO datetime string
});

// PostgreSQL versions for cloud database
export const usersPg = pgTable("users", {
  id: pgText("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: pgText("email").unique(),
  firstName: pgText("first_name"),
  lastName: pgText("last_name"),
  profileImageUrl: pgText("profile_image_url"),
  passwordHash: pgText("password_hash"),
  stripeCustomerId: pgText("stripe_customer_id"),
  stripeSubscriptionId: pgText("stripe_subscription_id"),
  subscriptionStatus: pgInteger("subscription_status").default(1), // 1 = free, 2 = premium
  subscriptionEndDate: pgText("subscription_end_date"), // ISO datetime string
  songCount: pgInteger("song_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const sessionsPg = pgTable("sessions", {
  sid: pgText("sid").primaryKey(),
  sess: pgText("sess").notNull(), // JSON string instead of jsonb
  expire: timestamp("expire").notNull(),
});

// PostgreSQL user types
export type UserPg = typeof usersPg.$inferSelect;
export type UpsertUserPg = z.infer<typeof insertUserSchema>;
