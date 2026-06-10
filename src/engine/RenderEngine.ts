import { VideoConfig, TrackInfo } from '../types';
import { generateSeoFileName } from '../lib/utils';

let MuxerModule: any = null;
try {
  MuxerModule = require('mp4-muxer');
} catch (e) {
  // If we can't require it synchronously, we will import it dynamically later
}

function parseTime(timeStr: string): number {
  const parts = timeStr.split(':').map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

export function parseTracklist(raw: string): TrackInfo[] {
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  const tracks: TrackInfo[] = [];

  for (const line of lines) {
    const match = line.match(/^(\d{1,2}:\d{2}(?::\d{2})?)[ \t]*(?:\||-|—)?[ \t]+(.+)$/);
    if (match) {
      const timestamp = match[1];
      const timeSeconds = parseTime(timestamp);
      const rest = match[2];
      
      let songName = rest;
      let artistName = '';

      if (rest.includes(' - ')) {
        const parts = rest.split(' - ');
        artistName = parts[0].trim();
        songName = parts.slice(1).join(' - ').trim();
      }

      tracks.push({
        timestamp,
        timeSeconds,
        songName,
        artistName,
        albumName: ''
      });
    }
  }
  return tracks.sort((a, b) => a.timeSeconds - b.timeSeconds);
}

export function getCurrentTrack(tracks: TrackInfo[], currentTime: number): TrackInfo | null {
  if (tracks.length === 0) return null;
  let current = tracks[0];
  for (let i = 1; i < tracks.length; i++) {
    if (currentTime >= tracks[i].timeSeconds) {
      current = tracks[i];
    } else {
      break;
    }
  }
  return current;
}

// Particle systems for the visualizers
class Particle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  color: string;
  alpha: number;
  time: number;

  constructor(w: number, h: number, style: string) {
    this.x = Math.random() * w;
    this.y = Math.random() * h;
    this.size = Math.random() * 5 + 1;
    this.speedX = Math.random() * 2 - 1;
    this.speedY = Math.random() * 2 - 1;
    this.alpha = Math.random() * 0.5 + 0.1;
    this.time = Math.random() * 100;
    
    if (style === 'chillout') {
      this.color = `rgba(255, 255, 255, ${this.alpha})`;
      this.speedY = Math.random() * 1 + 0.5; // falling like snow/dust
    } else if (style === 'indian-ambient') {
      this.size = Math.random() * (w * 0.2) + w * 0.1; // Large fog puffs
      this.alpha = Math.random() * 0.08 + 0.02; // Very faint
      this.color = `rgba(220, 200, 180, ${this.alpha})`;
      this.speedX = Math.random() * 2 + 1.5; // Wind blowing right
      this.speedY = (Math.random() - 0.5) * 1;
    } else if (style === 'psychedelic') {
      const hue = Math.floor(Math.random() * 360);
      this.color = `hsla(${hue}, 100%, 70%, ${this.alpha})`;
      this.size = Math.random() * 3 + 1; // dust particle size
      this.speedX = (Math.random() - 0.5) * 4;
      this.speedY = (Math.random() - 0.5) * 4;
    } else if (style === 'party-flash' || style === 'chillout-flash') {
      // Flashing dust, neon lights, minute meteor shower
      const r = Math.random();
      if (r < 0.2) {
         // Meteor
         this.color = `rgba(255, 255, 255, ${this.alpha + 0.4})`;
         this.speedX = Math.random() * 10 - 5;
         this.speedY = Math.random() * 10 + 5;
         this.size = Math.random() * 4 + 2;
      } else if (r < 0.5) {
         // Neon lights or ambient glow
         if (style === 'party-flash') {
            const colors = ['#0ff', '#f0f', '#ff0'];
            this.color = colors[Math.floor(Math.random() * colors.length)];
            this.speedX = (Math.random() - 0.5) * 2;
            this.speedY = (Math.random() - 0.5) * 2;
         } else {
            const colors = ['#e0e0e0', '#b0c4de', '#ffebcd']; // softer tones
            this.color = colors[Math.floor(Math.random() * colors.length)];
            this.speedX = (Math.random() - 0.5) * 1;
            this.speedY = (Math.random() - 0.5) * 1;
         }
         this.size = Math.random() * 6 + 4;
      } else {
         // Flashing dust
         if (style === 'chillout-flash') {
            this.color = `rgba(200, 200, 200, ${this.alpha})`;
         } else {
            this.color = `rgba(255, ${Math.random()*155+100}, ${Math.random()*155+100}, ${this.alpha})`;
         }
         this.speedX = (Math.random() - 0.5) * 6;
         this.speedY = -Math.random() * 4 - 2;
         this.size = Math.random() * 3 + 1;
      }
    } else { // abstract
      this.color = `rgba(255, 255, 255, ${this.alpha})`;
      this.size = Math.random() * 100 + 40; // Base size for lens distortion
      this.speedX = (Math.random() - 0.5) * 2;
      this.speedY = (Math.random() - 0.5) * 2;
    }
  }

  update(w: number, h: number, reactivityData: number) {
    if (this.color.includes('rgba(220, 200, 180')) { // indian-ambient
        this.x += this.speedX * (1 + reactivityData * 1.5);
        this.y += this.speedY;
    } else {
        this.x += this.speedX * (1 + reactivityData * 2);
        this.y += this.speedY * (1 + reactivityData * 2);
    }
    this.time += 0.1;

    if (this.x > w + this.size) this.x = -this.size;
    if (this.x < -this.size) this.x = w + this.size;
    if (this.y > h + this.size) this.y = -this.size;
    if (this.y < -this.size) this.y = h + this.size;
  }

  draw(ctx: CanvasRenderingContext2D, reactivityData: number, style: string) {
    ctx.beginPath();
    let currentAlpha = this.alpha;
    if (style === 'psychedelic') {
        currentAlpha = Math.max(0, this.alpha * (0.5 + 0.5 * Math.sin(this.time + this.x * 0.01)));
        ctx.fillStyle = this.color.replace(/[\d.]+\)$/g, `${currentAlpha})`);
        ctx.arc(this.x, this.y, this.size * (1 + reactivityData), 0, Math.PI * 2);
        ctx.fill();
    } else if (style === 'indian-ambient') {
        // Fog effect with radial gradient
        currentAlpha = Math.max(0, this.alpha * (0.8 + 0.4 * reactivityData));
        const rad = this.size * (1 + reactivityData * 0.5);
        const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, rad);
        grad.addColorStop(0, `rgba(255, 255, 255, ${currentAlpha})`); // White center
        grad.addColorStop(0.3, `rgba(255, 255, 0, ${currentAlpha * 0.8})`); // Yellow
        grad.addColorStop(0.6, `rgba(255, 215, 0, ${currentAlpha * 0.5})`); // Golden
        grad.addColorStop(1, `rgba(255, 140, 0, 0)`); // Orange/Dark Orange at edge
        ctx.fillStyle = grad;
        ctx.arc(this.x, this.y, rad, 0, Math.PI * 2);
        ctx.fill();
    } else if (style === 'party-flash' || style === 'chillout-flash') {
        currentAlpha = Math.max(0, this.alpha * (1 + reactivityData * 1.5));
        ctx.fillStyle = this.color.replace(/[\d.]+\)$/g, `${Math.min(1, currentAlpha)})`);
        ctx.arc(this.x, this.y, this.size * (1 + reactivityData), 0, Math.PI * 2);
        ctx.fill();
    } else if (style === 'abstract') {
        // Will be drawn as a magnifying lens manually from the rendering loop
    } else {
        ctx.fillStyle = this.color;
        ctx.arc(this.x, this.y, this.size * (1 + reactivityData), 0, Math.PI * 2);
        ctx.fill();
    }
  }
}

export async function renderVideoTask(
  config: VideoConfig,
  onProgress: (progress: number) => void,
  checkCancelled: () => boolean,
  passedFileSystemWritable?: any,
  passedOutPath?: string
): Promise<string> {
  return new Promise(async (resolve, reject) => {
    if (!config.audioUrl) {
      return reject(new Error('Audio track is required for rendering.'));
    }

    try {
      const { Muxer, FileSystemWritableFileStreamTarget, ArrayBufferTarget } = MuxerModule || await import('mp4-muxer');

      // 1. Setup Audio Buffer manually for offline extraction
      const req = await fetch(config.audioUrl);
      const audioArrayBuffer = await req.arrayBuffer();
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(audioArrayBuffer);
      let duration = audioBuffer.duration;
      let audioCropStart = 0;
      let audioCropEnd = duration;

      if (config.audioCropEnabled) {
          audioCropStart = Math.max(0, config.audioCropStart || 0);
          audioCropEnd = Math.min(duration, config.audioCropEnd || duration);
          duration = audioCropEnd - audioCropStart;
      }
      
      const sampleRate = audioBuffer.sampleRate;
      const channelData = audioBuffer.getChannelData(0);

      // 2. Setup Video Elements
      let bgMedia: (HTMLImageElement|HTMLVideoElement)[] = [];
      if (config.backgroundImages && config.backgroundImages.length > 0) {
        bgMedia = await Promise.all(config.backgroundImages.map(url => {
          return new Promise<HTMLImageElement|HTMLVideoElement>((r, e) => {
             if (url.endsWith('#video')) {
                 const vid = document.createElement('video');
                 vid.crossOrigin = 'anonymous';
                 vid.muted = true;
                 vid.volume = 0;
                 vid.playsInline = true;
                 vid.src = url;
                 // wait for loaded metadata to know dimensions
                 vid.onloadedmetadata = () => {
                     vid.currentTime = 0; // ready to seek
                     r(vid);
                 };
                 vid.onerror = () => e(new Error("Failed to load background video"));
             } else {
                 const img = new Image();
                 img.crossOrigin = 'anonymous';
                 img.src = url;
                 img.onload = () => r(img);
                 img.onerror = () => e(new Error("Failed to load background image"));
             }
          });
        }));
      }

      let logoImg: HTMLImageElement | null = null;
      if (config.logoUrl) {
        logoImg = new Image();
        logoImg.crossOrigin = 'anonymous';
        logoImg.src = config.logoUrl;
        await new Promise<void>((r) => {
            if(!logoImg) return r();
            logoImg.onload = () => r();
            logoImg.onerror = () => r();
        });
      }

      const canvas = document.createElement('canvas');
      canvas.width = config.resolution.width;
      canvas.height = config.resolution.height;
      const ctx = canvas.getContext('2d', { alpha: false })!;

      const particles: Particle[] = [];
      if (config.style !== 'minimal-fast') {
          const numParticles = config.style === 'abstract' ? 20 : (config.style === 'psychedelic' ? 300 : (config.style === 'indian-ambient' ? 150 : 100));
          for (let i = 0; i < numParticles; i++) {
            particles.push(new Particle(canvas.width, canvas.height, config.style));
          }
      }

      // 3. Setup Destination
      let fileDescriptor: number | null = null;
      let fsModule: any = null;
      let outPath = passedOutPath || '';
      let fileSystemWritable: FileSystemWritableFileStream | null = passedFileSystemWritable || null;
      
      if (!fileSystemWritable && !outPath) {
         const seoName = generateSeoFileName(config);
         if (typeof window !== 'undefined' && (window as any).process && (window as any).process.type === 'renderer') {
            try {
               const { ipcRenderer } = (window as any).require('electron');
               const result = await ipcRenderer.invoke('show-save-dialog', {
                  title: 'Save Rendered Video',
                  defaultPath: seoName,
                  filters: [{ name: 'MP4 Video', extensions: ['mp4'] }]
               });
               if (result.canceled || !result.filePath) {
                  return reject(new Error("Render canceled by user"));
               }
               outPath = result.filePath;
            } catch (e) {
               console.warn("Electron dialog failed in render engine", e);
            }
         }
         
         if (!outPath && typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
            try {
              const fileHandle = await (window as any).showSaveFilePicker({
                 suggestedName: seoName,
                 types: [{ description: 'MP4 Video', accept: { 'video/mp4': ['.mp4'] } }],
              });
              fileSystemWritable = await fileHandle.createWritable();
            } catch (e: any) {
              if (e.name === 'AbortError') return reject(new Error("Render canceled by user"));
              console.warn("Browser save dialog failed, using RAM fallback");
            }
         }
      }

      if (!fileSystemWritable && outPath && typeof window !== 'undefined' && (window as any).require) {
         try {
             fsModule = (window as any).require('fs');
             fileDescriptor = fsModule.openSync(outPath, 'w');
         } catch(e) {
             console.warn("Failed to create fs file descriptor", e);
         }
      }

      let muxerTarget: any;
      if (fileSystemWritable) {
         muxerTarget = new FileSystemWritableFileStreamTarget(fileSystemWritable);
      } else if (fileDescriptor !== null && fsModule) {
         const { StreamTarget } = MuxerModule || await import('mp4-muxer');
         muxerTarget = new StreamTarget({
            onData: (data: Uint8Array, position: number) => {
               const buffer = (window as any).require('buffer').Buffer.from(data);
               fsModule.writeSync(fileDescriptor, buffer, 0, buffer.length, position);
            }
         });
      } else {
         console.warn("Falling back to ArrayBufferTarget (RAM memory)");
         muxerTarget = new ArrayBufferTarget();
      }

      // 4. Muxer and Encoders
      const fps = config.fps || 30;
      const totalFrames = Math.ceil(duration * fps);

      const muxer = new Muxer({
         target: muxerTarget,
         video: {
            codec: 'avc',
            width: canvas.width,
            height: canvas.height,
            frameRate: fps
         },
         audio: {
            codec: 'aac',
            sampleRate: audioBuffer.sampleRate,
            numberOfChannels: Math.min(2, audioBuffer.numberOfChannels)
         },
         fastStart: 'in-memory'
      });

      let videoEncoderConfig = {
         codec: 'avc1.4d002a', // Main Profile
         width: canvas.width,
         height: canvas.height,
         bitrate: 5_000_000,
         framerate: fps,
         hardwareAcceleration: 'prefer-hardware' as HardwareAcceleration
      };
      
      try {
         const support = await VideoEncoder.isConfigSupported(videoEncoderConfig);
         if (!support.supported) {
            videoEncoderConfig.hardwareAcceleration = 'no-preference';
            const supportBaseline = await VideoEncoder.isConfigSupported({...videoEncoderConfig, codec: 'avc1.42001f'});
            if (supportBaseline.supported) {
                videoEncoderConfig.codec = 'avc1.42001f';
            }
         }
      } catch (e) {
         videoEncoderConfig.hardwareAcceleration = 'no-preference';
      }

      const videoEncoder = new VideoEncoder({
         output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
         error: e => reject(new Error("Video Encoder Error: " + e.message))
      });
      videoEncoder.configure(videoEncoderConfig);

      const audioEncoder = new AudioEncoder({
         output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
         error: e => reject(new Error("Audio Encoder Error: " + e.message))
      });
      
      let audioEncoderConfig = {
         codec: 'mp4a.40.2', // AAC-LC
         sampleRate: audioBuffer.sampleRate,
         numberOfChannels: Math.min(2, audioBuffer.numberOfChannels),
         bitrate: 128_000
      };
      
      try {
          const support = await AudioEncoder.isConfigSupported(audioEncoderConfig);
          if (!support.supported) {
              // fallback to opus
              audioEncoderConfig.codec = 'opus';
              (muxer as any).audio.codec = 'opus'; 
          }
      } catch (e) {}
      
      audioEncoder.configure(audioEncoderConfig);

      // 5. Encode Audio (we package it in 1-second chunks for Opus)
      const audioChunkLength = sampleRate; // 1 second
      const startSampleOffset = Math.floor(audioCropStart * sampleRate);
      const endSampleOffset = Math.floor(audioCropEnd * sampleRate);
      
      for (let offset = startSampleOffset; offset < endSampleOffset; offset += audioChunkLength) {
         
         // Wait if queue is getting too large
         while (audioEncoder.encodeQueueSize > 30) {
             await new Promise(r => setTimeout(r, 10));
         }

         const frameCount = Math.min(audioChunkLength, endSampleOffset - offset);
         const planarData = new Float32Array(frameCount * audioBuffer.numberOfChannels);
         
         for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
            const chData = audioBuffer.getChannelData(c);
            planarData.set(chData.subarray(offset, offset + frameCount), c * frameCount);
         }

         const audioData = new AudioData({
            format: 'f32-planar',
            sampleRate: sampleRate,
            numberOfFrames: frameCount,
            numberOfChannels: audioBuffer.numberOfChannels,
            timestamp: ((offset - startSampleOffset) / sampleRate) * 1e6,
            data: planarData
         });

         audioEncoder.encode(audioData);
         audioData.close();
      }

      // 6. Encode Video loop
      let lastProgress = -1;
      let partyMediaIndex = 0;
      let partyLastCutTime = 0;
      let partyGlitch = false;

      for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
         if (checkCancelled()) {
            videoEncoder.close();
            audioEncoder.close();
            if (fileDescriptor !== null && fsModule) fsModule.closeSync(fileDescriptor);
            return reject(new Error("Killed by user"));
         }

         // Wait if queue is getting too large
         while (videoEncoder.encodeQueueSize > 30) {
             await new Promise(r => setTimeout(r, 10));
         }

         const currentTime = frameIndex / fps;
         const progress = Math.floor((frameIndex / totalFrames) * 100);
         
         if (progress !== lastProgress) {
            onProgress(progress);
            lastProgress = progress;
            // Let the JS event loop breathe so the UI updates
            await new Promise(r => setTimeout(r, 0));
         }

         // Calculate RMS for Reactivity
         const startIdx = Math.max(0, Math.floor((currentTime + audioCropStart) * sampleRate));
         const endIdx = Math.min(channelData.length, Math.floor((currentTime + audioCropStart + 1/fps) * sampleRate));
         let sum = 0;
         for (let i = startIdx; i < endIdx; i++) {
             sum += channelData[i] * channelData[i];
         }
         const rms = Math.sqrt(sum / Math.max(1, endIdx - startIdx));
         const normalizedReactivity = Math.min(rms * config.reactivity * 15, 1);

         // Draw sequence
         if (bgMedia.length > 0) {
            let imageIndex = 0;
            
            if (config.style === 'party-flash' || config.style === 'chillout-flash') {
                if (normalizedReactivity > 0.8 && currentTime - partyLastCutTime > 0.2) {
                   partyMediaIndex = Math.floor(Math.random() * bgMedia.length);
                   partyLastCutTime = currentTime;
                   partyGlitch = Math.random() > 0.5;
                } else if (currentTime - partyLastCutTime > 2.0) {
                   partyMediaIndex = (partyMediaIndex + 1) % bgMedia.length;
                   partyLastCutTime = currentTime;
                }
                imageIndex = partyMediaIndex;
            } else {
                if (config.parsedTracklist.length > 0) {
                   let currentTrackIndex = 0;
                   for (let i = 0; i < config.parsedTracklist.length; i++) {
                       if (currentTime >= config.parsedTracklist[i].timeSeconds) currentTrackIndex = i;
                   }
                   imageIndex = currentTrackIndex % bgMedia.length;
                } else {
                   imageIndex = Math.floor((currentTime / duration) * bgMedia.length);
                   if (imageIndex >= bgMedia.length) imageIndex = bgMedia.length - 1;
                }
            }

            const currentMedia = bgMedia[imageIndex];
            // If it's a video, seek to correct position
            if (currentMedia instanceof HTMLVideoElement) {
                // If the delta is large enough or just step the frame. For offline rendering, seeking is required.
                const targetTime = currentTime % currentMedia.duration || 0;
                if (Math.abs(currentMedia.currentTime - targetTime) > 0.1) {
                    currentMedia.currentTime = targetTime;
                    await new Promise(r => {
                         currentMedia.onseeked = r;
                         // safety timeout
                         setTimeout(r, 100);
                    });
                }
            }

            const mWidth = (currentMedia as HTMLVideoElement).videoWidth || currentMedia.width;
            const mHeight = (currentMedia as HTMLVideoElement).videoHeight || currentMedia.height;
            const imgRatio = mWidth / mHeight || 1;
            const canvasRatio = canvas.width / canvas.height;
            let drawW = canvas.width;
            let drawH = canvas.height;
            let offsetX = 0;
            let offsetY = 0;

            if (imgRatio > canvasRatio) {
               drawW = canvas.height * imgRatio;
               offsetX = (canvas.width - drawW) / 2;
            } else {
               drawH = canvas.width / imgRatio;
               offsetY = (canvas.height - drawH) / 2;
            }
            
            ctx.save();
            let finalScale = 1;

            if (config.bgZoomEnabled && config.bgZoomLevel > 0) {
                finalScale += (normalizedReactivity * config.bgZoomLevel / 800);
            }

            if (config.style === 'party-flash' || config.style === 'chillout-flash') {
                // perspective shift, hue shift color tails, bounce blast delay blur glitch
                let blastScale = 1 + (normalizedReactivity * 0.3); // Bounce bump
                if (config.style === 'chillout-flash') blastScale = 1 + (normalizedReactivity * 0.1);
                finalScale *= blastScale;
                
                if (partyGlitch) {
                    // glitch motion already implemented via translation/scaling
                }

                ctx.translate(canvas.width/2, canvas.height/2);
                ctx.scale(finalScale, finalScale);
                // vibration effect
                let vibration = config.style === 'chillout-flash' ? 2 : 10;
                ctx.translate((Math.random()-0.5)*vibration*normalizedReactivity, (Math.random()-0.5)*vibration*normalizedReactivity);
                ctx.translate(-canvas.width/2, -canvas.height/2);
            } else if (finalScale > 1) {
                ctx.translate(canvas.width/2, canvas.height/2);
                ctx.scale(finalScale, finalScale);
                ctx.translate(-canvas.width/2, -canvas.height/2);
            }

            ctx.drawImage(currentMedia, offsetX, offsetY, drawW, drawH);
            
            if (config.style === 'party-flash' && partyGlitch && normalizedReactivity > 0.6) {
                ctx.globalCompositeOperation = 'screen';
                ctx.drawImage(currentMedia, offsetX + 20, offsetY, drawW, drawH);
                ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
                ctx.fillRect(0,0, canvas.width, canvas.height);
            } else if (config.style === 'chillout-flash' && partyGlitch && normalizedReactivity > 0.6) {
                ctx.globalCompositeOperation = 'screen';
                ctx.globalAlpha = 0.4;
                ctx.drawImage(currentMedia, offsetX + 5, offsetY - 5, drawW, drawH);
                ctx.globalAlpha = 1.0;
                ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                ctx.fillRect(0,0, canvas.width, canvas.height);
            }
            ctx.restore();
         } else {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
         }

         // Universal background darkening and audio brightness
         let currentOverlayAlpha = config.overlayOpacity !== undefined ? config.overlayOpacity / 100 : 0.5;
         
         if (config.brightnessEnabled) {
              const bl = config.brightnessLevel !== undefined ? config.brightnessLevel : 50;
              const audioLight = normalizedReactivity * (bl / 50); // Scale up impact
              currentOverlayAlpha = Math.max(0, currentOverlayAlpha - audioLight);
         }

         ctx.fillStyle = `rgba(0, 0, 0, ${currentOverlayAlpha})`;
         ctx.fillRect(0, 0, canvas.width, canvas.height);
         
         // If brightness is even stronger than making overlay transparent, add white flashes!
         if (config.brightnessEnabled) {
              const bl = config.brightnessLevel !== undefined ? config.brightnessLevel : 50;
              const audioLight = normalizedReactivity * (bl / 50);
              const extraWhite = audioLight - (config.overlayOpacity !== undefined ? config.overlayOpacity / 100 : 0.5);
              if (extraWhite > 0) {
                  ctx.globalCompositeOperation = 'screen';
                  if (config.brightnessColorful) {
                      const hue = Math.floor((normalizedReactivity * 360 + currentTime * 200) % 360);
                      ctx.fillStyle = `hsla(${hue}, 100%, 65%, ${Math.min(1, extraWhite * 1.5)})`;
                  } else {
                      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, extraWhite * 1.5)})`;
                  }
                  ctx.fillRect(0, 0, canvas.width, canvas.height);
                  ctx.globalCompositeOperation = 'source-over';
              }
         }

         // Floating thin ray of light (center-left to center-right)
         ctx.save();
         ctx.globalCompositeOperation = 'screen';
         const rayY = canvas.height * 0.5 + Math.sin(currentTime * 0.7) * (canvas.height * 0.05);
         const gradient = ctx.createLinearGradient(canvas.width * 0.1, 0, canvas.width * 0.9, 0);
         gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
         const glowPos = (Math.sin(currentTime * 0.4) + 1) / 2; // moves back and forth 0..1
         gradient.addColorStop(Math.max(0.01, Math.min(0.99, glowPos)), `rgba(255, 255, 255, ${0.3 + normalizedReactivity * 0.5})`);
         gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
         
         ctx.fillStyle = gradient;
         const rayHeight = Math.max(1, canvas.height * 0.003 + normalizedReactivity * 6);
         ctx.fillRect(canvas.width * 0.1, rayY - rayHeight/2, canvas.width * 0.8, rayHeight);
         ctx.restore();

         if (config.brightnessIntensity && config.brightnessIntensity > 0 && config.style !== 'minimal-fast') {
            ctx.save();
            let intensityAlpha = normalizedReactivity * config.brightnessIntensity * 0.4;
            if (config.style === 'party-flash' || config.style === 'chillout-flash') {
                // sudden flashes without over whitish
                if (config.style === 'party-flash') {
                    intensityAlpha = normalizedReactivity > 0.75 ? 0.3 + (normalizedReactivity * 0.3) : normalizedReactivity * 0.1;
                } else {
                    intensityAlpha = normalizedReactivity > 0.75 ? 0.15 + (normalizedReactivity * 0.15) : normalizedReactivity * 0.05;
                }
            } else if (config.style === 'psychedelic') {
                intensityAlpha *= 0.3; // Much lower brightness for psychedelic
            }
            if (config.brightnessColorful) {
                const hue = Math.floor((normalizedReactivity * 180 + currentTime * 50) % 360);
                ctx.fillStyle = `hsla(${hue}, 100%, 70%, ${intensityAlpha})`;
            } else {
                ctx.fillStyle = `rgba(255, 255, 255, ${intensityAlpha})`;
            }
            ctx.globalCompositeOperation = 'screen';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.restore();
         }

         if (config.style !== 'minimal-fast') {
             ctx.save();
             if (config.style === 'chillout') {
                ctx.fillStyle = `rgba(0, 0, 0, ${0.3 - normalizedReactivity * 0.2})`;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
             } else if (config.style === 'indian-ambient') {
                ctx.fillStyle = `rgba(30, 20, 10, ${0.1})`; // warm dark trail
                ctx.fillRect(0, 0, canvas.width, canvas.height);
             } else if (config.style === 'psychedelic') {
                ctx.globalCompositeOperation = 'screen';
                ctx.fillStyle = `hsla(${currentTime * 10 % 360}, 100%, 50%, ${normalizedReactivity * 0.2})`;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.globalCompositeOperation = 'source-over';
             } else if (config.style === 'abstract') {
                // Background darkens slightly
                ctx.fillStyle = `rgba(0, 0, 0, ${0.1})`;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
             }

             particles.forEach(p => {
                p.update(canvas.width, canvas.height, normalizedReactivity);
                p.draw(ctx, normalizedReactivity, config.style);
             });
             
             // Abstract lens distortion
             if (config.style === 'abstract') {
                particles.forEach(p => {
                    const r = p.size * (1 + normalizedReactivity);
                    if (r < 2) return;
                    
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
                    ctx.clip();
                    // Draw a zoomed-in section of the canvas over itself
                    ctx.drawImage(
                        canvas, 
                        p.x - r * 0.8, p.y - r * 0.8, r * 1.6, r * 1.6, // source rect (smaller, so it zooms)
                        p.x - r, p.y - r, r * 2, r * 2 // dest rect
                    );
                    
                    // Optional: a slight tint/glow to make the lens visible
                    const grad = ctx.createRadialGradient(p.x, p.y, r*0.5, p.x, p.y, r);
                    grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
                    grad.addColorStop(1, 'rgba(255, 255, 255, 0.2)');
                    ctx.fillStyle = grad;
                    ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
                    ctx.restore();
                });
             }
             ctx.restore();
         }

         const padding = canvas.height * 0.05;
         ctx.fillStyle = 'white';
         ctx.shadowColor = 'black';
         ctx.shadowBlur = Math.max(4, canvas.height * 0.01);
         ctx.shadowOffsetX = 2;
         ctx.shadowOffsetY = 2;
         const logoSize = Math.max(80, canvas.height * 0.12);

         const textScale = (config.textSize || 100) / 100;
         const fontFam = config.textFont ? `"${config.textFont}", sans-serif` : 'sans-serif';

         ctx.font = `bold ${Math.floor(canvas.height * 0.045 * textScale)}px ${fontFam}`;
         ctx.textAlign = 'left';
         ctx.textBaseline = 'middle';
         ctx.fillText(config.channelName, padding, padding/2 + logoSize / 2);

         if (logoImg) {
            ctx.drawImage(logoImg, canvas.width - padding - logoSize, padding/2, logoSize, logoSize);
         }

                  if (config.style === 'minimal-fast') {
             ctx.save();
             const visW = logoSize;
             const visH = logoSize;
             const visX = canvas.width - padding - visW;
             const visY = canvas.height - padding - visH;
             
             const numBars = 7;
             const barSpace = Math.max(2, visW * 0.05);
             const barW = (visW - (numBars - 1) * barSpace) / numBars;
             
             ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
             for (let i = 0; i < numBars; i++) {
                 const variance = (Math.sin(currentTime * 12 + i * 2.3) * 0.5 + 0.5) * 0.6 + 0.4;
                 let h = visH * normalizedReactivity * variance;
                 h = Math.max(4, Math.min(visH, h));
                 
                 // draw pill shape or simple rect
                 ctx.beginPath();
                 ctx.roundRect(visX + i * (barW + barSpace), visY + visH - h, barW, h, barW/2);
                 ctx.fill();
             }
             ctx.restore();
         } else if (config.style === 'indian-ambient') {
             ctx.save();
             // Golden horizontal party-flash visualizer (lightweight)
             const visW = canvas.width * 0.6;
             const visH = canvas.height * 0.15;
             const visX = (canvas.width - visW) / 2;
             const visY = canvas.height - padding - visH * 1.5;
             
             const numBars = Math.floor(visW / 12);
             const barW = 8;
             const barSpace = 4;
             
             // Base golden line
             ctx.fillStyle = '#FFD700'; // Gold
             ctx.shadowColor = '#FFA500';
             ctx.shadowBlur = normalizedReactivity * 15 + 5;
             
             for (let i = 0; i < numBars; i++) {
                 // Fast high-frequency changes like party flash
                 const variance = Math.max(0.1, (Math.sin(currentTime * 20 + i * 1.5) * Math.cos(currentTime * 15 - i * 0.3) * 0.5 + 0.5));
                 let h = visH * normalizedReactivity * variance;
                 h = Math.max(2, Math.min(visH, h));
                 
                 // Add flashes of bright yellow/white on high hits
                 if (h > visH * 0.7 && Math.random() > 0.5) {
                     ctx.fillStyle = '#FFFFFF';
                     ctx.shadowBlur = 20;
                 } else {
                     ctx.fillStyle = '#FFD700';
                     ctx.shadowBlur = 10;
                 }
                 
                 ctx.fillRect(visX + i * (barW + barSpace), visY + (visH - h)/2, barW, h);
             }
             ctx.restore();
         }

         const currentTrack = getCurrentTrack(config.parsedTracklist, currentTime);
         if (currentTrack || config.albumName) {
            ctx.textAlign = 'left';
            ctx.textBaseline = 'bottom';
            let y = canvas.height - padding;
            
            if (currentTrack) {
                ctx.font = `bold ${Math.floor(canvas.height * 0.06 * textScale)}px ${fontFam}`;
                ctx.fillText(currentTrack.songName, padding, y);
                y -= canvas.height * 0.06 * textScale;
                
                ctx.font = `${Math.floor(canvas.height * 0.035 * textScale)}px ${fontFam}`;
                ctx.fillText(currentTrack.artistName, padding, y);
                y -= canvas.height * 0.05 * textScale;
            }

            if (config.albumName) {
              ctx.save();
              ctx.font = `${Math.floor(canvas.height * 0.03 * textScale)}px ${fontFam}`;
              ctx.translate(padding, y);
              ctx.transform(1, 0, Math.tan(-15 * Math.PI / 180), 1, 0, 0);
              ctx.fillText(config.albumName, 0, 0);
              ctx.restore();
            }
         }

         const frame = new VideoFrame(canvas, { timestamp: (currentTime * 1e6) });
         videoEncoder.encode(frame);
         frame.close();
      }

      await videoEncoder.flush();
      await audioEncoder.flush();
      muxer.finalize();

      if (fileDescriptor !== null && fsModule) {
         fsModule.closeSync(fileDescriptor);
         resolve(`file://${outPath}`);
      } else if (fileSystemWritable) {
         await fileSystemWritable.close();
         resolve(`Saved successfully.`);
      } else {
         const buffer = muxerTarget.buffer;
         const blob = new Blob([buffer], { type: 'video/mp4' });
         const url = URL.createObjectURL(blob);
         resolve(url);
      }

    } catch (err) {
      reject(err);
    }
  });
}
