import React, { useState, useEffect } from 'react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ScreenHeader } from '../components/ScreenHeader';
import { Play, Pause, Square, AlertTriangle } from 'lucide-react';

interface BreakControlScreenProps {
  onClose: () => void;
}

export function BreakControlScreen({ onClose }: BreakControlScreenProps) {
  const [duration, setDuration] = useState(15); // minutes
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [timeLeft, setTimeLeft] = useState(duration * 60); // seconds
  const [totalBreakTime, setTotalBreakTime] = useState(0); // total break time in minutes

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning && !isPaused && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, isPaused, timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStart = () => {
    setIsRunning(true);
    setIsPaused(false);
    setTimeLeft(duration * 60);
  };

  const handlePause = () => {
    setIsPaused(true);
  };

  const handleResume = () => {
    setIsPaused(false);
  };

  const handleEnd = () => {
    const usedMinutes = Math.ceil((duration * 60 - timeLeft) / 60);
    setTotalBreakTime(prev => prev + usedMinutes);
    setIsRunning(false);
    setIsPaused(false);
    setTimeLeft(duration * 60);
  };

  const needsManagerReview = totalBreakTime > 30;

  return (
    <div className="h-full flex flex-col bg-white">
      <ScreenHeader title="Break" onBack={onClose} />
      
      <div className="flex-1 flex flex-col p-4 gap-4">
        <Card>
          <div className="text-center">
            <p className="text-[#9E9E9E] text-sm mb-2">Time Remaining</p>
            <div className="text-5xl mb-4">{formatTime(timeLeft)}</div>
            <p className="text-[#9E9E9E] text-sm">
              Total break today: {totalBreakTime} min
            </p>
          </div>
        </Card>

        {!isRunning && (
          <div className="flex flex-col gap-3">
            <label className="text-[#2E2E2E]">Set Duration</label>
            <div className="flex gap-2">
              {[5, 10, 15, 20, 30].map(mins => (
                <button
                  key={mins}
                  onClick={() => setDuration(mins)}
                  className={`flex-1 py-3 rounded-[12px] border-2 transition-colors ${
                    duration === mins
                      ? 'bg-[#C62828] border-[#C62828] text-white'
                      : 'bg-white border-[#9E9E9E] text-[#2E2E2E]'
                  }`}
                >
                  {mins}m
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="bg-[#FFF3E0] border-l-4 border-[#FFA726] p-4 rounded-lg">
          <p className="text-sm text-[#2E2E2E]">
            Maximum total break per shift: 30 minutes
          </p>
        </div>

        {needsManagerReview && (
          <div className="bg-[#FFEBEE] border-l-4 border-[#D32F2F] p-4 rounded-lg">
            <p className="text-sm text-[#2E2E2E]">
              Break time exceeded. Manager review required.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2 mt-auto">
          {!isRunning ? (
            <Button variant="primary" fullWidth onClick={handleStart}>
              <div className="flex items-center justify-center gap-2">
                <Play size={20} />
                Start Break
              </div>
            </Button>
          ) : (
            <>
              {isPaused ? (
                <Button variant="primary" fullWidth onClick={handleResume}>
                  <div className="flex items-center justify-center gap-2">
                    <Play size={20} />
                    Resume Break
                  </div>
                </Button>
              ) : (
                <Button variant="secondary" fullWidth onClick={handlePause}>
                  <div className="flex items-center justify-center gap-2">
                    <Pause size={20} />
                    Pause Break
                  </div>
                </Button>
              )}
              <Button variant="primary" fullWidth onClick={handleEnd}>
                <div className="flex items-center justify-center gap-2">
                  <Square size={20} />
                  End Break
                </div>
              </Button>
            </>
          )}
          <Button variant="outline" fullWidth onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}