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

        {/* Demo Video Section */}
        <div className="mb-16">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-4">See StageTracker Pro in Action</h2>
            <p className="text-lg text-gray-300 max-w-3xl mx-auto">Watch how professional musicians use StageTracker Pro for live performances with multi-track backing tracks and MIDI control.</p>
          </div>
          <div className="max-w-4xl mx-auto">
            <div className="relative w-full h-0 pb-[56.25%] rounded-lg overflow-hidden shadow-2xl">
              <iframe
                className="absolute top-0 left-0 w-full h-full"
                src="https://www.youtube.com/embed/y76YiXaUrqY"
                title="StageTracker Pro Demo"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                data-testid="video-demo"
              ></iframe>
            </div>
          </div>
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
              <CardDescription className="text-gray-400">Timed MIDI events embedded in lyrics for lighting and effects control. Time stamps help your lyrics scroll in perfect time with the music Karaoke style as well as firing midi commands to the second to control your lighting, instrunments and gear.</CardDescription>
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
            <CardTitle className="text-2xl text-white">Start Your FREE Trial</CardTitle>
            <CardDescription className="text-gray-400">
              <span className="text-green-400 font-semibold">✓ No Credit Card Required</span><br/>
              <span className="text-green-400 font-semibold">✓ 2 Free Songs Included</span><br/>
              <span className="text-green-400 font-semibold">✓ Instant Access</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={() => setIsLoginOpen(true)}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold"
              size="lg"
              data-testid="button-signup"
            >
              🚀 Start FREE Trial - No Credit Card!
            </Button>
            <Button 
              onClick={() => setIsLoginOpen(true)}
              variant="outline"
              className="w-full border-purple-600 text-purple-400 hover:bg-purple-600 hover:text-white"
              size="lg"
              data-testid="button-login"
            >
              Already Have an Account? Sign In
            </Button>

          </CardContent>
        </Card>

        <LoginPopup
          isOpen={isLoginOpen}
          onClose={() => setIsLoginOpen(false)}
          onLogin={login}
        />

        {/* Trial Info */}
        <div className="text-center mt-12">
          <div className="bg-gradient-to-r from-green-600/20 to-blue-600/20 border border-green-500/30 rounded-lg p-6 max-w-2xl mx-auto">
            <h3 className="text-xl font-bold text-white mb-3">🎉 100% FREE to Get Started</h3>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="text-green-400">
                <p className="font-semibold">✓ No Credit Card Required</p>
                <p className="font-semibold">✓ No Hidden Fees</p>
                <p className="font-semibold">✓ Cancel Anytime</p>
              </div>
              <div className="text-blue-400">
                <p className="font-semibold">✓ 2 Free Songs Forever</p>
                <p className="font-semibold">✓ Full MIDI Features</p>
                <p className="font-semibold">✓ Offline Performance</p>
              </div>
            </div>
            <p className="text-gray-300 mt-4 text-sm">
              Upgrade to unlimited songs for just $4.99/month when you're ready
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}