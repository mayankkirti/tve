import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { VideoConfig } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(ms: number): string {
  if (ms < 0 || isNaN(ms)) return '00:00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  return [
    hours.toString().padStart(2, '0'),
    minutes.toString().padStart(2, '0'),
    seconds.toString().padStart(2, '0')
  ].join(':');
}

export function formatAudioTime(seconds: number): string {
  if (seconds < 0 || isNaN(seconds)) return '00:00:00.0';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10); // 1 decimal place
  
  return [
    h.toString().padStart(2, '0'),
    m.toString().padStart(2, '0'),
    s.toString().padStart(2, '0')
  ].join(':') + '.' + ms.toString();
}

export function generateSeoFileName(config: VideoConfig): string {
  const clean = (str: string) => str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  
  const elements = [
    clean(config.channelName || ''),
    clean(config.name || 'untitled'),
    clean(config.style || 'visualizer'),
    'music-video'
  ].filter(Boolean);
  
  return `${elements.join('-')}.mp4`;
}
