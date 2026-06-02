import { Resolution } from './types';

export const RESOLUTIONS: Resolution[] = [
  { label: '4K (2160p, 16:9)', width: 3840, height: 2160 },
  { label: '2K (1440p, 16:9)', width: 2560, height: 1440 },
  { label: 'YouTube (1080p, 16:9)', width: 1920, height: 1080 },
  { label: 'YouTube (720p, 16:9)', width: 1280, height: 720 },
  { label: 'Shorts/TikTok (4K Vertical, 9:16)', width: 2160, height: 3840 },
  { label: 'Shorts/TikTok (2K Vertical, 9:16)', width: 1440, height: 2560 },
  { label: 'Shorts/TikTok (1080p Vertical, 9:16)', width: 1080, height: 1920 },
  { label: 'Shorts/TikTok (720p Vertical, 9:16)', width: 720, height: 1280 },
  { label: 'Square (1:1)', width: 1080, height: 1080 },
  { label: 'Low Performance (480p, 16:9)', width: 854, height: 480 },
];

export const GOOGLE_FONTS = [
  { value: 'Inter', label: 'Inter' },
  { value: 'Quicksand', label: '[Chillout] Quicksand' },
  { value: 'Nunito', label: '[Chillout] Nunito' },
  { value: 'Comfortaa', label: '[Chillout] Comfortaa' },
  { value: 'Raleway', label: '[Chillout] Raleway' },
  { value: 'Amita', label: '[Indian Ambient] Amita' },
  { value: 'Yantramanav', label: '[Indian Ambient] Yantramanav' },
  { value: 'Kalam', label: '[Indian Ambient] Kalam' },
  { value: 'Samarkan', label: '[Indian Ambient] Samarkan (Fallback)' },
  { value: 'Syncopate', label: '[Psychedelic] Syncopate' },
  { value: 'Rajdhani', label: '[Psychedelic] Rajdhani' },
  { value: 'Federo', label: '[Psychedelic] Federo' },
  { value: 'Ewert', label: '[Psychedelic] Ewert' },
  { value: 'Monoton', label: '[Psychedelic/Retro] Monoton' },
  { value: 'Cinzel Decorative', label: '[Ambient/Psychedelic] Cinzel Decorative' },
  { value: 'Space Grotesk', label: '[Modern Minimal] Space Grotesk' },
  { value: 'Outfit', label: '[Modern Minimal] Outfit' },
  { value: 'Orbitron', label: '[Tech/Electronic] Orbitron' },
  { value: 'Righteous', label: '[Retro/Party] Righteous' }
];
