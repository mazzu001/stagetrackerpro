import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Music, Radio, Users, Crown, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function DemoInfo() {
  const { toast } = useToast();

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`,
    });
  };

  const features = [
    {
      icon: <Radio className="h-5 w-5" />,
      title: "Live Broadcasting", 
      description: "Stream music performances in real-time to multiple listeners",
      badge: "Professional Feature"
    },
    {
      icon: <Users className="h-5 w-5" />,
      title: "Join Broadcasts",
      description: "Connect to live performances and follow along with lyrics",
      badge: "Premium Feature"
    },
    {
      icon: <Music className="h-5 w-5" />,
      title: "Music Performance",
      description: "Multi-track audio playback with professional mixing controls",
      badge: "Core Feature"
    },
    {
      icon: <CheckCircle className="h-5 w-5" />,
      title: "Karaoke Lyrics",
      description: "Real-time synchronized lyrics with auto-scrolling and highlighting",
      badge: "Premium Feature"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center space-x-2">
            <Crown className="h-8 w-8 text-purple-600" />
            <h1 className="text-4xl font-bold text-foreground">StageTracker Demo</h1>
          </div>
          <p className="text-xl text-muted-foreground">
            Professional music broadcasting platform for live performances
          </p>
          <Badge variant="outline" className="text-lg px-4 py-2">
            YouTuber Testing Account
          </Badge>
        </div>

        {/* Demo Account Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Crown className="h-5 w-5 text-purple-600" />
              <span>Demo Account Credentials</span>
            </CardTitle>
            <CardDescription>
              Use this account to test all professional features
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">Email:</span>
                <div className="flex items-center space-x-2">
                  <code className="bg-background px-2 py-1 rounded">youtuber@stagetracker.demo</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard("youtuber@stagetracker.demo", "Email")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium">Subscription:</span>
                <Badge variant="default" className="bg-purple-600">
                  Professional (All Features)
                </Badge>
              </div>
            </div>
            
            <div className="text-sm text-muted-foreground">
              <p><strong>Note:</strong> Click "Log in with Replit" and use the email above to access the demo account.</p>
            </div>
          </CardContent>
        </Card>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 gap-4">
          {features.map((feature, index) => (
            <Card key={index}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {feature.icon}
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {feature.badge}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>{feature.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Start Guide */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Start Guide</CardTitle>
            <CardDescription>Get started testing StageTracker in minutes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <div className="bg-purple-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">1</div>
                <div>
                  <p className="font-medium">Login</p>
                  <p className="text-sm text-muted-foreground">Click "Log in with Replit" and use: youtuber@stagetracker.demo</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="bg-purple-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">2</div>
                <div>
                  <p className="font-medium">Test Music Features</p>
                  <p className="text-sm text-muted-foreground">Upload songs, create playlists, and test the professional mixing interface</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="bg-purple-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">3</div>
                <div>
                  <p className="font-medium">Test Broadcasting</p>
                  <p className="text-sm text-muted-foreground">Start a live broadcast and share real-time music with synchronized lyrics</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="bg-purple-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">4</div>
                <div>
                  <p className="font-medium">Test Listener Experience</p>
                  <p className="text-sm text-muted-foreground">Join broadcasts from another device/browser to see the live listener view</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Technical Info */}
        <Card>
          <CardHeader>
            <CardTitle>Technical Highlights</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="font-medium text-purple-600">Real-time WebSockets</p>
                <p className="text-muted-foreground">Live broadcasting with instant sync</p>
              </div>
              <div>
                <p className="font-medium text-purple-600">Offline-first Design</p>
                <p className="text-muted-foreground">Works without internet for local performance</p>
              </div>
              <div>
                <p className="font-medium text-purple-600">Professional Audio</p>
                <p className="text-muted-foreground">Multi-track mixing with real-time controls</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}