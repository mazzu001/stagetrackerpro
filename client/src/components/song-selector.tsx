import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, ListMusic, Trash2, FolderOpen, Search, Loader2 } from "lucide-react";
import { LocalSongStorage } from "@/lib/local-song-storage";
import type { LocalSong } from "@/lib/local-song-storage";

interface Song {
  id: string;
  title: string;
  artist: string;
  duration: number;
  bpm?: number;
  key?: string;
  lyrics?: string;
  userId: string;
}

interface SongSelectorProps {
  onSongSelect: (songId: string) => void;
  selectedSongId?: string | null;
}

const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

export default function SongSelector({ onSongSelect, selectedSongId }: SongSelectorProps) {
  const [selectedSongs, setSelectedSongs] = useState<Set<string>>(new Set());
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newSong, setNewSong] = useState({
    title: "",
    artist: "",
    bpm: undefined as number | undefined,
    key: "",
    lyrics: "",
  });
  const [isSearchingLyrics, setIsSearchingLyrics] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get user from localStorage for offline-first approach
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const userEmail = user?.email || 'anonymous@local.dev';

  // Query songs from local storage
  const { data: songs = [], isLoading } = useQuery({
    queryKey: ["/api/songs", userEmail],
    queryFn: async (): Promise<LocalSong[]> => {
      if (!userEmail) {
        console.log('📋 No user email - returning empty song list');
        return [];
      }
      
      try {
        const allSongs = LocalSongStorage.getAllSongs(userEmail);
        console.log(`📋 Loaded ${allSongs.length} songs from local storage (alphabetically sorted)`);
        return allSongs;
      } catch (error) {
        console.error('❌ Failed to load songs from local storage:', error);
        return [];
      }
    },
    enabled: !!userEmail,
  });

  // Create song mutation
  const createSongMutation = useMutation({
    mutationFn: async (songData: typeof newSong): Promise<LocalSong> => {
      if (!songData.title.trim() || !songData.artist.trim()) {
        throw new Error("Title and artist are required");
      }

      try {
        console.log('💾 Creating song in local storage...');
        const song = LocalSongStorage.createSong(userEmail, {
          title: songData.title.trim(),
          artist: songData.artist.trim(),
          bpm: songData.bpm,
          key: songData.key || undefined,
          lyrics: songData.lyrics || undefined,
        });
        console.log(`✅ Song created successfully: "${song.title}"`);
        return song;
      } catch (error) {
        console.error('❌ Failed to create song:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/songs"] });
      setNewSong({ title: "", artist: "", bpm: undefined, key: "", lyrics: "" });
      setIsAddDialogOpen(false);
      toast({
        title: "Song Created",
        description: "Your song has been added successfully.",
      });
    },
    onError: (error) => {
      console.error("Failed to create song:", error);
      toast({
        title: "Failed to create song",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    },
  });

  const handleCreateSong = () => {
    createSongMutation.mutate(newSong);
  };

  const handleSearchLyrics = async () => {
    if (!newSong.title.trim() || !newSong.artist.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter song title and artist first",
        variant: "destructive",
      });
      return;
    }

    setIsSearchingLyrics(true);
    try {
      const response = await fetch("/api/search-lyrics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `${newSong.title} ${newSong.artist}`,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to search lyrics");
      }

      const data = await response.json();
      if (data.lyrics) {
        setNewSong({ ...newSong, lyrics: data.lyrics });
        toast({
          title: "Lyrics Found",
          description: "Lyrics have been automatically added to your song.",
        });
      } else {
        toast({
          title: "No Lyrics Found",
          description: "Could not find lyrics for this song. You can add them manually.",
        });
      }
    } catch (error) {
      console.error("Lyrics search failed:", error);
      toast({
        title: "Search Failed",
        description: "Could not search for lyrics. Please add them manually.",
        variant: "destructive",
      });
    } finally {
      setIsSearchingLyrics(false);
    }
  };

  const handleSongCheckboxChange = (songId: string, checked: boolean) => {
    const newSelected = new Set(selectedSongs);
    if (checked) {
      newSelected.add(songId);
    } else {
      newSelected.delete(songId);
    }
    setSelectedSongs(newSelected);
  };

  const handleDeleteSelectedSongs = async () => {
    if (selectedSongs.size === 0) return;

    try {
      const songsToDelete = Array.from(selectedSongs);
      const songNames = songsToDelete.map(id => {
        const song = songs.find(s => s.id === id);
        return song ? song.title : 'Unknown';
      }).join(', ');

      if (!confirm(`Are you sure you want to delete ${songsToDelete.length} song(s): ${songNames}?`)) {
        return;
      }

      console.log(`🗑️ Deleting ${songsToDelete.length} songs from local storage...`);
      
      for (const songId of songsToDelete) {
        try {
          LocalSongStorage.deleteSong(userEmail, songId);
          console.log(`✅ Deleted song: ${songId}`);
        } catch (error) {
          console.error(`❌ Failed to delete song ${songId}:`, error);
        }
      }

      // Clear selection and refresh
      setSelectedSongs(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/songs"] });
      
      toast({
        title: "Songs Deleted",
        description: `Successfully deleted ${songsToDelete.length} song(s).`,
      });
    } catch (error) {
      console.error('❌ Failed to delete songs:', error);
      toast({
        title: "Delete Failed",
        description: "Failed to delete selected songs",
        variant: "destructive",
      });
    }
  };

  const handleCardClick = (e: React.MouseEvent, songId: string) => {
    // Prevent propagation if clicking on checkbox
    if ((e.target as HTMLElement).closest('button[role="checkbox"]')) {
      return;
    }
    
    console.log(`🎵 Loading song: ${songs.find(s => s.id === songId)?.title || 'Unknown'}`);
    
    try {
      onSongSelect(songId);
    } catch (error) {
      console.error(`❌ Critical error during song selection:`, error);
      const song = songs.find(s => s.id === songId);
      const songName = song?.title || 'Unknown Song';
      alert(`Error loading "${songName}". The song may be corrupted. Use the checkbox to select and delete it.`);
    }
  };
  
  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  if (isLoading) {
    return (
      <div className="bg-surface rounded-xl p-6 border border-gray-700">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-700 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-xl p-6 border border-gray-700">
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold flex items-center">
            <ListMusic className="mr-2 text-primary w-5 h-5" />
            Songs
          </h2>
          <div className="flex space-x-2">
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  className="bg-primary hover:bg-blue-700 px-4 py-2 text-sm"
                  data-testid="button-add-song"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Song
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-surface border-gray-700">
                <DialogHeader>
                  <DialogTitle>Add New Song</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="title">Title *</Label>
                    <Input
                      id="title"
                      value={newSong.title}
                      onChange={(e) => setNewSong({ ...newSong, title: e.target.value })}
                      placeholder="Song title"
                      data-testid="input-song-title"
                    />
                  </div>
                  <div>
                    <Label htmlFor="artist">Artist *</Label>
                    <Input
                      id="artist"
                      value={newSong.artist}
                      onChange={(e) => setNewSong({ ...newSong, artist: e.target.value })}
                      placeholder="Artist name"
                      data-testid="input-song-artist"
                    />
                  </div>
                  <div>
                    <Label htmlFor="bpm">BPM (for click track)</Label>
                    <Input
                      id="bpm"
                      type="number"
                      value={newSong.bpm || ""}
                      onChange={(e) => setNewSong({ ...newSong, bpm: parseInt(e.target.value) || undefined })}
                      placeholder="120"
                      data-testid="input-song-bpm"
                    />
                  </div>
                  <div>
                    <Label htmlFor="key">Key</Label>
                    <Input
                      id="key"
                      value={newSong.key || ""}
                      onChange={(e) => setNewSong({ ...newSong, key: e.target.value })}
                      placeholder="C major"
                      data-testid="input-song-key"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label htmlFor="lyrics">Lyrics (with timestamps and MIDI commands)</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleSearchLyrics}
                        disabled={isSearchingLyrics || !newSong.title.trim() || !newSong.artist.trim()}
                        className="flex items-center gap-2"
                        data-testid="button-search-lyrics"
                      >
                        {isSearchingLyrics ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Search className="w-4 h-4" />
                        )}
                        {isSearchingLyrics ? "Searching..." : "Search Online"}
                      </Button>
                    </div>
                    
                    <Textarea
                      id="lyrics"
                      value={newSong.lyrics || ""}
                      onChange={(e) => setNewSong({ ...newSong, lyrics: e.target.value })}
                      placeholder="[00:15] First line of lyrics&#10;[00:30] <!-- MIDI: Program Change 1 -->&#10;[00:32] Second line..."
                      className="min-h-[200px] resize-y"
                      data-testid="input-song-lyrics"
                    />
                    <div className="text-xs text-muted-foreground mt-1">
                      Tip: Use timestamps like [01:30] and add MIDI commands with &lt;!-- MIDI: Program Change 1 --&gt;
                    </div>
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button 
                      variant="outline" 
                      onClick={() => setIsAddDialogOpen(false)}
                      data-testid="button-cancel-song"
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleCreateSong}
                      disabled={createSongMutation.isPending}
                      data-testid="button-save-song"
                    >
                      {createSongMutation.isPending ? "Creating..." : "Create Song"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            
            <Button 
              variant="secondary"
              className="bg-gray-700 hover:bg-gray-600 px-4 py-2 text-sm"
              data-testid="button-import-song"
            >
              <FolderOpen className="w-4 h-4 mr-1" />
              Import
            </Button>
          </div>
        </div>
        
        {selectedSongs.size > 0 && (
          <div className="flex justify-end mt-3">
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteSelectedSongs}
              data-testid="button-delete-selected"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Delete {selectedSongs.size} Selected Song{selectedSongs.size !== 1 ? 's' : ''}
            </Button>
          </div>
        )}
      </div>
      
      {songs.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <ListMusic className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No songs available. Add your first song to get started.</p>
          <p className="text-sm mt-2 opacity-60">💡 Tip: Check the boxes on songs to select them for deletion</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {songs.map((song) => {
            return (
              <div key={song.id} className="relative rounded-lg">
                <div
                  className={`transition-all duration-200 hover:shadow-lg rounded-lg ${
                    selectedSongId === song.id
                      ? 'bg-gray-800 border-2 border-primary'
                      : 'bg-gray-800 border border-gray-600 hover:bg-gray-750'
                  } cursor-pointer`}
                  onClick={(e) => handleCardClick(e, song.id)}
                  data-testid={`song-card-${song.id}`}
                >
                  <div className="p-3">
                    <div className="flex items-center justify-between mb-1">
                      <Checkbox
                        checked={selectedSongs.has(song.id)}
                        onCheckedChange={(checked) => handleSongCheckboxChange(song.id, checked as boolean)}
                        onClick={handleCheckboxClick}
                        className="mr-3"
                        data-testid={`checkbox-song-${song.id}`}
                      />
                      <h3 className="font-medium truncate">{song.title}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        selectedSongId === song.id
                          ? 'bg-secondary/20 text-secondary'
                          : 'bg-gray-600 text-gray-300'
                      }`}>
                        {selectedSongId === song.id ? 'LOADED' : 'READY'}
                      </span>
                    </div>
                    <div className="text-sm text-gray-400 space-y-0.5">
                      <div>Artist: <span className="text-gray-300">{song.artist}</span></div>
                      <div>Duration: <span className="text-gray-300">{formatDuration(song.duration)}</span></div>
                      {song.bpm && <div>BPM: <span className="text-gray-300">{song.bpm}</span></div>}
                      {song.key && <div>Key: <span className="text-gray-300">{song.key}</span></div>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}