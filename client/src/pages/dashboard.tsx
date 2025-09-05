import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Cast, Users, Radio, Link2, LogOut } from 'lucide-react';
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Dashboard</h1>
              <p className="text-gray-600 dark:text-gray-400">
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
              <Button variant="outline" onClick={logout}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
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

        {/* Broadcast Actions */}
        {!isHost && !isViewer && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Start Broadcast */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cast className="h-5 w-5" />
                  Start Broadcasting
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
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
                <p className="text-sm text-gray-600 dark:text-gray-400">
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
        )}

        {/* User Profile */}
        <Card>
          <CardHeader>
            <CardTitle>User Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Email</Label>
                <p className="text-lg">{user.email}</p>
              </div>
              <div>
                <Label>Account Type</Label>
                <Badge variant="secondary" className="text-lg">
                  {user.userType || 'Free'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}