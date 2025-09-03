import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
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
  const [swipeStates, setSwipeStates] = useState<Record<string, { deltaX: number; isDeleting: boolean }>>({});
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [currentDragSong, setCurrentDragSong] = useState<string | null>(null);
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

  // Touch/Mouse handlers for swipe-to-delete
  const handleStart = (clientX: number, clientY: number, songId: string, eventType: string) => {
    setTouchStart({ x: clientX, y: clientY });
    setSwipeStates(prev => ({ ...prev, [songId]: { deltaX: 0, isDeleting: false } }));
  };

  const handleTouchStart = (e: React.TouchEvent, songId: string) => {
    e.stopPropagation(); // Prevent triggering onClick
    const touch = e.touches[0];
    handleStart(touch.clientX, touch.clientY, songId, 'Touch');
  };

  const handleMouseDown = (e: React.MouseEvent, songId: string) => {
    console.log('🖱️ MOUSE DOWN on song:', songId, 'at', e.clientX, e.clientY);
    e.stopPropagation(); // Prevent triggering onClick
    e.preventDefault(); // Prevent text selection
    setIsDragging(true);
    setCurrentDragSong(songId);
    handleStart(e.clientX, e.clientY, songId, 'Mouse');
  };

  const handleMove = (clientX: number, clientY: number, songId: string, eventType: string) => {
    if (!touchStart) {
      console.log('❌ No touchStart in handleMove');
      return;
    }
    
    const deltaX = clientX - touchStart.x;
    const deltaY = Math.abs(clientY - touchStart.y);
    console.log(`📏 ${eventType} MOVE - deltaX: ${deltaX}, deltaY: ${deltaY}`);
    
    // Only allow horizontal swipes (avoid conflicts with vertical scrolling)
    if (deltaY < 30) {
      setSwipeStates(prev => ({
        ...prev,
        [songId]: {
          deltaX: Math.max(0, deltaX), // Only allow right swipes
          isDeleting: deltaX > 150 // Delete threshold
        }
      }));
    }
  };

  const handleTouchMove = (e: React.TouchEvent, songId: string) => {
    e.preventDefault(); // Prevent scrolling while swiping
    const touch = e.touches[0];
    handleMove(touch.clientX, touch.clientY, songId, 'Touch');
  };

  // Global mouse move handler for proper drag support
  const handleGlobalMouseMove = (e: MouseEvent) => {
    console.log('🖱️ GLOBAL MOUSE MOVE - isDragging:', isDragging, 'currentSong:', currentDragSong);
    if (!isDragging || !currentDragSong) return;
    e.preventDefault();
    handleMove(e.clientX, e.clientY, currentDragSong, 'Mouse');
  };

  // Global mouse up handler
  const handleGlobalMouseUp = (e: MouseEvent) => {
    if (!isDragging || !currentDragSong) return;
    const song = songs.find(s => s.id === currentDragSong);
    if (song) {
      handleEnd(currentDragSong, song.title, 'Mouse');
    }
    setIsDragging(false);
    setCurrentDragSong(null);
  };

  const handleMouseMove = (e: React.MouseEvent, songId: string) => {
    // This is just for fallback - global handlers should handle most cases
    if (!isDragging) return;
    e.preventDefault();
    handleMove(e.clientX, e.clientY, songId, 'Mouse');
  };

  const handleEnd = (songId: string, songTitle: string, eventType: string) => {
    if (!touchStart || !swipeStates[songId]) return;
    
    const state = swipeStates[songId];
    
    // If swipe was long enough, delete the song
    if (state.deltaX > 150) {
      // Show confirmation for safety
      if (window.confirm(`Delete "${songTitle}"? This action cannot be undone.`)) {
        deleteSongMutation.mutate(songId);
      }
    }
    
    // Reset swipe state
    setTouchStart(null);
    setSwipeStates(prev => {
      // No need to check prev since it's always defined
      const newState = { ...prev };
      delete newState[songId];
      return newState;
    });
  };

  const handleTouchEnd = (e: React.TouchEvent, songId: string, songTitle: string) => {
    handleEnd(songId, songTitle, 'Touch');
  };

  const handleMouseUp = (e: React.MouseEvent, songId: string, songTitle: string) => {
    if (isDragging && currentDragSong === songId) {
      handleEnd(songId, songTitle, 'Mouse');
    }
    setIsDragging(false);
    setCurrentDragSong(null);
  };

  // Set up global event listeners for proper mouse drag support
  useEffect(() => {
    if (isDragging) {
      console.log('✅ Adding global listeners - isDragging:', isDragging, 'currentSong:', currentDragSong);
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
    } else {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging, currentDragSong]);

  const handleCardClick = (e: React.MouseEvent, songId: string) => {
    // Don't trigger selection if currently swiping
    const swipeState = swipeStates[songId];
    if (swipeState && swipeState.deltaX > 10) {
      e.preventDefault();
      return;
    }
    onSongSelect(songId);
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
          <p className="text-sm mt-2 opacity-60">💡 Tip: Once you have songs, swipe right on any song to delete it</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {songs.map((song) => {
            const swipeState = swipeStates[song.id];
            const transform = swipeState ? `translateX(${swipeState.deltaX}px)` : 'translateX(0px)';
            const isBeingDeleted = swipeState?.isDeleting || false;
            
            return (
            <div key={song.id} className="relative overflow-hidden rounded-lg">
              {/* Delete background that shows when swiping */}
              <div className={`absolute inset-0 bg-red-600 flex items-center justify-end px-4 rounded-lg transition-opacity duration-200 ${
(swipeState?.deltaX || 0) > 50 ? 'opacity-100' : 'opacity-0'
              }`}>
                <div className="flex items-center text-white font-medium">
                  <Trash2 className="w-5 h-5 mr-2" />
                  {isBeingDeleted ? 'Release to Delete' : 'Swipe to Delete'}
                </div>
              </div>
              
              {/* Song card wrapper with proper event handling */}
              <div
                className={`cursor-pointer transition-all duration-200 hover:shadow-lg relative z-10 rounded-lg ${
                  selectedSongId === song.id
                    ? 'bg-gray-800 border-2 border-primary'
                    : 'bg-gray-800 border border-gray-600 hover:bg-gray-750'
                } ${isBeingDeleted ? 'bg-red-100 dark:bg-red-900' : ''}`}
                style={{
                  transform,
                  transition: swipeState ? 'none' : 'transform 0.3s ease-out'
                }}
                onClick={(e) => {
                  console.log('🖱️ CLICK EVENT fired on song:', song.id);
                  handleCardClick(e, song.id);
                }}
                onTouchStart={(e) => handleTouchStart(e, song.id)}
                onTouchMove={(e) => handleTouchMove(e, song.id)}
                onTouchEnd={(e) => handleTouchEnd(e, song.id, song.title)}
                onMouseDown={(e) => {
                  console.log('🖱️ RAW MOUSE DOWN event fired on song:', song.id);
                  handleMouseDown(e, song.id);
                }}
                onMouseMove={(e) => handleMouseMove(e, song.id)}
                onMouseUp={(e) => handleMouseUp(e, song.id, song.title)}
                data-testid={`song-card-${song.id}`}
              >
                <div className="p-3">
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
