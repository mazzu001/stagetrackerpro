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
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">🎛️ Spectrum Controls</CardTitle>
          <Button onClick={onReset} variant="outline" size="sm" className="text-xs h-6" data-testid="button-reset-spectrum">
            Reset
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        
        {/* Compact 4-column grid for main controls */}
        <div className="grid grid-cols-4 gap-2 text-xs">
          
          {/* Min Level */}
          <div className="space-y-1">
            <Label className="text-[10px] leading-tight">Min Level<br/>{settings.minDecibels}dB</Label>
            <Slider
              value={[settings.minDecibels]}
              onValueChange={([value]) => updateSetting('minDecibels', value)}
              min={-120}
              max={-40}
              step={5}
              className="h-2"
              data-testid="slider-min-decibels"
            />
          </div>

          {/* Max Level */}
          <div className="space-y-1">
            <Label className="text-[10px] leading-tight">Max Level<br/>{settings.maxDecibels}dB</Label>
            <Slider
              value={[settings.maxDecibels]}
              onValueChange={([value]) => updateSetting('maxDecibels', value)}
              min={-80}
              max={0}
              step={5}
              className="h-2"
              data-testid="slider-max-decibels"
            />
          </div>

          {/* Min Frequency */}
          <div className="space-y-1">
            <Label className="text-[10px] leading-tight">Min Freq<br/>{settings.minFreq}Hz</Label>
            <Slider
              value={[settings.minFreq]}
              onValueChange={([value]) => updateSetting('minFreq', value)}
              min={20}
              max={500}
              step={10}
              className="h-2"
              data-testid="slider-min-freq"
            />
          </div>

          {/* Max Frequency */}
          <div className="space-y-1">
            <Label className="text-[10px] leading-tight">Max Freq<br/>{settings.maxFreq/1000}kHz</Label>
            <Slider
              value={[settings.maxFreq]}
              onValueChange={([value]) => updateSetting('maxFreq', value)}
              min={8000}
              max={22000}
              step={1000}
              className="h-2"
              data-testid="slider-max-freq"
            />
          </div>
        </div>

        {/* Second row - 4 more controls */}
        <div className="grid grid-cols-4 gap-2 text-xs">
          
          {/* Smoothing */}
          <div className="space-y-1">
            <Label className="text-[10px] leading-tight">Smoothing<br/>{settings.smoothing.toFixed(1)}</Label>
            <Slider
              value={[settings.smoothing]}
              onValueChange={([value]) => updateSetting('smoothing', value)}
              min={0.1}
              max={1.0}
              step={0.1}
              className="h-2"
              data-testid="slider-smoothing"
            />
          </div>
          
          {/* Line Width */}
          <div className="space-y-1">
            <Label className="text-[10px] leading-tight">Line Width<br/>{settings.lineWidth}px</Label>
            <Slider
              value={[settings.lineWidth]}
              onValueChange={([value]) => updateSetting('lineWidth', value)}
              min={1}
              max={5}
              step={1}
              className="h-2"
              data-testid="slider-line-width"
            />
          </div>

          {/* Fill Alpha */}
          <div className="space-y-1">
            <Label className="text-[10px] leading-tight">Fill Alpha<br/>{settings.fillAlpha.toFixed(1)}</Label>
            <Slider
              value={[settings.fillAlpha]}
              onValueChange={([value]) => updateSetting('fillAlpha', value)}
              min={0.0}
              max={1.0}
              step={0.1}
              className="h-2"
              data-testid="slider-fill-alpha"
            />
          </div>
          
          {/* Peak Fade */}
          <div className="space-y-1">
            <Label className="text-[10px] leading-tight">Peak Fade<br/>{settings.peakFadeTime/1000}s</Label>
            <Slider
              value={[settings.peakFadeTime]}
              onValueChange={([value]) => updateSetting('peakFadeTime', value)}
              min={500}
              max={5000}
              step={500}
              className="h-2"
              data-testid="slider-peak-fade"
            />
          </div>
        </div>

        {/* Third row - dropdowns and toggles */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          
          {/* Visualization Mode */}
          <div className="space-y-1">
            <Label className="text-[10px]">Mode</Label>
            <Select 
              value={settings.mode.toString()} 
              onValueChange={(value) => updateSetting('mode', parseInt(value))}
            >
              <SelectTrigger className="h-6 text-[10px]" data-testid="select-visualization-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="text-xs">
                {modeOptions.map(option => (
                  <SelectItem key={option.value} value={option.value} className="text-xs">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Color Gradient */}
          <div className="space-y-1">
            <Label className="text-[10px]">Gradient</Label>
            <Select 
              value={settings.gradient} 
              onValueChange={(value) => updateSetting('gradient', value)}
            >
              <SelectTrigger className="h-6 text-[10px]" data-testid="select-gradient">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="text-xs">
                {gradientOptions.map(gradient => (
                  <SelectItem key={gradient} value={gradient} className="text-xs">
                    {gradient.charAt(0).toUpperCase() + gradient.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Show Peaks Toggle */}
          <div className="space-y-1">
            <Label className="text-[10px]">Show Peaks</Label>
            <div className="flex items-center h-6">
              <Switch
                checked={settings.showPeaks}
                onCheckedChange={(checked) => updateSetting('showPeaks', checked)}
                className="scale-75"
                data-testid="switch-show-peaks"
              />
            </div>
          </div>
        </div>

        {/* Current values display - ultra compact */}
        <div className="bg-gray-100 dark:bg-gray-800 p-1 rounded text-[9px] leading-tight">
          <div className="grid grid-cols-2 gap-1">
            <div>Range: {settings.minDecibels} to {settings.maxDecibels}dB ({settings.maxDecibels - settings.minDecibels}dB)</div>
            <div>Freq: {settings.minFreq}Hz to {settings.maxFreq/1000}kHz</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}