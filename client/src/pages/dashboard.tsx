import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Cast, Users, Radio, Link2, LogOut, Upload, User, Copy, Crown, X, HelpCircle, Megaphone } from 'lucide-react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useBroadcast } from '@/hooks/useBroadcast';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { saveUserProfile, loadUserProfile, updateProfileField, initializeUserProfile } from '@/lib/firestore-profile';

export default function Dashboard() {
  const { user, userEmail } = useLocalStorage();
  const logout = () => {}; // No logout needed in mobile app
  const { 
    broadcastId,
    isHost, 
    isViewer, 
    startBroadcast, 
    joinBroadcast, 
    leave
  } = useBroadcast();
  
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [broadcastName, setBroadcastName] = useState('');
  const [roomIdToJoin, setRoomIdToJoin] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const devMessage = ''; // Blank for now - removed Firestore
  
  // Profile form state
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    password: '', // Add password field
    customBroadcastId: ''
  });
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  
  // Inline editing states
  
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    password: '', // Add password field
    customBroadcastId: ''
  });
  
  // Generate display broadcast ID based on custom ID or fallback
  const getBroadcastId = () => {
    // Use custom ID if set
    if (profileData.customBroadcastId) {
      return profileData.customBroadcastId;
    }
    // Generate fallback for professional users
    if (user?.userType === 'professional') {
      return `PRO-${user.email.split('@')[0].toUpperCase().substring(0, 6)}-${user.email.length}${Date.now().toString().slice(-3)}`;
    }
    return null;
  };

  const displayBroadcastId = getBroadcastId();
  
  // Determine broadcast permissions
  const canBroadcast = user?.userType === 'professional';
  const canJoin = user?.userType === 'premium' || user?.userType === 'professional';

  // Load user profile from Firestore
  useEffect(() => {
    const loadUserData = async () => {
      try {
        // Initialize profile if first time user
        await initializeUserProfile(user?.email);
        
        // Load profile from Firestore
        const profile = await loadUserProfile();
        
        if (profile) {
          const newProfileData = {
            firstName: profile.firstName || '',
            lastName: profile.lastName || '',
            phone: profile.phone || '',
            email: profile.email || user?.email || '',
            password: '', // Password never loaded from database for security
            customBroadcastId: profile.customBroadcastId || ''
          };
          
          setProfileData(newProfileData);
          setEditValues(newProfileData);
          setProfilePhoto(profile.profilePhoto || null);
          
          console.log('✅ User profile loaded from Firestore');
        } else {
          console.log('📭 No profile found - initialized new profile');
        }
      } catch (error) {
        console.error('❌ Error loading user profile from Firestore:', error);
        toast({
          title: "Profile Load Failed",
          description: "Could not load your profile. Using local defaults.",
          variant: "destructive"
        });
      }
    };

    loadUserData();
  }, [user?.email, toast]);

  const handleStartBroadcast = async () => {
    if (!user || !broadcastName.trim()) return;
    
    // Check if user has permission to broadcast
    if (!canBroadcast) {
      toast({
        title: "Permission Denied",
        description: "Only Professional users can start broadcasts. Upgrade to Professional to broadcast.",
        variant: "destructive"
      });
      return;
    }
    
    setIsStarting(true);
    try {
      console.log('🎭 Starting broadcast:', broadcastName.trim());
      // Use Firestore-native API instead of old REST endpoint
      await startBroadcast(broadcastName.trim());
      
      localStorage.setItem('activeBroadcast', broadcastName.trim());
      toast({
        title: "🎭 Broadcast Started!",
        description: `"${broadcastName}" is now live!\nRedirecting to performance page...`
      });
      setBroadcastName('');
      
      // Redirect to performance page after successful broadcast start
      setTimeout(() => {
        setLocation('/');
      }, 1000); // Small delay to let user see the success message
      
    } catch (error: any) {
      console.error('❌ Broadcast start error:', error);
      toast({
        title: "Failed to start broadcast",
        description: error.message || "Please check your internet connection and try again.",
        variant: "destructive"
      });
    } finally {
      setIsStarting(false);
    }
  };

  const handleJoinBroadcast = async () => {
    if (!user || !roomIdToJoin.trim()) return;
    
    // Check if user has permission to join
    if (!canJoin) {
      toast({
        title: "Permission Denied",
        description: "Only Premium and Professional users can join broadcasts. Upgrade to Premium to join broadcasts.",
        variant: "destructive"
      });
      return;
    }
    
    setIsJoining(true);
    try {
      // Skip server-side broadcast check, directly use Firestore
      const unsubscribe = joinBroadcast(roomIdToJoin.trim());
      
      toast({
        title: "🎵 Joined Broadcast!",
        description: `Connected to "${roomIdToJoin}"! Redirecting to viewer...`
      });
      setRoomIdToJoin('');
      
      // Redirect to dedicated broadcast viewer page after successful join
      setTimeout(() => {
        setLocation('/broadcast-viewer');
      }, 1000); // Small delay to let user see the success message
    } catch (error) {
      console.error('Join broadcast error:', error);
      toast({
        title: "Connection failed",
        description: "Unable to connect to the broadcast",
        variant: "destructive"
      });
      setIsJoining(false); // Only reset if failed
    }
  };

  const handleLeaveBroadcast = () => {
    leave();
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

    setIsUploadingPhoto(true);

    try {
      // Create an image element to compress the image
      const img = new Image();
      const reader = new FileReader();

      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };

      img.onload = async () => {
        // Create canvas to resize/compress image
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Calculate new dimensions (max 800x800 to keep file size down)
        let width = img.width;
        let height = img.height;
        const maxSize = 800;
        
        if (width > height && width > maxSize) {
          height = (height / width) * maxSize;
          width = maxSize;
        } else if (height > maxSize) {
          width = (width / height) * maxSize;
          height = maxSize;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw and compress
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Convert to base64 with quality adjustment (0.7 = 70% quality)
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
        
        // Check final size (Firestore limit is ~1MB)
        const sizeInBytes = compressedDataUrl.length * 0.75; // Rough base64 size calculation
        const sizeInMB = sizeInBytes / (1024 * 1024);
        
        if (sizeInMB > 0.9) {
          toast({
            title: "Image still too large",
            description: "Please try a smaller image or a different photo.",
            variant: "destructive"
          });
          setIsUploadingPhoto(false);
          return;
        }
        
        // Save to Firestore
        await updateProfileField('profilePhoto', compressedDataUrl);
        setProfilePhoto(compressedDataUrl);
        setIsUploadingPhoto(false);
        
        toast({
          title: "Photo updated!",
          description: "Your profile photo has been saved to the cloud."
        });
      };

      img.onerror = () => {
        toast({
          title: "Error loading image",
          description: "Could not process the image file.",
          variant: "destructive"
        });
        setIsUploadingPhoto(false);
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading photo:', error);
      setIsUploadingPhoto(false);
      toast({
        title: "Upload failed",
        description: "Failed to save your profile photo. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleFieldEdit = (field: string) => {
    setEditingField(field);
    setEditValues({
      firstName: profileData.firstName,
      lastName: profileData.lastName,
      phone: profileData.phone,
      email: profileData.email,
      password: profileData.password,
      customBroadcastId: profileData.customBroadcastId
    });
  };

  const handleFieldSave = async (field: string) => {
    setIsUpdatingProfile(true);
    
    try {
      const value = editValues[field as keyof typeof editValues];
      
      // Save to Firestore (password is hashed/stored securely in real implementation)
      await updateProfileField(field as any, value);
      
      setProfileData(prev => ({ ...prev, [field]: value }));
      setEditingField(null);
      
      const fieldName = field === 'firstName' ? 'First name' : 
                       field === 'lastName' ? 'Last name' : 
                       field === 'phone' ? 'Phone' :
                       field === 'email' ? 'Email' :
                       field === 'password' ? 'Password' : field;
      
      toast({
        title: `${fieldName} updated`,
        description: "Your profile has been synced to the cloud."
      });
    } catch (error) {
      toast({
        title: "Update failed",
        description: "Failed to update profile. Please try again.",
        variant: "destructive"
      });
    }
    
    setIsUpdatingProfile(false);
  };

  const handleFieldCancel = () => {
    setEditingField(null);
    setEditValues({
      firstName: profileData.firstName,
      lastName: profileData.lastName,
      phone: profileData.phone,
      email: profileData.email,
      password: profileData.password,
      customBroadcastId: profileData.customBroadcastId
    });
  };


  // Phone number formatting utility
  const formatPhoneNumber = (phone: string) => {
    if (!phone) return '';
    
    // Remove all non-digits
    const digits = phone.replace(/\D/g, '');
    
    // Format as (XXX) XXX-XXXX
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    
    // For other lengths, return as-is or with basic formatting
    if (digits.length === 11 && digits[0] === '1') {
      return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    
    return phone; // Return original if not standard format
  };

  const handlePhoneInput = (value: string) => {
    // Allow input but format on the fly
    const digits = value.replace(/\D/g, '');
    let formatted = digits;
    
    if (digits.length >= 6) {
      formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    } else if (digits.length >= 3) {
      formatted = `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    }
    
    setEditValues(prev => ({ ...prev, phone: digits })); // Store raw digits
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
    if (displayBroadcastId) {
      navigator.clipboard.writeText(displayBroadcastId);
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
                {profileData.firstName ? `Welcome, ${profileData.firstName}` : 'Welcome'}
              </p>
            </div>
            {/* Dev Message */}
            {devMessage && (
              <div className="flex-1 mx-8 max-w-2xl">
                <div className="dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md px-3 py-2 bg-[#0d1216] text-[#7a7878] mt-[-15px] mb-[-15px]">
                  <div className="flex items-start gap-2">
                    <Megaphone className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm dark:text-blue-100 text-[#9d9fa8] whitespace-pre-wrap">{devMessage}</p>
                  </div>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                onClick={() => window.location.href = '/'}
              >
                ← Back
              </Button>
            </div>
          </div>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* BROADCAST SYSTEM TEMPORARILY HIDDEN - DO NOT DELETE */}
        {/* Current Broadcast Status */}
        {false && (isHost || isViewer) && broadcastId && (
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
                  Connected
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-0 bg-[#000000]">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <Label className="text-sm font-medium">Room ID</Label>
                  <div className="flex items-center gap-2">
                    <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded text-lg font-mono">
                      {broadcastId}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigator.clipboard.writeText(broadcastId)}
                    >
                      <Link2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Broadcast Name</Label>
                  <p className="text-lg">{broadcastId}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Participants</Label>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span className="text-lg">1</span>
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
            {/* BROADCAST CONTROLS TEMPORARILY HIDDEN - DO NOT DELETE */}
            {/* Left Column - Broadcast Controls */}
            {false && (
            <div className="lg:col-span-1 space-y-4">
              {/* Start Broadcast */}
              <Card className={!canBroadcast ? 'opacity-60' : ''}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Cast className="h-5 w-5" />
                    Start Broadcasting
                    {!canBroadcast && <Badge variant="outline" className="text-xs">Professional Only</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-gray-400">
                    {canBroadcast 
                      ? "Share your performance screen with band members in real-time"
                      : "Upgrade to Professional to start broadcasts"
                    }
                  </p>
                  {canBroadcast ? (
                    <>
                      <div>
                        <Label htmlFor="broadcast-name">Broadcast Name</Label>
                        <Input
                          id="broadcast-name"
                          placeholder={displayBroadcastId ? `${displayBroadcastId} Show` : "Tonight's Show"}
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
                    </>
                  ) : (
                    <Button
                      onClick={() => window.location.href = '/subscribe'}
                      className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                    >
                      <Crown className="h-4 w-4 mr-2" />
                      Upgrade to Professional
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Join Broadcast */}
              <Card className={!canJoin ? 'opacity-60' : ''}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Radio className="h-5 w-5" />
                    Join Broadcast
                    {!canJoin && <Badge variant="outline" className="text-xs">Premium+</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-gray-400">
                    {canJoin 
                      ? "Enter the broadcast name to join someone's live performance"
                      : "Upgrade to Premium to join broadcasts"
                    }
                  </p>
                  {canJoin ? (
                    <>
                      <div>
                        <Label htmlFor="room-id">Broadcast Name</Label>
                        <Input
                          id="room-id"
                          placeholder="Tonight's Show"
                          value={roomIdToJoin}
                          onChange={(e) => setRoomIdToJoin(e.target.value)}
                        />
                      </div>
                      <Button 
                        onClick={handleJoinBroadcast}
                        disabled={!roomIdToJoin.trim() || isJoining}
                        className="w-full"
                      >
                        {isJoining ? 'Joining...' : 'Join Broadcast'}
                      </Button>
                    </>
                  ) : (
                    <Button
                      onClick={() => window.location.href = '/subscribe'}
                      className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                    >
                      <Crown className="h-4 w-4 mr-2" />
                      Upgrade to Premium
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
            )}
            {/* END BROADCAST CONTROLS - HIDDEN */}

            {/* Right Column - User Card */}
            <div className="lg:col-span-3">{/* Changed from lg:col-span-2 to take full width */}
              <Card className="h-fit">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      User Profile
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {user.userType === 'professional' ? (
                        <>
                          <Crown className="h-4 w-4 text-yellow-500" />
                          <Badge variant="secondary">Professional</Badge>
                        </>
                      ) : (
                        <>
                          <User className="h-4 w-4" />
                          <Badge variant="secondary">{user.userType || 'Free'}</Badge>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Profile Photo & Basic Info */}
                  <div className="flex items-start gap-4">
                    <Avatar className="h-20 w-20">
                      <AvatarImage src={profilePhoto || undefined} />
                      <AvatarFallback>
                        <User className="h-8 w-8" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingPhoto}
                        className="w-fit"
                      >
                        {isUploadingPhoto ? (
                          <>
                            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            Change Photo
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
                    </div>
                  </div>

                  {/* Profile Information - Inline Editing */}
                  <div className="space-y-3">
                    {/* First & Last Name Row */}
                    <div className="grid grid-cols-2 gap-3">
                      {/* First Name */}
                      <div>
                        <Label className="text-xs text-muted-foreground">First Name</Label>
                        {editingField === 'firstName' ? (
                          <div className="flex items-center gap-1 mt-1">
                            <Input
                              value={editValues.firstName}
                              onChange={(e) => setEditValues(prev => ({ ...prev, firstName: e.target.value }))}
                              className="h-8 text-sm flex-1"
                              placeholder="Enter first name"
                              autoFocus
                            />
                            <Button 
                              size="sm" 
                              onClick={() => handleFieldSave('firstName')}
                              disabled={isUpdatingProfile}
                              className="h-8 px-1.5"
                            >
                              ✓
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={handleFieldCancel}
                              className="h-8 px-1.5"
                            >
                              ✕
                            </Button>
                          </div>
                        ) : (
                          <div 
                            onClick={() => handleFieldEdit('firstName')}
                            className="mt-1 p-2 rounded cursor-pointer hover:bg-muted/50 transition-colors"
                          >
                            <span className="text-[20px] font-semibold">
                              {profileData.firstName || 'Click to add first name'}
                            </span>
                            {!profileData.firstName && <span className="text-muted-foreground text-sm ml-2">✎</span>}
                          </div>
                        )}
                      </div>

                      {/* Last Name */}
                      <div>
                        <Label className="text-xs text-muted-foreground">Last Name</Label>
                        {editingField === 'lastName' ? (
                          <div className="flex items-center gap-1 mt-1">
                            <Input
                              value={editValues.lastName}
                              onChange={(e) => setEditValues(prev => ({ ...prev, lastName: e.target.value }))}
                              className="h-8 text-sm flex-1"
                              placeholder="Enter last name"
                              autoFocus
                            />
                            <Button 
                              size="sm" 
                              onClick={() => handleFieldSave('lastName')}
                              disabled={isUpdatingProfile}
                              className="h-8 px-1.5"
                            >
                              ✓
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={handleFieldCancel}
                              className="h-8 px-1.5"
                            >
                              ✕
                            </Button>
                          </div>
                        ) : (
                          <div 
                            onClick={() => handleFieldEdit('lastName')}
                            className="mt-1 p-2 rounded cursor-pointer hover:bg-muted/50 transition-colors"
                          >
                            <span className="text-[20px] font-semibold">
                              {profileData.lastName || 'Click to add last name'}
                            </span>
                            {!profileData.lastName && <span className="text-muted-foreground text-sm ml-2">✎</span>}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Phone */}
                    <div>
                      <Label className="text-xs text-muted-foreground">Phone</Label>
                      {editingField === 'phone' ? (
                        <div className="flex items-center gap-2 mt-1">
                          <Input
                            value={formatPhoneNumber(editValues.phone)}
                            onChange={(e) => handlePhoneInput(e.target.value)}
                            className="h-8 text-sm flex-1"
                            placeholder="(555) 123-4567"
                            autoFocus
                            maxLength={14} // Max length for formatted phone
                          />
                          <Button 
                            size="sm" 
                            onClick={() => handleFieldSave('phone')}
                            disabled={isUpdatingProfile}
                            className="h-8 px-2"
                          >
                            ✓
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={handleFieldCancel}
                            className="h-8 px-2"
                          >
                            ✕
                          </Button>
                        </div>
                      ) : (
                        <div 
                          onClick={() => handleFieldEdit('phone')}
                          className="mt-1 p-2 rounded cursor-pointer hover:bg-muted/50 transition-colors"
                        >
                          <span className="text-sm">
                            {formatPhoneNumber(profileData.phone) || 'Click to add phone number'}
                          </span>
                          {!profileData.phone && <span className="text-muted-foreground text-sm ml-2">✎</span>}
                        </div>
                      )}
                    </div>

                    {/* Email and Password - Side by Side */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* Email */}
                      <div>
                        <Label className="text-xs text-muted-foreground">Email</Label>
                        {editingField === 'email' ? (
                          <div className="flex items-center gap-2 mt-1">
                            <Input
                              type="email"
                              value={editValues.email}
                              onChange={(e) => setEditValues(prev => ({ ...prev, email: e.target.value }))}
                              className="h-8 text-sm flex-1"
                              placeholder="Email"
                              autoFocus
                            />
                            <Button 
                              size="sm" 
                              onClick={() => handleFieldSave('email')}
                              disabled={isUpdatingProfile}
                              className="h-8 px-2"
                            >
                              ✓
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={handleFieldCancel}
                              className="h-8 px-2"
                            >
                              ✕
                            </Button>
                          </div>
                        ) : (
                          <div 
                            onClick={() => handleFieldEdit('email')}
                            className="mt-1 p-2 rounded cursor-pointer hover:bg-muted/50 transition-colors"
                          >
                            <span className="text-sm">
                              {profileData.email || 'Click to add email'}
                            </span>
                            {!profileData.email && <span className="text-muted-foreground text-sm ml-2">✎</span>}
                          </div>
                        )}
                      </div>

                      {/* Password */}
                      <div>
                        <Label className="text-xs text-muted-foreground">Password (Optional)</Label>
                        {editingField === 'password' ? (
                          <div className="flex items-center gap-2 mt-1">
                            <Input
                              type="password"
                              value={editValues.password}
                              onChange={(e) => setEditValues(prev => ({ ...prev, password: e.target.value }))}
                              className="h-8 text-sm flex-1"
                              placeholder="Password"
                              autoFocus
                            />
                            <Button 
                              size="sm" 
                              onClick={() => handleFieldSave('password')}
                              disabled={isUpdatingProfile}
                              className="h-8 px-2"
                            >
                              ✓
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={handleFieldCancel}
                              className="h-8 px-2"
                            >
                              ✕
                            </Button>
                          </div>
                        ) : (
                          <div 
                            onClick={() => handleFieldEdit('password')}
                            className="mt-1 p-2 rounded cursor-pointer hover:bg-muted/50 transition-colors"
                          >
                            <span className="text-sm">
                              {profileData.password ? '••••••••' : 'Click to add password'}
                            </span>
                            {!profileData.password && <span className="text-muted-foreground text-sm ml-2">✎</span>}
                          </div>
                        )}
                      </div>
                    </div>

                  </div>


                  {/* ACCOUNT MANAGEMENT SECTION TEMPORARILY HIDDEN - DO NOT DELETE */}
                  {false && (
                  <div className="space-y-3 pt-4 border-t">
                    <h4 className="text-sm font-medium text-muted-foreground">Account Management</h4>
                    <div className="flex flex-col sm:flex-row gap-2">
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
                      
                      {/* TEMPORARILY HIDDEN - DO NOT DELETE */}
                      {false && user.userType !== 'free' && (
                        <Button
                          variant="outline"
                          onClick={() => window.location.href = '/unsubscribe'}
                        >
                          <X className="h-4 w-4 mr-2" />
                          Manage Subscription
                        </Button>
                      )}
                      
                      {/* TEMPORARILY HIDDEN - DO NOT DELETE */}
                      {false && (
                        <Button variant="outline" onClick={logout}>
                          <LogOut className="h-4 w-4 mr-2" />
                          Logout
                        </Button>
                      )}
                    </div>
                  </div>
                  )}
                  {/* END ACCOUNT MANAGEMENT SECTION - HIDDEN */}

                  {/* Help & Support */}
                  <div className="space-y-3 pt-4 border-t">
                    <h4 className="text-sm font-medium text-muted-foreground flex items-center">
                      <HelpCircle className="h-4 w-4 mr-2" />
                      Need Help?
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Send help requests to{' '}
                      <a 
                        href="mailto:mazzu001@hotmail.com" 
                        className="text-blue-600 hover:underline"
                        data-testid="link-help-email"
                      >
                        mazzu001@hotmail.com
                      </a>
                    </p>
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