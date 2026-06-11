import React, { useEffect, useRef, useState } from 'react';
import { formatAudioTime } from '../lib/utils';

export function AudioCropper({
  audioUrl,
  start,
  end,
  duration,
  onChangeStart,
  onChangeEnd,
  onCrop
}: {
  audioUrl: string;
  start: number;
  end: number;
  duration: number;
  onChangeStart: (val: number) => void;
  onChangeEnd: (val: number) => void;
  onCrop?: (blob: Blob) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const playReqRef = useRef<number>(0);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(start);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);

  useEffect(() => {
     if (audioRef.current) {
         if (isPlaying) {
             audioRef.current.currentTime = currentTime;
             audioRef.current.play();
         } else {
             audioRef.current.pause();
         }
     }
  }, [isPlaying]);

  useEffect(() => {
     if (!isPlaying) {
         setCurrentTime(start);
     }
  }, [start, isPlaying]);

  useEffect(() => {
     const checkTime = () => {
         if (audioRef.current && isPlaying) {
             const t = audioRef.current.currentTime;
             if (t >= end) {
                 audioRef.current.pause();
                 setIsPlaying(false);
                 setCurrentTime(start);
             } else {
                 setCurrentTime(t);
             }
         }
         playReqRef.current = requestAnimationFrame(checkTime);
     };
     playReqRef.current = requestAnimationFrame(checkTime);
     return () => cancelAnimationFrame(playReqRef.current);
  }, [isPlaying, end, start]);

  useEffect(() => {
    let active = true;
    const fetchAndDecode = async () => {
      try {
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        const ctx = new window.AudioContext();
        const decodedBuffer = await ctx.decodeAudioData(arrayBuffer);
        ctx.close().catch(() => {});
        
        if (!active) return;
        setAudioBuffer(decodedBuffer);

        const channelData = decodedBuffer.getChannelData(0);
        const samples = 100;
        const blockSize = Math.floor(channelData.length / samples);
        const newPeaks = [];
        
        for (let i = 0; i < samples; i++) {
          let startRef = blockSize * i;
          let sum = 0;
          for (let j = 0; j < blockSize; j++) {
            sum += Math.abs(channelData[startRef + j]);
          }
          newPeaks.push(sum / blockSize);
        }
        
        const maxPeak = Math.max(...newPeaks);
        setPeaks(newPeaks.map(p => p / maxPeak));
      } catch (err) {
        console.error("Error generating waveform:", err);
      }
    };
    fetchAndDecode();
    
    return () => {
      active = false;
    };
  }, [audioUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || peaks.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#4f46e5'; // indigo-600

    const width = canvas.width;
    const height = canvas.height;
    const barWidth = width / peaks.length;

    peaks.forEach((peak, i) => {
      const barHeight = peak * height * 0.8;
      const x = i * barWidth;
      const y = (height - barHeight) / 2;
      ctx.fillRect(x, y, barWidth - 1, barHeight);
    });

    // Draw crop overlays
    if (duration > 0) {
       ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
       const startX = (start / duration) * width;
       const endX = (end / duration) * width;
       
       ctx.fillRect(0, 0, startX, height);
       ctx.fillRect(endX, 0, width - endX, height);
       
       ctx.strokeStyle = '#fff';
       ctx.lineWidth = 2;
       ctx.beginPath();
       ctx.moveTo(startX, 0);
       ctx.lineTo(startX, height);
       ctx.moveTo(endX, 0);
       ctx.lineTo(endX, height);
       ctx.stroke();
       
       if (isPlaying || currentTime > start) {
           const timeX = (currentTime / duration) * width;
           ctx.strokeStyle = '#f43f5e';
           ctx.lineWidth = 1;
           ctx.beginPath();
           ctx.moveTo(timeX, 0);
           ctx.lineTo(timeX, height);
           ctx.stroke();
       }
    }
  }, [peaks, start, end, duration, isPlaying, currentTime]);

  const handleCanvasInteraction = (e: React.MouseEvent | React.TouchEvent) => {
      const canvas = canvasRef.current;
      if (!canvas || duration <= 0) return;
      
      const rect = canvas.getBoundingClientRect();
      let clientX = 0;
      if ('touches' in e) {
          clientX = e.touches[0].clientX;
      } else {
          clientX = (e as React.MouseEvent).clientX;
      }
      
      const x = clientX - rect.left;
      const pct = Math.max(0, Math.min(1, x / rect.width));
      const time = pct * duration;
      
      // Determine if closer to start or end
      const distStart = Math.abs(start - time);
      const distEnd = Math.abs(end - time);
      
      if (distStart < distEnd) {
          if (time < end - 0.5) onChangeStart(time);
      } else {
          if (time > start + 0.5) onChangeEnd(time);
      }
  };

  const cropAudio = () => {
     if (!audioBuffer || !onCrop) return;
     const sampleRate = audioBuffer.sampleRate;
     const numChannels = audioBuffer.numberOfChannels;
     const startOffset = Math.floor(start * sampleRate);
     const endOffset = Math.floor(end * sampleRate);
     const length = Math.max(1, endOffset - startOffset);
     
     const bytesPerSample = 2;
     const blockAlign = numChannels * bytesPerSample;
     const wav = new ArrayBuffer(44 + length * blockAlign);
     const view = new DataView(wav);
     
     const writeString = (view: DataView, offset: number, string: string) => {
       for (let i = 0; i < string.length; i++) {
           view.setUint8(offset + i, string.charCodeAt(i));
       }
     };
     
     writeString(view, 0, 'RIFF');
     view.setUint32(4, 36 + length * blockAlign, true);
     writeString(view, 8, 'WAVE');
     writeString(view, 12, 'fmt ');
     view.setUint32(16, 16, true);
     view.setUint16(20, 1, true); // PCM
     view.setUint16(22, numChannels, true);
     view.setUint32(24, sampleRate, true);
     view.setUint32(28, sampleRate * blockAlign, true);
     view.setUint16(32, blockAlign, true);
     view.setUint16(34, 16, true);
     writeString(view, 36, 'data');
     view.setUint32(40, length * blockAlign, true);
     
     let offset = 44;
     for (let i = 0; i < length; i++) {
       for (let channel = 0; channel < numChannels; channel++) {
           const sample = audioBuffer.getChannelData(channel)[startOffset + i];
           let s = Math.max(-1, Math.min(1, sample));
           view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
           offset += 2;
       }
     }
     
     const blob = new Blob([view], { type: 'audio/wav' });
     onCrop(blob);
  };

  return (
    <div className="space-y-4">
      <audio ref={audioRef} src={audioUrl} className="hidden" />
      <div 
        className="relative w-full h-16 bg-zinc-900 rounded overflow-hidden cursor-crosshair border border-zinc-700"
        onMouseDown={handleCanvasInteraction}
        onMouseMove={(e) => {
           if (e.buttons === 1) handleCanvasInteraction(e);
        }}
        onTouchStart={handleCanvasInteraction}
        onTouchMove={handleCanvasInteraction}
      >
        <canvas 
           ref={canvasRef} 
           width={300} 
           height={64} 
           className="w-full h-full"
        />
      </div>

      <div className="flex items-center gap-4 justify-between border-b border-zinc-800 pb-3">
          <button
             type="button"
             onClick={() => {
                 if (!isPlaying) setCurrentTime(start);
                 setIsPlaying(!isPlaying);
             }}
             className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs transition-colors shadow"
          >
             {isPlaying ? 'Pause' : 'Play Selection'}
          </button>
          
          <div className="flex-1 flex justify-center text-xs text-zinc-400 font-mono gap-4">
            <span>{formatAudioTime(start)}</span>
            <span>Dur: {formatAudioTime(end - start)}</span>
            <span>{formatAudioTime(end)}</span>
          </div>
          
          {onCrop && (
          <button
             type="button"
             onClick={cropAudio}
             className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs transition-colors shadow"
          >
             Crop Audio
          </button>
          )}
      </div>

      <div className="flex flex-col gap-2">
          <label className="text-xs text-zinc-500">Start Time</label>
          <input 
            type="range" 
            min="0" 
            max={duration || 100} 
            step="0.1"
            value={start}
            onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (val < end) onChangeStart(val);
            }}
            className="w-full accent-indigo-500"
          />

          <label className="text-xs text-zinc-500">End Time</label>
          <input 
            type="range" 
            min="0" 
            max={duration || 100} 
            step="0.1"
            value={end}
            onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (val > start) onChangeEnd(val);
            }}
            className="w-full accent-indigo-500"
          />
      </div>
    </div>
  );
}
