import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useUpgradePrompt } from "@/hooks/useSubscription";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ListMusic, Plus, FolderOpen, Search, ExternalLink, Loader2 } from "lucide-react";
import type { Song, InsertSong } from "@shared/schema";

interface SongSelectorProps {
  selectedSongId: string | null;
  onSongSelect: (songId: string) => void;
}

export default function SongSelector({ selectedSongId, onSongSelect }: SongSelectorProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSearchingLyrics, setIsSearchingLyrics] = useState(false);
  const [searchResult, setSearchResult] = useState<any>(null);
  const [newSong, setNewSong] = useState<InsertSong>({
    userId: "", // Will be set when creating
    title: "",
    artist: "",
    duration: 180, // Default duration, will be updated when tracks are added
    bpm: undefined,
    key: "",
    lyrics: ""
  });

  const { toast } = useToast();
  const { handleSongLimitExceeded } = useUpgradePrompt();

  const { data: songsData = [], isLoading } = useQuery<Song[]>({
    queryKey: ['/api/songs']
  });

  // Sort songs alphabetically by title
  const songs = songsData.sort((a, b) => a.title.localeCompare(b.title));

  const createSongMutation = useMutation({
    mutationFn: async (songData: InsertSong) => {
      const response = await apiRequest('POST', '/api/songs', songData);
      if (!response.ok) {
        const errorData = await response.json();
        const error = new Error(errorData.message || 'Failed to create song');
        error.response = response;
        error.data = errorData;
        throw error;
      }
      return response.json();
    },
    onSuccess: (song) => {
      queryClient.invalidateQueries({ queryKey: ['/api/songs'] });
      setIsAddDialogOpen(false);
      setNewSong({
        userId: "", // Will be set when creating
        title: "",
        artist: "",
        duration: 180, // Default duration, will be updated when tracks are added
        bpm: undefined,
        key: "",
        lyrics: ""
      });
      onSongSelect(song.id);
      toast({
        title: "Song created",
        description: `${song.title} has been added successfully.`
      });
    },
    onError: async (error) => {
      // Check if it's a song limit error
      if (error instanceof Error && error.message.includes('song_limit_exceeded')) {
        handleSongLimitExceeded();
        return;
      }
      
      // Check if response contains upgrade prompt
      try {
        const errorResponse = await error.response?.json();
        if (errorResponse?.error === 'song_limit_exceeded') {
          handleSongLimitExceeded();
          return;
        }
      } catch {
        // Fall through to regular error handling
      }

      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create song",
        variant: "destructive"
      });
    }
  });

  const handleCreateSong = () => {
    if (!newSong.title.trim() || !newSong.artist.trim()) {
      toast({
        title: "Validation Error",
        description: "Title and artist are required",
        variant: "destructive"
      });
      return;
    }

    // Set userId from localStorage or default
    const userId = localStorage.getItem('userId') || 'default-user';
    createSongMutation.mutate({ ...newSong, userId });
  };

  const handleSearchLyrics = async () => {
    if (!newSong.title.trim() || !newSong.artist.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter both title and artist to search for lyrics",
        variant: "destructive"
      });
      return;
    }

    setIsSearchingLyrics(true);
    setSearchResult(null);

    try {
      const response = await apiRequest('POST', '/api/lyrics/search', {
        title: newSong.title,
        artist: newSong.artist
      });

      const data = await response.json();
      
      if (data.success) {
        // Direct lyrics found - unlikely with current server implementation
        setNewSong({ ...newSong, lyrics: data.lyrics });
        toast({
          title: "Lyrics Found",
          description: "Lyrics have been automatically added to your song"
        });
      } else if (data.openBrowser && data.searchResult) {
        // Found a lyrics page to open
        setSearchResult(data.searchResult);
        toast({
          title: "Lyrics Page Found",
          description: "Opening lyrics page for manual copy-paste"
        });
        
        // Open the URL in a new tab
        window.open(data.searchResult.url, '_blank');
      } else {
        toast({
          title: "No Lyrics Found",
          description: data.message || "Could not find lyrics for this song",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Lyrics search error:', error);
      toast({
        title: "Search Error",
        description: "Failed to search for lyrics. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSearchingLyrics(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold flex items-center">
          <ListMusic className="mr-2 text-primary w-5 h-5" />
          Song Selection
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
                  <Label htmlFor="bpm">BPM</Label>
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
      
      {songs.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <ListMusic className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No songs available. Add your first song to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {songs.map((song) => (
            <Card
              key={song.id}
              className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
                selectedSongId === song.id
                  ? 'bg-gray-800 border-2 border-primary'
                  : 'bg-gray-800 border border-gray-600 hover:bg-gray-750'
              }`}
              onClick={() => onSongSelect(song.id)}
              data-testid={`song-card-${song.id}`}
            >
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-1">
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
