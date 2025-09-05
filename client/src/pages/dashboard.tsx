import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Cast, Users, Radio, Link2, LogOut, Upload, User, Copy, Crown, X } from 'lucide-react';
import { useLocalAuth } from '@/hooks/useLocalAuth';
import { useBroadcast } from '@/hooks/useBroadcast';
import { useToast } from '@/hooks/use-toast';

export default function Dashboard() {
  const { user, logout } = useLocalAuth();
  const { 
    currentRoom, 
    isHost, 
    isViewer, 
    isConnected,
    startBroadcast, 
    joinBroadcast, 
    leaveBroadcast 
  } = useBroadcast();
  
  const { toast } = useToast();
  const [broadcastName, setBroadcastName] = useState('');
  const [roomIdToJoin, setRoomIdToJoin] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Generate permanent broadcast ID for professional users
  const permanentBroadcastId = user?.userType === 'professional' 
    ? `PRO-${user.email.split('@')[0].toUpperCase().substring(0, 6)}-${user.email.length}${Date.now().toString().slice(-3)}`
    : null;

  const handleStartBroadcast = async () => {
    if (!user || !broadcastName.trim()) return;
    
    setIsStarting(true);
    try {
      const roomId = await startBroadcast(user.email, user.email, broadcastName);
      toast({
        title: "🎭 Broadcast Started!",
        description: `Room ID: ${roomId}\nShare this ID with your band members.`
      });
      setBroadcastName('');
    } catch (error) {
      toast({
        title: "Failed to start broadcast",
        description: "Please try again",
        variant: "destructive"
      });
    }
    setIsStarting(false);
  };

  const handleJoinBroadcast = async () => {
    if (!user || !roomIdToJoin.trim()) return;
    
    setIsJoining(true);
    try {
      const success = await joinBroadcast(roomIdToJoin, user.email, user.email);
      if (success) {
        toast({
          title: "🎵 Joined Broadcast!",
          description: "You're now viewing the host's performance."
        });
        setRoomIdToJoin('');
      } else {
        toast({
          title: "Failed to join broadcast",
          description: "Room not found or no longer active",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Connection failed",
        description: "Please check the room ID and try again",
        variant: "destructive"
      });
    }
    setIsJoining(false);
  };

  const handleLeaveBroadcast = () => {
    leaveBroadcast();
    toast({
      title: isHost ? "Broadcast ended" : "Left broadcast",
      description: isHost ? "Your broadcast has been stopped" : "You've disconnected from the broadcast"
    });
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) {
      toast({
        title: "Invalid file",
        description: "Please select a valid image file.",
        variant: "destructive"
      });
      return;
    }

    // Check file size (limit to 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 2MB to keep the database optimized.",
        variant: "destructive"
      });
      return;
    }

    setIsUploadingPhoto(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const result = e.target?.result as string;
        
        try {
          // Save to database instead of localStorage
          const response = await fetch('/api/profile-photo', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ photoData: result }),
          });

          if (response.ok) {
            setProfilePhoto(result);
            // Remove any old localStorage entry
            localStorage.removeItem(`profile_photo_${user?.email}`);
            setIsUploadingPhoto(false);
            toast({
              title: "Photo updated!",
              description: "Your profile photo has been saved successfully."
            });
          } else {
            throw new Error('Failed to upload photo');
          }
        } catch (error) {
          console.error('Error uploading photo:', error);
          setIsUploadingPhoto(false);
          toast({
            title: "Upload failed",
            description: "Failed to save your profile photo. Try a smaller image or check your connection.",
            variant: "destructive"
          });
        }
      };
      reader.readAsDataURL(file);
  };

  // Load profile photo from user data
  useEffect(() => {
    if (user?.profilePhoto) {
      setProfilePhoto(user.profilePhoto);
    } else if (user?.email) {
      // Check localStorage for legacy photos
      const savedPhoto = localStorage.getItem(`profile_photo_${user.email}`);
      if (savedPhoto) {
        setProfilePhoto(savedPhoto);
        // Migrate from localStorage to database
        fetch('/api/profile-photo', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ photoData: savedPhoto }),
        }).then(() => {
          // Remove from localStorage after successful migration
          localStorage.removeItem(`profile_photo_${user.email}`);
        }).catch(console.error);
      }
    }
  }, [user]);

  const copyPermanentId = () => {
    if (permanentBroadcastId) {
      navigator.clipboard.writeText(permanentBroadcastId);
      toast({
        title: "ID Copied!",
        description: "Your permanent broadcast ID has been copied to clipboard."
      });
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Please log in</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">You need to be logged in to access the dashboard.</p>
            <Button onClick={() => window.location.href = '/'}>
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="bg-surface border-b border-gray-700 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Dashboard</h1>
              <p className="text-gray-400">
                Welcome, {user.email}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                onClick={() => window.location.href = '/'}
              >
                ← Back to Performance
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Current Broadcast Status */}
        {(isHost || isViewer) && currentRoom && (
          <Card className="mb-6 border-blue-200 bg-blue-50 dark:bg-blue-900/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {isHost ? (
                  <>
                    <Cast className="h-5 w-5 text-blue-600" />
                    You're Broadcasting
                  </>
                ) : (
                  <>
                    <Radio className="h-5 w-5 text-green-600" />
                    Viewing Broadcast
                  </>
                )}
                <Badge variant="secondary" className="ml-2">
                  {isConnected ? 'Connected' : 'Offline'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <Label className="text-sm font-medium">Room ID</Label>
                  <div className="flex items-center gap-2">
                    <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded text-lg font-mono">
                      {currentRoom.id}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigator.clipboard.writeText(currentRoom.id)}
                    >
                      <Link2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Broadcast Name</Label>
                  <p className="text-lg">{currentRoom.name}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Participants</Label>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span className="text-lg">{currentRoom.participantCount}</span>
                  </div>
                </div>
              </div>
              <Button onClick={handleLeaveBroadcast} variant="destructive">
                {isHost ? 'End Broadcast' : 'Leave Broadcast'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Main Dashboard Layout */}
        {!isHost && !isViewer && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Left Side - Broadcast Controls */}
            <div className="space-y-4">
              {/* Start Broadcast */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Cast className="h-5 w-5" />
                    Start Broadcasting
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-gray-400">
                    Share your performance screen with band members in real-time
                  </p>
                  <div>
                    <Label htmlFor="broadcast-name">Broadcast Name</Label>
                    <Input
                      id="broadcast-name"
                      placeholder="Tonight's Show"
                      value={broadcastName}
                      onChange={(e) => setBroadcastName(e.target.value)}
                    />
                  </div>
                  <Button 
                    onClick={handleStartBroadcast}
                    disabled={!broadcastName.trim() || isStarting}
                    className="w-full"
                  >
                    {isStarting ? 'Starting...' : 'Start Broadcasting'}
                  </Button>
                </CardContent>
              </Card>

              {/* Join Broadcast */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Radio className="h-5 w-5" />
                    Join Broadcast
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-gray-400">
                    Enter a Room ID to view someone else's performance
                  </p>
                  <div>
                    <Label htmlFor="room-id">Room ID</Label>
                    <Input
                      id="room-id"
                      placeholder="STAGE-ABC123"
                      value={roomIdToJoin}
                      onChange={(e) => setRoomIdToJoin(e.target.value.toUpperCase())}
                    />
                  </div>
                  <Button 
                    onClick={handleJoinBroadcast}
                    disabled={!roomIdToJoin.trim() || isJoining}
                    className="w-full"
                  >
                    {isJoining ? 'Joining...' : 'Join Broadcast'}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Right Side - User Profile */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>User Profile</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Profile Photo Section */}
                  <div className="flex items-center gap-4">
                    <Avatar className="h-20 w-20">
                      <AvatarImage src={profilePhoto || undefined} />
                      <AvatarFallback>
                        <User className="h-8 w-8" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingPhoto}
                      >
                        {isUploadingPhoto ? (
                          <>
                            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            Upload Photo
                          </>
                        )}
                      </Button>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handlePhotoUpload}
                        accept="image/*"
                        className="hidden"
                      />
                      <p className="text-xs text-gray-500">
                        Upload a photo to personalize your experience
                      </p>
                    </div>
                  </div>

                  {/* User Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Email</Label>
                      <p className="text-lg">{user.email}</p>
                    </div>
                    <div>
                      <Label>Account Type</Label>
                      <div className="flex items-center gap-2">
                        {user.userType === 'professional' ? (
                          <>
                            <Crown className="h-4 w-4 text-yellow-500" />
                            <Badge variant="secondary" className="text-lg">
                              Professional
                            </Badge>
                          </>
                        ) : (
                          <>
                            <User className="h-4 w-4" />
                            <Badge variant="secondary" className="text-lg">
                              {user.userType || 'Free'}
                            </Badge>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Permanent Broadcast ID - Professional Users Only */}
                  {permanentBroadcastId && (
                    <div>
                      <Label>Permanent Broadcast ID</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="bg-muted px-2 py-1 rounded text-sm flex-1">
                          {permanentBroadcastId}
                        </code>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={copyPermanentId}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Professional users get a permanent broadcast ID for consistent team access
                      </p>
                    </div>
                  )}

                  {/* Subscription Actions */}
                  <div className="flex items-center gap-4 pt-4 border-t">
                    {user.userType !== 'professional' && (
                      <Button
                        variant="default"
                        onClick={() => window.location.href = '/subscribe'}
                        className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                      >
                        <Crown className="h-4 w-4 mr-2" />
                        {user.userType === 'free' ? 'Upgrade to Pro' : 'Upgrade to Professional'}
                      </Button>
                    )}
                    
                    {user.userType !== 'free' && (
                      <Button
                        variant="outline"
                        onClick={() => window.location.href = '/unsubscribe'}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Manage Subscription
                      </Button>
                    )}
                    
                    <Button variant="outline" onClick={logout}>
                      <LogOut className="h-4 w-4 mr-2" />
                      Logout
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}