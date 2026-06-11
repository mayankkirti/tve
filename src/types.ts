export type VisualizerStyle = 'none' | 'chillout' | 'psychedelic' | 'abstract' | 'indian-ambient' | 'party-flash' | 'chillout-flash' | 'minimal-fast' | 'classic-orbs' | 'soft-bokeh' | 'twinkling-dust' | 'drifting-motes' | 'cinematic-light-leaks' | 'falling-snow-ash' | 'starfield-hyperdrive' | 'rolling-fog';

export interface Resolution {
  width: number;
  height: number;
  label: string;
}

export interface TrackInfo {
  timestamp: string; // MM:SS or HH:MM:SS
  timeSeconds: number;
  songName: string;
  artistName: string;
  albumName: string;
}

export interface VideoConfig {
  id: string;
  name: string;
  backgroundImages: string[];
  audioUrl: string | null;
  audioCropEnabled: boolean;
  audioCropStart: number;
  audioCropEnd: number;
  logoUrl: string | null;
  logoSize: number; // 0 to 200, percentage based
  tracklistRaw: string;
  parsedTracklist: TrackInfo[];
  style: VisualizerStyle;
  reactivity: number; // 0 to 1
  brightnessIntensity: number; // 0 to 1
  textSize: number; // e.g. 16 to 100
  textFont: string;
  resolution: Resolution;
  fps: number;
  enableBlackOverlay: boolean; overlayOpacity: number; bypassOverlayFX: boolean;
  bgZoomEnabled: boolean;
  bgZoomLevel: number;
  brightnessEnabled: boolean;
  brightnessColorful?: boolean;
  brightnessLevel: number; // 15, 20, 24, 30, 60
  flashAttack?: number;
  flashRelease?: number;
  flashPeak?: number;
  channelName: string;
  albumName: string;
  bgMediaStyle?: 'tracklist' | 'random-crossfade' | 'hard-cut' | 'soft-crossfade' | 'mix-cuts';
  overlayEffect?: string;
}

export interface RenderJob {
  id: string;
  backendId?: string;
  config: VideoConfig;
  status: 'queued' | 'uploading' | 'rendering' | 'completed' | 'failed' | 'killed' | 'paused';
  progress: number; // 0 to 100
  startTime?: number;
  endTime?: number;
  etaMilliseconds?: number;
  blobUrl?: string; // Resulting video
  error?: string;
  fileSystemWritable?: any;
  outPath?: string;
}
