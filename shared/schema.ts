import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const songs = pgTable("songs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  artist: text("artist").notNull(),
  duration: integer("duration").notNull(), // in seconds
  bpm: integer("bpm"),
  key: text("key"),
  lyrics: text("lyrics"), // lyrics with timestamps and MIDI commands
  createdAt: text("created_at").default(sql`now()`),
});

export const tracks = pgTable("tracks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  songId: varchar("song_id").references(() => songs.id).notNull(),
  name: text("name").notNull(),
  trackNumber: integer("track_number").notNull(),
  audioUrl: text("audio_url").notNull(),
  localFileName: text("local_file_name"), // Store original filename for display
  volume: integer("volume").default(100), // 0-100
  balance: integer("balance").default(0), // -50 to +50 (L to R)
  isMuted: boolean("is_muted").default(false),
  isSolo: boolean("is_solo").default(false),
}, (table) => ({
  uniqueTrackNumber: sql`UNIQUE (${table.songId}, ${table.trackNumber})`
}));

export const midiEvents = pgTable("midi_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  songId: varchar("song_id").references(() => songs.id).notNull(),
  timestamp: integer("timestamp").notNull(), // milliseconds
  eventType: text("event_type").notNull(), // 'program_change', 'control_change', etc.
  channel: integer("channel").default(1),
  data1: integer("data1"),
  data2: integer("data2"),
  description: text("description"),
});

export const insertSongSchema = createInsertSchema(songs).omit({
  id: true,
  createdAt: true,
});

export const insertTrackSchema = createInsertSchema(tracks).omit({
  id: true,
});

export const insertMidiEventSchema = createInsertSchema(midiEvents).omit({
  id: true,
});

export type InsertSong = z.infer<typeof insertSongSchema>;
export type Song = typeof songs.$inferSelect;

export type InsertTrack = z.infer<typeof insertTrackSchema>;
export type Track = typeof tracks.$inferSelect;

export type InsertMidiEvent = z.infer<typeof insertMidiEventSchema>;
export type MidiEvent = typeof midiEvents.$inferSelect;

export type SongWithTracks = Song & {
  tracks: Track[];
  midiEvents: MidiEvent[];
};
