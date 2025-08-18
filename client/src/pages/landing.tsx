import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Music, Zap, Mic, Volume2 } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="flex justify-between items-center mb-16">
          <div className="flex items-center space-x-2">
            <Music className="w-8 h-8 text-purple-400" />
            <span className="text-2xl font-bold">Stage Performance App</span>
          </div>
          <Button 
            onClick={() => window.location.href = '/api/login'}
            className="bg-purple-600 hover:bg-purple-700"
            data-testid="button-login"
          >
            Sign In
          </Button>
        </header>

        {/* Hero Section */}
        <div className="text-center mb-20">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Professional Live Performance
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto">
            Multi-track audio mixing, synchronized lyrics, and MIDI control for stage musicians who demand perfection.
          </p>
          <Button 
            size="lg"
            onClick={() => window.location.href = '/api/login'}
            className="bg-purple-600 hover:bg-purple-700 text-lg px-8 py-3"
            data-testid="button-get-started"
          >
            Get Started - $4.99/month
          </Button>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20">
          <Card className="bg-slate-800/50 border-slate-700 text-white">
            <CardHeader>
              <Volume2 className="w-10 h-10 text-purple-400 mb-2" />
              <CardTitle>6-Track Audio Mixing</CardTitle>
              <CardDescription className="text-gray-300">
                Professional audio engine with individual volume, mute, and solo controls for up to 6 backing tracks per song.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700 text-white">
            <CardHeader>
              <Mic className="w-10 h-10 text-purple-400 mb-2" />
              <CardTitle>Synchronized Lyrics</CardTitle>
              <CardDescription className="text-gray-300">
                Auto-scrolling lyrics display with embedded MIDI commands and timestamp synchronization for live performances.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700 text-white">
            <CardHeader>
              <Zap className="w-10 h-10 text-purple-400 mb-2" />
              <CardTitle>MIDI Integration</CardTitle>
              <CardDescription className="text-gray-300">
                Trigger MIDI events at specific times during playback for lighting, effects, and equipment control.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700 text-white">
            <CardHeader>
              <Music className="w-10 h-10 text-purple-400 mb-2" />
              <CardTitle>Offline Operation</CardTitle>
              <CardDescription className="text-gray-300">
                Works completely offline with local audio files. No internet required during performances.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700 text-white">
            <CardHeader>
              <Check className="w-10 h-10 text-purple-400 mb-2" />
              <CardTitle>Real-time Visualization</CardTitle>
              <CardDescription className="text-gray-300">
                Live audio level meters and waveform visualization for professional monitoring.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700 text-white">
            <CardHeader>
              <Zap className="w-10 h-10 text-purple-400 mb-2" />
              <CardTitle>Auto-Save System</CardTitle>
              <CardDescription className="text-gray-300">
                Automatic persistence to local storage with file path references for instant startup.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Pricing */}
        <div className="text-center mb-20">
          <h2 className="text-4xl font-bold mb-8">Simple, Professional Pricing</h2>
          <Card className="max-w-md mx-auto bg-slate-800/50 border-purple-500 text-white">
            <CardHeader>
              <CardTitle className="text-2xl">Pro Musician</CardTitle>
              <div className="text-4xl font-bold text-purple-400">$4.99<span className="text-lg text-gray-300">/month</span></div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-left mb-6">
                <li className="flex items-center">
                  <Check className="w-5 h-5 text-green-400 mr-2" />
                  Up to 6 tracks per song
                </li>
                <li className="flex items-center">
                  <Check className="w-5 h-5 text-green-400 mr-2" />
                  Unlimited songs
                </li>
                <li className="flex items-center">
                  <Check className="w-5 h-5 text-green-400 mr-2" />
                  MIDI event sequencing
                </li>
                <li className="flex items-center">
                  <Check className="w-5 h-5 text-green-400 mr-2" />
                  Lyrics import & editing
                </li>
                <li className="flex items-center">
                  <Check className="w-5 h-5 text-green-400 mr-2" />
                  Offline operation
                </li>
                <li className="flex items-center">
                  <Check className="w-5 h-5 text-green-400 mr-2" />
                  Real-time visualization
                </li>
              </ul>
              <Button 
                className="w-full bg-purple-600 hover:bg-purple-700"
                onClick={() => window.location.href = '/api/login'}
                data-testid="button-subscribe"
              >
                Start Free Trial
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <footer className="text-center text-gray-400">
          <p>&copy; 2025 Stage Performance App. Built for professional musicians.</p>
        </footer>
      </div>
    </div>
  );
}