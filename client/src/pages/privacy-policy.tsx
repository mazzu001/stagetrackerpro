import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Music, ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center items-center gap-3 mb-6">
            <Music className="w-12 h-12 text-purple-400" />
            <h1 className="text-4xl font-bold text-white">StageTracker Pro</h1>
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">Privacy Policy</h2>
          <p className="text-gray-300">Last updated: January 16, 2025</p>
        </div>

        {/* Back to Home Button */}
        <div className="mb-8">
          <Link href="/">
            <Button variant="outline" className="border-purple-600 text-purple-400 hover:bg-purple-600 hover:text-white">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>

        <Card className="bg-slate-800/70 border-slate-600">
          <CardContent className="p-8">
            <div className="prose prose-invert max-w-none space-y-6">
              
              <section>
                <h3 className="text-xl font-bold text-white mb-4">1. Information We Collect</h3>
                <div className="text-gray-300 space-y-3">
                  <p>We collect information you provide directly to us, such as when you create an account, make a purchase, or contact us for support.</p>
                  <p><strong>Personal Information:</strong> Email address, payment information (processed securely through Stripe), and profile information you choose to provide.</p>
                  <p><strong>Usage Information:</strong> Information about how you use our application, including features accessed, songs uploaded, and performance data.</p>
                  <p><strong>Device Information:</strong> Information about your device, including browser type, operating system, and device identifiers.</p>
                </div>
              </section>

              <section>
                <h3 className="text-xl font-bold text-white mb-4">2. How We Use Your Information</h3>
                <div className="text-gray-300 space-y-3">
                  <p>We use the information we collect to:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Provide, maintain, and improve our services</li>
                    <li>Process transactions and send related information</li>
                    <li>Send technical notices, updates, and support messages</li>
                    <li>Respond to your comments and questions</li>
                    <li>Monitor and analyze trends and usage</li>
                  </ul>
                </div>
              </section>

              <section>
                <h3 className="text-xl font-bold text-white mb-4">3. Information Sharing and Disclosure</h3>
                <div className="text-gray-300 space-y-3">
                  <p>We do not sell, trade, or otherwise transfer your personal information to third parties except as described in this policy.</p>
                  <p><strong>Service Providers:</strong> We may share your information with third-party service providers who assist us in operating our application and conducting our business (such as Stripe for payment processing).</p>
                  <p><strong>Legal Requirements:</strong> We may disclose your information if required by law or in response to valid requests by public authorities.</p>
                </div>
              </section>

              <section>
                <h3 className="text-xl font-bold text-white mb-4">4. Data Storage and Security</h3>
                <div className="text-gray-300 space-y-3">
                  <p>We take reasonable measures to protect your personal information from unauthorized access, use, or disclosure.</p>
                  <p><strong>Local Storage:</strong> Audio files and performance data are stored locally on your device for optimal performance. We do not store your audio files on our servers.</p>
                  <p><strong>Cloud Storage:</strong> Account information and subscription data are stored securely in our cloud infrastructure with industry-standard security measures.</p>
                </div>
              </section>

              <section>
                <h3 className="text-xl font-bold text-white mb-4">5. Your Rights and Choices</h3>
                <div className="text-gray-300 space-y-3">
                  <p>You have certain rights regarding your personal information:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li><strong>Access:</strong> You can request access to your personal information</li>
                    <li><strong>Correction:</strong> You can request correction of inaccurate personal information</li>
                    <li><strong>Deletion:</strong> You can request deletion of your personal information</li>
                    <li><strong>Account Closure:</strong> You can delete your account at any time</li>
                  </ul>
                </div>
              </section>

              <section>
                <h3 className="text-xl font-bold text-white mb-4">6. Cookies and Analytics</h3>
                <div className="text-gray-300 space-y-3">
                  <p>We use cookies and similar tracking technologies to improve user experience and analyze usage patterns.</p>
                  <p><strong>Google Analytics:</strong> We use Google Analytics to understand how users interact with our application. You can opt-out of Google Analytics by installing the Google Analytics opt-out browser add-on.</p>
                </div>
              </section>

              <section>
                <h3 className="text-xl font-bold text-white mb-4">7. Children's Privacy</h3>
                <div className="text-gray-300 space-y-3">
                  <p>Our service is not directed to children under 13. We do not knowingly collect personal information from children under 13. If we learn that we have collected personal information from a child under 13, we will take steps to delete such information.</p>
                </div>
              </section>

              <section>
                <h3 className="text-xl font-bold text-white mb-4">8. Changes to This Privacy Policy</h3>
                <div className="text-gray-300 space-y-3">
                  <p>We may update this privacy policy from time to time. We will notify you of any changes by posting the new privacy policy on this page and updating the "Last updated" date.</p>
                </div>
              </section>

              <section>
                <h3 className="text-xl font-bold text-white mb-4">9. Contact Us</h3>
                <div className="text-gray-300 space-y-3">
                  <p>If you have any questions about this privacy policy, please contact us at:</p>
                  <p>Email: privacy@stagetrackerpro.com</p>
                </div>
              </section>

            </div>
          </CardContent>
        </Card>

        {/* Bottom Navigation */}
        <div className="text-center mt-8">
          <Link href="/">
            <Button className="bg-purple-600 hover:bg-purple-700 text-white">
              Return to StageTracker Pro
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}