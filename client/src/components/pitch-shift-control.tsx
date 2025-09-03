import { useState, useEffect } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

interface PitchShiftControlProps {
  onPitchChange: (semitones: number) => void;
  disabled?: boolean;
}

export function PitchShiftControl({ onPitchChange, disabled = false }: PitchShiftControlProps) {
  const [pitchSemitones, setPitchSemitones] = useState(0);

  // Convert semitones to musical interval names
  const getIntervalName = (semitones: number): string => {
    if (semitones === 0) return "Original Key";
    
    const absValue = Math.abs(semitones);
    const direction = semitones > 0 ? "up" : "down";
    
    const intervalNames: { [key: number]: string } = {
      1: "Minor 2nd",
      2: "Major 2nd", 
      3: "Minor 3rd",
      4: "Major 3rd",
      5: "Perfect 4th",
      6: "Tritone",
      7: "Perfect 5th",
      8: "Minor 6th",
      9: "Major 6th",
      10: "Minor 7th",
      11: "Major 7th",
      12: "Octave"
    };
    
    const intervalName = intervalNames[absValue] || `${absValue} semitones`;
    return `${intervalName} ${direction}`;
  };

  // Convert semitones to pitch ratio for the worklet
  const semitonesToRatio = (semitones: number): number => {
    return Math.pow(2, semitones / 12);
  };

  const handlePitchChange = (value: number[]) => {
    const newSemitones = value[0];
    setPitchSemitones(newSemitones);
    const pitchRatio = semitonesToRatio(newSemitones);
    onPitchChange(pitchRatio);
  };

  const resetPitch = () => {
    setPitchSemitones(0);
    onPitchChange(1.0); // Reset to original pitch
  };

  // Determine color based on pitch shift amount
  const getSliderColor = (): string => {
    if (pitchSemitones === 0) return "bg-gray-600";
    if (Math.abs(pitchSemitones) <= 2) return "bg-green-600";
    if (Math.abs(pitchSemitones) <= 5) return "bg-yellow-600";
    return "bg-red-600";
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-200">Pitch Shift</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={resetPitch}
          disabled={disabled || pitchSemitones === 0}
          className="h-7 px-2 text-gray-400 hover:text-white"
          data-testid="button-reset-pitch"
        >
          <RotateCcw className="w-3 h-3" />
        </Button>
      </div>
      
      <div className="space-y-3">
        {/* Pitch slider */}
        <div className="px-2">
          <Slider
            value={[pitchSemitones]}
            onValueChange={handlePitchChange}
            min={-12}
            max={12}
            step={1}
            disabled={disabled}
            className="w-full"
            data-testid="slider-pitch-shift"
          />
        </div>
        
        {/* Current pitch display */}
        <div className="text-center space-y-1">
          <div className="text-lg font-mono text-white">
            {pitchSemitones > 0 ? '+' : ''}{pitchSemitones} 
            <span className="text-sm text-gray-400 ml-1">semitones</span>
          </div>
          <div className={`text-xs px-2 py-1 rounded ${getSliderColor()} text-white`}>
            {getIntervalName(pitchSemitones)}
          </div>
        </div>
        
        {/* Quick preset buttons */}
        <div className="grid grid-cols-4 gap-1 text-xs">
          {[-5, -2, +2, +5].map((preset) => (
            <Button
              key={preset}
              variant="ghost"
              size="sm"
              onClick={() => handlePitchChange([preset])}
              disabled={disabled}
              className="h-7 text-xs px-1 text-gray-400 hover:text-white"
              data-testid={`button-preset-${preset >= 0 ? 'plus' : 'minus'}${Math.abs(preset)}`}
            >
              {preset > 0 ? '+' : ''}{preset}
            </Button>
          ))}
        </div>
        
        {/* Info text */}
        <div className="text-xs text-gray-500 text-center">
          Real-time pitch shifting without tempo change
        </div>
      </div>
    </div>
  );
}