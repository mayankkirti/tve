import React from 'react';
import { VideoConfig, VisualizerStyle, TrackInfo } from '../types';
import { RESOLUTIONS, GOOGLE_FONTS } from '../constants';
import { Settings, Image as ImageIcon, Music, Play, Plus, X, RotateCcw } from 'lucide-react';
import { cn } from '../lib/utils';
import { parseTracklist } from '../engine/RenderEngine';
import { AudioCropper } from './AudioCropper';
import { YouTubeSettings } from './YouTubeSettings';

export function SettingsPanel({
  config,
  setConfig,
  onAddToQueue,
  onReset,
  youtubeToken,
  setYoutubeToken,
  autoUploadYT,
  setAutoUploadYT
}: {
  config: VideoConfig;
  setConfig: React.Dispatch<React.SetStateAction<VideoConfig>>;
  onAddToQueue: () => void;
  onReset: () => void;
  youtubeToken: string | null;
  setYoutubeToken: (t: string | null) => void;
  autoUploadYT: boolean;
  setAutoUploadYT: (b: boolean) => void;
}) {
  const [audioDuration, setAudioDuration] = React.useState<number>(0);
  const audioRef = React.useRef<HTMLAudioElement>(null);

  React.useEffect(() => {
    if (config.audioUrl && audioRef.current) {
        audioRef.current.src = config.audioUrl;
        audioRef.current.load();
    }
  }, [config.audioUrl]);

  const handleAudioLoadedMetadata = () => {
      if (audioRef.current) {
          const duration = audioRef.current.duration;
          setAudioDuration(duration);
          if (!config.audioCropEnabled) {
              setConfig(prev => ({ ...prev, audioCropStart: 0, audioCropEnd: duration }));
          }
      }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, key: 'audioUrl' | 'logoUrl') => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setConfig(prev => ({ ...prev, [key]: url }));
    }
  };

  const handleMultipleImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from((e.target.files as FileList) || []);
    if (files.length > 0) {
      const urls = files.map((file: File) => {
        const url = URL.createObjectURL(file);
        return file.type.startsWith('video/') ? url + '#video' : url + '#image';
      });
      setConfig(prev => ({ ...prev, backgroundImages: [...prev.backgroundImages, ...urls] }));
    }
  };


  const [flowInput, setFlowInput] = React.useState('');

  const handleAddFlowLink = () => {
    if (!flowInput) return;
    const urls = flowInput.split(/[\s,]+/);
    const newBackgrounds = [];
    
    for (const url of urls) {
      if (!url) continue;
      try {
        const urlObj = new URL(url);
        if (urlObj.hostname === 'labs.google' && urlObj.pathname.startsWith('/fx/tools/flow/shared/')) {
          const parts = urlObj.pathname.split('/');
          const type = parts[5]; // video or image
          const id = parts[6];
          if (type === 'video' && id) {
            newBackgrounds.push(`/api/proxy-flow/video/${id}#video`);
          } else if (type === 'image' && id) {
             newBackgrounds.push(`/api/proxy-flow/image/${id}#image`);
          }
        }
      } catch(e) {}
    }
    
    if (newBackgrounds.length > 0) {
      setConfig(prev => ({ ...prev, backgroundImages: [...prev.backgroundImages, ...newBackgrounds] }));
    }
    setFlowInput('');
  };

  const removeImage = (index: number) => {
    setConfig(prev => ({
      ...prev,
      backgroundImages: prev.backgroundImages.filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="w-80 bg-zinc-900 border-r border-zinc-800 flex flex-col h-full overflow-y-auto overflow-x-hidden">
      <div className="p-4 border-b border-zinc-800 flex items-center gap-2">
        <Settings className="w-5 h-5 text-zinc-400" />
        <h2 className="font-semibold text-zinc-100">Setup Project</h2>
      </div>
      
      <div className="flex-1 p-4 space-y-6 text-sm text-zinc-300">
        
        {/* Basic Info */}
        <div className="space-y-3">
          <label className="block text-xs font-semibold uppercase text-zinc-500">Project Name</label>
          <input 
            type="text" 
            value={config.name}
            onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-zinc-500"
          />
        </div>

        {/* Media */}
        <div className="space-y-3">
          <label className="block text-xs font-semibold uppercase text-zinc-500">Media</label>

          <label className="flex items-center gap-2 p-3 bg-zinc-800 hover:bg-zinc-700 rounded cursor-pointer border border-zinc-700 transition-colors">
            <Music className="w-4 h-4" />
            <span className="flex-1 truncate">{config.audioUrl && config.audioUrl.startsWith('blob:') ? 'Audio Selected' : 'Upload Audio (Required)'}</span>
            <input type="file" accept="audio/*" className="hidden" onChange={(e) => handleFileChange(e, 'audioUrl')} />
          </label>
          <div className="flex items-center gap-2">
            <input 
              type="text" 
              placeholder="Or paste Google Drive URL..." 
              value={config.audioUrl && !config.audioUrl.startsWith('blob:') ? config.audioUrl : ''}
              onChange={(e) => setConfig(prev => ({ ...prev, audioUrl: e.target.value }))}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 text-xs focus:outline-none focus:border-zinc-500"
            />
          </div>

          {config.audioUrl && config.audioUrl.startsWith('blob:') && (
              <div className="bg-zinc-800/50 p-3 rounded border border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between">
                     <span className="text-xs font-semibold uppercase text-zinc-500">Audio Crop</span>
                     <button
                        type="button"
                        onClick={() => setConfig(prev => ({ ...prev, audioCropEnabled: !prev.audioCropEnabled }))}
                        className={`text-xs px-2 py-1 rounded transition-colors ${config.audioCropEnabled ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300'}`}
                     >
                        {config.audioCropEnabled ? 'Enabled' : 'Disabled'}
                     </button>
                  </div>
                  
                  <audio ref={audioRef} onLoadedMetadata={handleAudioLoadedMetadata} className="hidden" controls />

                  {config.audioCropEnabled && audioDuration > 0 && (
                      <div className="space-y-4">
                          <AudioCropper 
                             audioUrl={config.audioUrl} 
                             start={config.audioCropStart} 
                             end={config.audioCropEnd}
                             duration={audioDuration}
                             onChangeStart={(val) => setConfig(prev => ({ ...prev, audioCropStart: val }))}
                             onChangeEnd={(val) => setConfig(prev => ({ ...prev, audioCropEnd: val }))}
                          />
                      </div>
                  )}
              </div>
          )}

          <label className="flex flex-col gap-2 p-3 bg-zinc-800 hover:bg-zinc-700/80 rounded cursor-pointer border border-zinc-700 transition-colors">
            <div className="flex items-center gap-2 text-zinc-300">
               <ImageIcon className="w-4 h-4" />
               <span className="flex-1 truncate">Bg Media ({config.backgroundImages.length})</span>
            </div>
            <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleMultipleImages} />
          </label>
          <div className="flex gap-2">
             <input 
               type="text" 
               placeholder="Paste Flow link(s)..." 
               value={flowInput}
               onChange={(e) => setFlowInput(e.target.value)}
               onKeyDown={(e) => e.key === 'Enter' && handleAddFlowLink()}
               className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 text-xs focus:outline-none"
             />
             <button onClick={handleAddFlowLink} className="bg-zinc-700 hover:bg-zinc-600 rounded px-3 text-xs text-zinc-300">Add</button>
          </div>
          {config.backgroundImages.length > 0 && (
             <div className="flex gap-2 overflow-x-auto py-1">
               {config.backgroundImages.map((img, i) => (
                 <div key={i} className="relative w-12 h-12 flex-shrink-0 group">
                   {img.endsWith('#video') ? (
                     <video src={img} className="w-full h-full object-cover rounded border border-zinc-700" muted autoPlay loop playsInline />
                   ) : (
                     <img src={img} className="w-full h-full object-cover rounded border border-zinc-700" alt="bg" />
                   )}
                   <button onClick={() => removeImage(i)} className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-0.5 transform translate-x-1 -translate-y-1 opacity-0 group-hover:opacity-100 transition-opacity">
                     <X className="w-2 h-2" />
                   </button>
                 </div>
               ))}
             </div>
          )}

          <label className="flex items-center gap-2 p-3 bg-zinc-800 hover:bg-zinc-700 rounded cursor-pointer border border-zinc-700 transition-colors">
            <ImageIcon className="w-4 h-4 text-zinc-300" />
            <span className="flex-1 truncate text-zinc-300">{config.logoUrl ? 'Logo Selected' : 'Upload Logo'}</span>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, 'logoUrl')} />
          </label>

          {config.logoUrl && (
             <div className="space-y-1">
               <label className="text-zinc-400 text-xs flex justify-between">
                 <span>Logo Size</span>
                 <span>{config.logoSize}%</span>
               </label>
               <input
                 type="range"
                 min="10"
                 max="200"
                 value={config.logoSize || 100}
                 onChange={(e) => setConfig(prev => ({ ...prev, logoSize: parseInt(e.target.value) }))}
                 className="w-full accent-blue-500 bg-zinc-800 block rounded"
               />
             </div>
          )}
        </div>

        {/* Visuals */}
        <div className="space-y-3">
          <label className="block text-xs font-semibold uppercase text-zinc-500">Visuals</label>
          
          <div>
            <label className="block mb-1">Style</label>
            <select 
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none"
              value={config.style}
              onChange={(e) => setConfig(prev => ({ ...prev, style: e.target.value as VisualizerStyle }))}
            >
              <option value="chillout">Chillout (Snow/Dust)</option>
              <option value="psychedelic">Psychedelic (Color Shift)</option>
              <option value="abstract">Abstract (Pulsing Blobs)</option>
              <option value="indian-ambient">Indian Ambient (Incense Smoke)</option>
              <option value="party-flash">Party Flash (Hard Cuts, Glitches)</option>
              <option value="chillout-flash">Chillout Flash (Soft Cuts, Ambient)</option>
              <option value="minimal-fast">Minimal Fast (No FX, Bottom Right Audio)</option>
            </select>
          </div>

          <div>
            <label className="block mb-1">Reactivity Level ({Math.round(config.reactivity * 100)}%)</label>
            <input 
              type="range" 
              min="0" max="1" step="0.05"
              value={config.reactivity}
              onChange={(e) => setConfig(prev => ({ ...prev, reactivity: parseFloat(e.target.value) }))}
              className="w-full"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block">Brightness Intensity ({Math.round(config.brightnessIntensity * 100)}%)</label>
              <button
                type="button"
                onClick={() => setConfig(prev => ({ ...prev, brightnessIntensity: prev.brightnessIntensity > 0 ? 0 : 0.5 }))}
                className={`text-xs px-2 py-1 rounded transition-colors ${config.brightnessIntensity > 0 ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300'}`}
              >
                {config.brightnessIntensity > 0 ? 'Enabled' : 'Disabled'}
              </button>
            </div>
            <input 
              type="range" 
              min="0" max="1" step="0.05"
              value={config.brightnessIntensity}
              disabled={config.brightnessIntensity === 0}
              onChange={(e) => setConfig(prev => ({ ...prev, brightnessIntensity: parseFloat(e.target.value) }))}
              className={`w-full ${config.brightnessIntensity === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
          </div>
          
          <div className="mb-4">
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm">Text Size ({config.textSize}%)</label>
            </div>
            <input 
              type="range" 
              min="50" max="200" step="5"
              value={config.textSize}
              onChange={(e) => setConfig(prev => ({ ...prev, textSize: parseInt(e.target.value, 10) }))}
              className="w-full"
            />
          </div>

          <div className="mb-5">
              <label className="block mb-1 text-sm">Text Font</label>
              <select 
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none"
                value={config.textFont}
                onChange={(e) => setConfig(prev => ({ ...prev, textFont: e.target.value }))}
              >
                {GOOGLE_FONTS.map(font => (
                  <option key={font.value} value={font.value} style={{ fontFamily: font.value }}>{font.label}</option>
                ))}
              </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1">Resolution</label>
              <select 
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none"
                value={config.resolution.label}
                onChange={(e) => {
                  const res = RESOLUTIONS.find(r => r.label === e.target.value);
                  if (res) setConfig(prev => ({ ...prev, resolution: res }));
                }}
              >
                {RESOLUTIONS.map(r => (
                  <option key={r.label} value={r.label}>{r.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block mb-1">Framerate</label>
              <select 
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none"
                value={config.fps}
                onChange={(e) => setConfig(prev => ({ ...prev, fps: parseInt(e.target.value, 10) }))}
              >
                <option value="15">15 FPS (Fastest)</option>
                <option value="20">20 FPS</option>
                <option value="24">24 FPS (Cinematic)</option>
                <option value="30">30 FPS (Standard)</option>
                <option value="60">60 FPS (Smooth)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Text */}
        <div className="space-y-3">
          <label className="block text-xs font-semibold uppercase text-zinc-500">Typography</label>
          
          <div>
            <label className="block mb-1">Channel Name</label>
            <input 
              type="text" 
              value={config.channelName}
              onChange={(e) => setConfig(prev => ({ ...prev, channelName: e.target.value }))}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none"
            />
          </div>

          <div>
            <label className="block mb-1">Album Name</label>
            <input 
              type="text" 
              value={config.albumName}
              placeholder="Leave blank to hide"
              onChange={(e) => setConfig(prev => ({ ...prev, albumName: e.target.value }))}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none"
            />
          </div>

          <div>
            <label className="block mb-1 text-xs">Tracklist (Format: MM:SS Song - Artist)</label>
            <textarea 
              rows={4}
              value={config.tracklistRaw}
              onChange={(e) => {
                const val = e.target.value;
                setConfig(prev => ({ 
                  ...prev, 
                  tracklistRaw: val,
                  parsedTracklist: parseTracklist(val)
                }));
              }}
              placeholder={"00:00 Intro - Trisha\n03:30 Deep Space - Trisha"}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none text-xs font-mono"
            />
            <div className="text-xs text-zinc-500 mt-1">Parsed: {config.parsedTracklist.length} tracks found</div>
          </div>
        </div>
        
        <YouTubeSettings token={youtubeToken} setToken={setYoutubeToken} autoUploadYT={autoUploadYT} setAutoUploadYT={setAutoUploadYT} />

      </div>

      <div className="p-4 border-t border-zinc-800 space-y-2">
        <button 
          onClick={onAddToQueue}
          disabled={!config.audioUrl}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded flex items-center justify-center gap-2 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add to Queue
        </button>
        <button 
          onClick={onReset}
          className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold py-2 px-4 rounded flex items-center justify-center gap-2 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Reset Defaults
        </button>
      </div>
    </div>
  );
}
