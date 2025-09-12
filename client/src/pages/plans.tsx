import { useLocalAuth } from '@/hooks/useLocalAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Crown, Zap, Star, Music, BarChart3, Headphones, Cloud, MessageSquare, Gauge } from 'lucide-react';
import { useLocation } from 'wouter';

export default function Plans() {
  const { user } = useLocalAuth();
  const [, setLocation] = useLocation();

  const handleSubscribe = (plan: string) => {
    // Redirect to proper Stripe subscription flow
    setLocation('/subscribe');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-900 to-gray-900 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-white mb-6">
            Start Your Free Month Today
          </h1>
          <p className="text-xl text-gray-300 max-w-4xl mx-auto leading-relaxed">
            Get a full month free to experience professional-grade live performance tools. 
            No credit card required. After your trial, continue for just $4.99/month.
          </p>
          <div className="mt-8 flex justify-center">
            <Badge variant="outline" className="text-lg px-6 py-2 bg-green-800/50 border-green-600 text-green-300">
              🎉 1 Month Free Trial • No Credit Card Required
            </Badge>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid lg:grid-cols-2 gap-8 mb-16 max-w-4xl mx-auto">
          {/* Free Trial */}
          <Card className="border-2 border-green-500 relative shadow-2xl scale-105 bg-slate-800/95">
            <Badge className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-6 py-2 text-sm font-semibold">
              🎉 Start Here - Free Trial
            </Badge>
            <CardHeader className="text-center pb-8 bg-gradient-to-br from-green-900/30 to-emerald-900/30 rounded-t-lg">
              <div className="w-16 h-16 bg-gradient-to-br from-green-800 to-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <Star className="w-8 h-8 text-green-400" />
              </div>
              <CardTitle className="text-3xl font-bold text-white">1-Month Free Trial</CardTitle>
              <CardDescription className="text-lg text-gray-300">Full access for 30 days</CardDescription>
              <div className="text-5xl font-bold text-white mt-6">
                $0<span className="text-xl font-normal text-gray-400">/first month</span>
              </div>
              <p className="text-sm text-green-400 mt-2 font-medium">No credit card required</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-green-900/30 rounded-lg p-4 mb-4">
                <p className="text-sm font-semibold text-green-200 mb-2">
                  🎯 Everything you need to get started:
                </p>
              </div>
              <div className="space-y-4">
                <div className="flex items-start">
                  <Music className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-sm font-medium">Unlimited songs</span>
                    <p className="text-xs text-gray-400">Build your complete performance library</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <Gauge className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-sm font-medium">Full VU meters everywhere</span>
                    <p className="text-xs text-gray-400">Complete audio monitoring across all interfaces</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <BarChart3 className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-sm font-medium">Advanced waveform visualization</span>
                    <p className="text-xs text-gray-400">Professional-grade audio analysis and display</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <Headphones className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-sm font-medium">Complete audio engine</span>
                    <p className="text-xs text-gray-400">Full mixing capabilities and real-time processing</p>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="pt-6">
              <Button className="w-full h-12 text-lg bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 shadow-lg" onClick={() => handleSubscribe('trial')}>
                <Star className="w-5 h-5 mr-2" />
                Start Free Trial
              </Button>
            </CardFooter>
          </Card>

          {/* Continue After Trial */}
          <Card className="border border-slate-700 relative bg-slate-800/90 backdrop-blur-sm">
            <CardHeader className="text-center pb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-800 to-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <Crown className="w-8 h-8 text-blue-400" />
              </div>
              <CardTitle className="text-3xl font-bold text-white">Continue After Trial</CardTitle>
              <CardDescription className="text-lg text-gray-400">Keep all features after 30 days</CardDescription>
              <div className="text-5xl font-bold text-white mt-6">
                $4.99<span className="text-xl font-normal text-gray-400">/month</span>
              </div>
              <p className="text-sm text-blue-400 mt-2 font-medium">Cancel anytime</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-blue-900/30 rounded-lg p-4 mb-4">
                <p className="text-sm font-semibold text-blue-200 mb-2">
                  🎯 Continue with everything from your trial:
                </p>
              </div>
              <div className="space-y-4">
                <div className="flex items-start">
                  <Music className="w-5 h-5 text-blue-500 mr-3 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-sm font-medium">Unlimited songs</span>
                    <p className="text-xs text-gray-400">Keep your complete performance library</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <Gauge className="w-5 h-5 text-blue-500 mr-3 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-sm font-medium">Full VU meters everywhere</span>
                    <p className="text-xs text-gray-400">Complete audio monitoring across all interfaces</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <BarChart3 className="w-5 h-5 text-blue-500 mr-3 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-sm font-medium">Advanced waveform visualization</span>
                    <p className="text-xs text-gray-400">Professional-grade audio analysis and display</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <Headphones className="w-5 h-5 text-blue-500 mr-3 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-sm font-medium">Complete audio engine</span>
                    <p className="text-xs text-gray-400">Full mixing capabilities and real-time processing</p>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="pt-6">
              <Button className="w-full h-12 text-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg" onClick={() => handleSubscribe('paid')}>
                <Crown className="w-5 h-5 mr-2" />
                Continue with Payment
              </Button>
            </CardFooter>
          </Card>

        </div>

        {/* Value Proposition */}
        <div className="bg-slate-800/90 rounded-2xl shadow-xl p-12 mb-16 border border-slate-700">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-4">
              Why StageTracker Pro?
            </h2>
            <p className="text-lg text-gray-300">
              Built by musicians, for musicians - delivering professional results every performance
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <Music className="w-8 h-8 text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Stage-Ready Reliability</h3>
              <p className="text-gray-300">Built for live performance with zero-latency audio processing and rock-solid stability.</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <Gauge className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Real-Time Monitoring</h3>
              <p className="text-gray-300">Professional VU meters and audio analysis keep you in perfect control of your mix.</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <Cloud className="w-8 h-8 text-purple-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Future-Proof Technology</h3>
              <p className="text-gray-300">Regular updates and new features ensure you're always ahead of the curve.</p>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="text-center">
          <h3 className="text-2xl font-bold text-white mb-4">
            Start your free month today
          </h3>
          <p className="text-lg text-gray-300 mb-8 max-w-2xl mx-auto">
            Try all features free for 30 days. No credit card required. Continue for just $4.99/month after trial.
          </p>
          <div className="space-y-4">
            <Button size="lg" className="bg-green-600 hover:bg-green-700 text-lg px-8 py-4" onClick={() => handleSubscribe('trial')}>
              <Star className="w-5 h-5 mr-2" />
              Start Free Trial Now
            </Button>
            <div className="flex justify-center">
              <Button variant="ghost" onClick={() => setLocation('/')} className="text-gray-400 hover:text-white">
                ← Back to Performance
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}