import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Music, Shield, Zap } from "lucide-react";
import { LoginPopup } from '@/components/login-popup';
import { useLocalAuth } from '@/hooks/useLocalAuth';

export default function Landing() {
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const { login } = useLocalAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="flex justify-center items-center gap-3 mb-6">
            <Music className="w-12 h-12 text-purple-400" />
            <h1 className="text-4xl font-bold text-white">StageTracker Pro</h1>
          </div>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">Professional live music performance application with multi-track audio for pre recorded backing tracks, MIDI sequencing, and synchronized lyrics display.</p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <Music className="w-8 h-8 text-purple-400 mb-2" />
              <CardTitle className="text-white">Multi-Track Audio</CardTitle>
              <CardDescription className="text-gray-400">Mix up to 6 audio tracks with individual volume, mute, and solo controls for each song. Up to 2 songs for free accounts and unlimited songs for subscribers.</CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <Zap className="w-8 h-8 text-yellow-400 mb-2" />
              <CardTitle className="text-white">MIDI Integration and Time Stamps</CardTitle>
              <CardDescription className="text-gray-400">Timed MIDI events embedded in lyrics for lighting and effects control (coming soon). Time stamps help your lyrics scroll in perfect time with the music Karaoke style.</CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <Shield className="w-8 h-8 text-green-400 mb-2" />
              <CardTitle className="text-white">Offline First</CardTitle>
              <CardDescription className="text-gray-400">Complete local file storage for reliable live performance without internet. With local storage StageTracker Pro offers lightning fast load times because your stage performance depends on it.</CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Login Section */}
        <Card className="max-w-md mx-auto bg-slate-800/70 border-slate-600">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-white">Get Started</CardTitle>
            <CardDescription className="text-gray-400">
              Sign in to access your personal music collection
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={() => setIsLoginOpen(true)}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              size="lg"
              data-testid="button-login"
            >
              Sign In
            </Button>
            <Button 
              onClick={() => setIsLoginOpen(true)}
              variant="outline"
              className="w-full border-purple-600 text-purple-400 hover:bg-purple-600 hover:text-white"
              size="lg"
              data-testid="button-signup"
            >
              Sign Up
            </Button>
            <p className="text-xs text-gray-500 text-center">
              Local authentication • No internet required
            </p>
          </CardContent>
        </Card>

        <LoginPopup
          isOpen={isLoginOpen}
          onClose={() => setIsLoginOpen(false)}
          onLogin={login}
        />

        {/* Trial Info */}
        <div className="text-center mt-12">
          <p className="text-gray-400">
            Start with 2 free songs • $4.99/month for unlimited songs
          </p>
        </div>
      </div>
    </div>
  );
}