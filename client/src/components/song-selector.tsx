import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useUpgradePrompt } from "@/hooks/useSubscription";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ListMusic, Plus, FolderOpen, Search, ExternalLink, Loader2, Trash2 } from "lucide-react";
import type { Song, InsertSong } from "@shared/schema";

interface SongSelectorProps {
  selectedSongId: string | null;
  onSongSelect: (songId: string) => void;
}

export default function SongSelector({ selectedSongId, onSongSelect }: SongSelectorProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSearchingLyrics, setIsSearchingLyrics] = useState(false);
  const [searchResult, setSearchResult] = useState<any>(null);
  const [selectedSongs, setSelectedSongs] = useState<Set<string>>(new Set());
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
  
  // Delete song mutation
  const deleteSongMutation = useMutation({
    mutationFn: async (songId: string) => {
      const response = await apiRequest('DELETE', `/api/songs/${songId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete song');
      }
      return response.json();
    },
    onSuccess: (_, songId) => {
      queryClient.invalidateQueries({ queryKey: ['/api/songs'] });
      // Clear selection if deleted song was selected
      if (selectedSongId === songId) {
        onSongSelect('');
      }
      toast({
        title: "Song deleted",
        description: "The song has been removed successfully."
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete song",
        variant: "destructive"
      });
    }
  });

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
        (error as any).response = response;
        (error as any).data = errorData;
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
        const errorResponse = await (error as any).response?.json();
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

  // Checkbox handlers
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
    const songTitles = songs.filter(s => selectedSongs.has(s.id)).map(s => s.title);
    const confirmMsg = `Delete ${selectedSongs.size} song(s)?: ${songTitles.join(', ')}\n\nThis action cannot be undone.`;
    
    if (window.confirm(confirmMsg)) {
      // Delete all selected songs
      for (const songId of Array.from(selectedSongs)) {
        try {
          await deleteSongMutation.mutateAsync(songId);
        } catch (error) {
          console.error('Failed to delete song:', songId, error);
        }
      }
      setSelectedSongs(new Set());
    }
  };




  const handleCardClick = (e: React.MouseEvent, songId: string) => {
    // Add comprehensive error handling to prevent crashes during song selection
    try {
      console.log(`🎵 Attempting to load song: ${songId}`);
      
      // Get song info for logging
      const song = songs.find(s => s.id === songId);
      const songName = song?.title || 'Unknown Song';
      
      console.log(`🔄 Loading song: "${songName}"`);
      
      // Wrap the song selection in a timeout to prevent hanging
      const loadPromise = Promise.resolve(onSongSelect(songId));
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Song loading timeout')), 5000); // 5 second timeout
      });
      
      Promise.race([loadPromise, timeoutPromise]).catch(error => {
        console.error(`❌ Failed to load song "${songName}":`, error);
        // Show user-friendly error message but don't crash
        alert(`Unable to load "${songName}". This song may be corrupted. You can try deleting it using the checkbox.`);
      });
      
    } catch (error) {
      console.error(`❌ Critical error during song selection:`, error);
      // Emergency fallback - show error but keep UI responsive
      const song = songs.find(s => s.id === songId);
      const songName = song?.title || 'Unknown Song';
      alert(`Error loading "${songName}". The song may be corrupted. Use the checkbox to select and delete it.`);
    }
  };
  
  const handleCheckboxClick = (e: React.MouseEvent) => {
    // Prevent song selection when clicking checkbox
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
                    <Label htmlFor="lyrics">Lyrics (with timestamps)</Label>
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
                    placeholder="[00:15] First line of lyrics&#10;[00:30] Second line...&#10;[00:45] Third line..."
                    className="min-h-[200px] resize-y"
                    data-testid="input-song-lyrics"
                  />
                  <div className="text-xs text-muted-foreground mt-1">
                    Tip: Use timestamps like [01:30] for synchronized lyrics display
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
        
        {/* Delete selected songs button */}
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
              {/* Song card wrapper */}
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
