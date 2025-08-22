import { useLocalAuth } from '@/hooks/useLocalAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Crown, Zap, Star, Music, BarChart3, Headphones, Cloud, MessageSquare, Gauge } from 'lucide-react';
import { useLocation } from 'wouter';

export default function Plans() {
  const { user, upgrade } = useLocalAuth();
  const [, setLocation] = useLocation();

  const handleSubscribe = (plan: string) => {
    if (plan === 'premium') {
      upgrade();
      setLocation('/performance');
    } else if (plan === 'professional') {
      // Handle professional subscription
      upgrade();
      setLocation('/performance');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-purple-900 dark:to-indigo-900 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-6">
            Elevate Your Live Performance
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-4xl mx-auto leading-relaxed">
            Choose the perfect StageTracker Pro plan to transform your live shows with professional-grade audio management, 
            real-time monitoring, and cutting-edge performance technology.
          </p>
          <div className="mt-8 flex justify-center">
            <Badge variant="outline" className="text-lg px-6 py-2 bg-white/50 dark:bg-gray-800/50">
              Trusted by professional musicians worldwide
            </Badge>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid lg:grid-cols-3 gap-8 mb-16">
          {/* Free Plan */}
          <Card className="border-2 border-gray-200 dark:border-gray-700 relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
            <CardHeader className="text-center pb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <Star className="w-8 h-8 text-gray-600 dark:text-gray-400" />
              </div>
              <CardTitle className="text-3xl font-bold text-gray-900 dark:text-white">Free</CardTitle>
              <CardDescription className="text-lg text-gray-600 dark:text-gray-400">Perfect for getting started</CardDescription>
              <div className="text-5xl font-bold text-gray-900 dark:text-white mt-6">
                $0<span className="text-xl font-normal text-gray-600 dark:text-gray-400">/month</span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">No credit card required</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-start">
                  <Check className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-sm font-medium">Up to 2 songs</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Test the waters with limited library</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <Check className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-sm font-medium">Essential audio playback</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Core transport controls and timing</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <Check className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-sm font-medium">Basic VU meters</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Audio level monitoring on songs list only</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <Check className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-sm font-medium">Standard waveform</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Simple audio visualization</p>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="pt-6">
              <Button className="w-full h-12 text-lg" variant="outline" disabled>
                <Star className="w-4 h-4 mr-2" />
                Current Plan
              </Button>
            </CardFooter>
          </Card>

          {/* Premium Plan */}
          <Card className="border-2 border-blue-500 dark:border-blue-400 relative shadow-2xl scale-105 bg-white dark:bg-gray-800">
            <Badge className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-6 py-2 text-sm font-semibold">
              ⭐ Most Popular Choice
            </Badge>
            <CardHeader className="text-center pb-8 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-t-lg">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-800 dark:to-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <Crown className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <CardTitle className="text-3xl font-bold text-gray-900 dark:text-white">Premium</CardTitle>
              <CardDescription className="text-lg text-gray-600 dark:text-gray-400">For serious performers</CardDescription>
              <div className="text-5xl font-bold text-gray-900 dark:text-white mt-6">
                $4.99<span className="text-xl font-normal text-gray-600 dark:text-gray-400">/month</span>
              </div>
              <p className="text-sm text-green-600 dark:text-green-400 mt-2 font-medium">Best value for professionals</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-4">
                <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">
                  🎯 Everything in Free, plus premium features:
                </p>
              </div>
              <div className="space-y-4">
                <div className="flex items-start">
                  <Music className="w-5 h-5 text-blue-500 mr-3 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-sm font-medium">Unlimited songs</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Build your complete performance library</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <Gauge className="w-5 h-5 text-blue-500 mr-3 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-sm font-medium">Full VU meters everywhere</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Complete audio monitoring across all interfaces</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <BarChart3 className="w-5 h-5 text-blue-500 mr-3 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-sm font-medium">Advanced waveform visualization</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Professional-grade audio analysis and display</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <Headphones className="w-5 h-5 text-blue-500 mr-3 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-sm font-medium">Complete audio engine</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Full mixing capabilities and real-time processing</p>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="pt-6">
              <Button className="w-full h-12 text-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg" onClick={() => handleSubscribe('premium')}>
                <Crown className="w-5 h-5 mr-2" />
                Upgrade to Premium
              </Button>
            </CardFooter>
          </Card>

          {/* Professional Plan */}
          <Card className="border-2 border-purple-500 dark:border-purple-400 relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
            <CardHeader className="text-center pb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-800 dark:to-purple-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-purple-600 dark:text-purple-400" />
              </div>
              <CardTitle className="text-3xl font-bold text-gray-900 dark:text-white">Professional</CardTitle>
              <CardDescription className="text-lg text-gray-600 dark:text-gray-400">For touring professionals</CardDescription>
              <div className="text-5xl font-bold text-gray-900 dark:text-white mt-6">
                $14.99<span className="text-xl font-normal text-gray-600 dark:text-gray-400">/month</span>
              </div>
              <p className="text-sm text-purple-600 dark:text-purple-400 mt-2 font-medium">Ultimate performance suite</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 mb-4">
                <p className="text-sm font-semibold text-purple-800 dark:text-purple-200 mb-2">
                  🚀 Everything in Premium, plus professional tools:
                </p>
              </div>
              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="w-5 h-5 bg-gradient-to-r from-purple-500 to-pink-500 rounded mr-3 flex-shrink-0 mt-0.5 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">M</span>
                  </div>
                  <div>
                    <span className="text-sm font-medium">MIDI integration</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Advanced MIDI control and sequencing (coming soon)</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <Cloud className="w-5 h-5 text-purple-500 mr-3 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-sm font-medium">Cloud backup & sync</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Automatic backup of all songs, settings, and data</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <MessageSquare className="w-5 h-5 text-purple-500 mr-3 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-sm font-medium">Priority support</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Direct access to our technical team</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <BarChart3 className="w-5 h-5 text-purple-500 mr-3 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-sm font-medium">Performance analytics</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Advanced insights and performance metrics</p>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="pt-6">
              <Button className="w-full h-12 text-lg bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 shadow-lg" onClick={() => handleSubscribe('professional')}>
                <Zap className="w-5 h-5 mr-2" />
                Go Professional
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Value Proposition */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-12 mb-16 border border-gray-200 dark:border-gray-700">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Why StageTracker Pro?
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              Built by musicians, for musicians - delivering professional results every performance
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <Music className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Stage-Ready Reliability</h3>
              <p className="text-gray-600 dark:text-gray-400">Built for live performance with zero-latency audio processing and rock-solid stability.</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <Gauge className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Real-Time Monitoring</h3>
              <p className="text-gray-600 dark:text-gray-400">Professional VU meters and audio analysis keep you in perfect control of your mix.</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <Cloud className="w-8 h-8 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Future-Proof Technology</h3>
              <p className="text-gray-600 dark:text-gray-400">Regular updates and new features ensure you're always ahead of the curve.</p>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="text-center">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Ready to transform your live performances?
          </h3>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto">
            Join thousands of professional musicians who trust StageTracker Pro for their most important shows.
          </p>
          <div className="space-y-4">
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-4" onClick={() => handleSubscribe('premium')}>
              <Crown className="w-5 h-5 mr-2" />
              Start Your Premium Journey
            </Button>
            <div className="flex justify-center">
              <Button variant="ghost" onClick={() => setLocation('/performance')} className="text-gray-600 dark:text-gray-400">
                ← Back to Performance
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}