import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

export interface SpectrumSettings {
  minDecibels: number;
  maxDecibels: number;
  minFreq: number;
  maxFreq: number;
  mode: number;
  smoothing: number;
  gradient: string;
  showPeaks: boolean;
  peakFadeTime: number;
  lineWidth: number;
  fillAlpha: number;
  fftSize: number;
}

interface SpectrumControlsProps {
  settings: SpectrumSettings;
  onSettingsChange: (settings: SpectrumSettings) => void;
  onReset: () => void;
}

const modeOptions = [
  { value: "0", label: "Discrete Frequencies" },
  { value: "1", label: "1/24 Octave" },
  { value: "2", label: "1/12 Octave" },
  { value: "3", label: "1/8 Octave" },
  { value: "4", label: "1/6 Octave" },
  { value: "5", label: "1/4 Octave" },
  { value: "6", label: "1/3 Octave" },
  { value: "7", label: "Half Octave" },
  { value: "8", label: "Full Octave" },
  { value: "9", label: "Line Graph" },
  { value: "10", label: "Area Graph" },
];

const gradientOptions = [
  "classic", "prism", "rainbow", "orangered", "steelblue", "apple", "candy"
];

export default function SpectrumControls({ settings, onSettingsChange, onReset }: SpectrumControlsProps) {
  const updateSetting = (key: keyof SpectrumSettings, value: any) => {
    onSettingsChange({
      ...settings,
      [key]: value
    });
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">🎛️ Spectrum Analyzer Controls</CardTitle>
          <Button onClick={onReset} variant="outline" size="sm" data-testid="button-reset-spectrum">
            Reset to Default
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Sensitivity Range */}
        <div className="space-y-4">
          <h3 className="font-semibold text-sm">📊 Sensitivity Range</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Min Level (dB): {settings.minDecibels}</Label>
              <Slider
                value={[settings.minDecibels]}
                onValueChange={([value]) => updateSetting('minDecibels', value)}
                min={-120}
                max={-40}
                step={5}
                data-testid="slider-min-decibels"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Max Level (dB): {settings.maxDecibels}</Label>
              <Slider
                value={[settings.maxDecibels]}
                onValueChange={([value]) => updateSetting('maxDecibels', value)}
                min={-80}
                max={0}
                step={5}
                data-testid="slider-max-decibels"
              />
            </div>
          </div>
        </div>

        {/* Frequency Range */}
        <div className="space-y-4">
          <h3 className="font-semibold text-sm">🎵 Frequency Range</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Min Frequency (Hz): {settings.minFreq}</Label>
              <Slider
                value={[settings.minFreq]}
                onValueChange={([value]) => updateSetting('minFreq', value)}
                min={20}
                max={500}
                step={10}
                data-testid="slider-min-freq"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Max Frequency (Hz): {settings.maxFreq}</Label>
              <Slider
                value={[settings.maxFreq]}
                onValueChange={([value]) => updateSetting('maxFreq', value)}
                min={8000}
                max={22000}
                step={1000}
                data-testid="slider-max-freq"
              />
            </div>
          </div>
        </div>

        {/* Visualization Mode */}
        <div className="space-y-2">
          <Label className="text-xs">🎨 Visualization Mode</Label>
          <Select 
            value={settings.mode.toString()} 
            onValueChange={(value) => updateSetting('mode', parseInt(value))}
          >
            <SelectTrigger data-testid="select-visualization-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {modeOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Visual Settings */}
        <div className="space-y-4">
          <h3 className="font-semibold text-sm">🎨 Visual Settings</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Smoothing: {settings.smoothing.toFixed(1)}</Label>
              <Slider
                value={[settings.smoothing]}
                onValueChange={([value]) => updateSetting('smoothing', value)}
                min={0.1}
                max={1.0}
                step={0.1}
                data-testid="slider-smoothing"
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs">Line Width: {settings.lineWidth}</Label>
              <Slider
                value={[settings.lineWidth]}
                onValueChange={([value]) => updateSetting('lineWidth', value)}
                min={1}
                max={5}
                step={1}
                data-testid="slider-line-width"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Fill Alpha: {settings.fillAlpha.toFixed(1)}</Label>
              <Slider
                value={[settings.fillAlpha]}
                onValueChange={([value]) => updateSetting('fillAlpha', value)}
                min={0.0}
                max={1.0}
                step={0.1}
                data-testid="slider-fill-alpha"
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs">Peak Fade (ms): {settings.peakFadeTime}</Label>
              <Slider
                value={[settings.peakFadeTime]}
                onValueChange={([value]) => updateSetting('peakFadeTime', value)}
                min={500}
                max={5000}
                step={500}
                data-testid="slider-peak-fade"
              />
            </div>
          </div>
        </div>

        {/* Color Gradient */}
        <div className="space-y-2">
          <Label className="text-xs">🌈 Color Gradient</Label>
          <Select 
            value={settings.gradient} 
            onValueChange={(value) => updateSetting('gradient', value)}
          >
            <SelectTrigger data-testid="select-gradient">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {gradientOptions.map(gradient => (
                <SelectItem key={gradient} value={gradient}>
                  {gradient.charAt(0).toUpperCase() + gradient.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Toggles */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Show Peak Lines</Label>
            <Switch
              checked={settings.showPeaks}
              onCheckedChange={(checked) => updateSetting('showPeaks', checked)}
              data-testid="switch-show-peaks"
            />
          </div>
        </div>

        {/* Live Values Display */}
        <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-xs space-y-1">
          <div className="font-semibold">📋 Current Settings:</div>
          <div>Range: {settings.minDecibels}dB to {settings.maxDecibels}dB ({settings.maxDecibels - settings.minDecibels}dB total)</div>
          <div>Frequency: {settings.minFreq}Hz to {settings.maxFreq}Hz</div>
          <div>Mode: {modeOptions.find(m => m.value === settings.mode.toString())?.label}</div>
          <div>Gradient: {settings.gradient}</div>
        </div>
      </CardContent>
    </Card>
  );
}