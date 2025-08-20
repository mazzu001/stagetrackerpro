import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Crown, Check, Music } from 'lucide-react';

interface UpgradeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
}

export function UpgradeDialog({ 
  isOpen, 
  onClose, 
  title = "Upgrade to Premium", 
  description = "Unlock unlimited songs and advanced features" 
}: UpgradeDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="mx-auto w-16 h-16 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mb-4">
            <Crown className="w-8 h-8 text-white" />
          </div>
          <DialogTitle className="text-2xl text-center">{title}</DialogTitle>
          <p className="text-gray-600 text-center">{description}</p>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-6 my-6">
          {/* Free Plan */}
          <div className="border rounded-lg p-4">
            <h3 className="font-semibold mb-2">Free Plan</h3>
            <p className="text-2xl font-bold mb-4">$0<span className="text-sm font-normal">/month</span></p>
            <ul className="space-y-2 mb-4">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span>Up to 2 songs</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span>Basic audio controls</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span>Lyrics display</span>
              </li>
            </ul>
          </div>

          {/* Premium Plan */}
          <div className="border-2 border-orange-500 rounded-lg p-4 relative">
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
              <span className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                Recommended
              </span>
            </div>
            <h3 className="font-semibold mb-2">Premium Plan</h3>
            <p className="text-2xl font-bold mb-4">$4.99<span className="text-sm font-normal">/month</span></p>
            <ul className="space-y-2 mb-4">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span>Unlimited songs</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span>Up to 6 tracks per song</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span>Advanced audio mixing</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span>MIDI integration</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span>Priority support</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="text-center space-y-4">
          <Button
            onClick={() => window.location.href = '/subscribe'}
            className="bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white px-8 py-3"
            data-testid="button-upgrade-now"
          >
            <Crown className="w-4 h-4 mr-2" />
            Upgrade to Premium
          </Button>
          
          <Button
            variant="ghost"
            onClick={onClose}
            data-testid="button-continue-free"
          >
            Continue with Free Plan
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}