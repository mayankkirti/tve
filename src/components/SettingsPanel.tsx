import React from 'react';
import { v4 as uuidv4 } from 'uuid';
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
        audioRef.current.src = config.audioUrl.includes('/uploads/') ? '/api/uploads/' + config.audioUrl.split('/uploads/').pop() : config.audioUrl;
        audioRef.current.load();
    }
  }, [config.audioUrl]);

  
  const [isUploadingMedia, setIsUploadingMedia] = React.useState(false);
  const [uploadProgressText, setUploadProgressText] = React.useState('');

  const uploadFilesToServer = async () => {
    setIsUploadingMedia(true);
    setUploadProgressText('Preparing...');
    try {
       const doUpload = async (blobUrl, originalFilename) => {
           if (!blobUrl || !blobUrl.startsWith('blob:')) return blobUrl;
           const blob = await fetch(blobUrl).then(r => r.blob());
           const uploadId = uuidv4();
           const chunkSize = 256 * 1024;
           const totalChunks = Math.ceil(blob.size / chunkSize);
           for (let i = 0; i < totalChunks; i++) {
              setUploadProgressText(`Uploading ${originalFilename} ${Math.round((i/totalChunks)*100)}%`);
              const start = i * chunkSize;
              const chunk = blob.slice(start, Math.min(start + chunkSize, blob.size));
              const formData = new FormData();
              formData.append('uploadId', uploadId);
              formData.append('chunkIndex', String(i));
              formData.append('totalChunks', String(totalChunks));
              formData.append('filename', originalFilename);
              formData.append('chunk', chunk, 'chunk');
              
              
              let retries = 3;
              while(retries-- > 0) {
                 const res = await fetch('/api/upload-chunk', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` },
                    body: formData
                 });
                 if (res.ok) {
                    const data = await res.json();
                    if (data.fileId) return '/api/uploads/' + data.fileId;
                    break; // break retry loop, move to next chunk
                 }
              }
           }
           throw new Error('Upload failed to complete'); // Or we can rely on last chunk returning path
       };

       let newConfig = { ...config };
       if (config.audioUrl && config.audioUrl.startsWith('blob:')) {
          const originalName = config.audioUrl.split('#')[1] ? decodeURIComponent(config.audioUrl.split('#')[1]) : 'audio.mp3';
          const cleanUrl = config.audioUrl.split('#')[0];
          newConfig.audioUrl = await doUpload(cleanUrl, originalName);
       }
       if (config.logoUrl && config.logoUrl.startsWith('blob:')) {
          const originalName = config.logoUrl.split('#')[1] ? decodeURIComponent(config.logoUrl.split('#')[1]) : 'logo.png';
          const cleanUrl = config.logoUrl.split('#')[0];
          newConfig.logoUrl = await doUpload(cleanUrl, originalName);
       }
       
       let newBgs = [];
       for (let i = 0; i < config.backgroundImages.length; i++) {
          let bg = config.backgroundImages[i];
          if (bg.startsWith('blob:')) {
             let isVideo = bg.endsWith('#video');
             let cleanUrl = bg.split('#')[0];
             let uploadedPath = await doUpload(cleanUrl, isVideo ? 'bg.mp4' : 'bg.jpg');
             newBgs.push(uploadedPath + (isVideo ? '#video' : '#image'));
          } else {
             newBgs.push(bg);
          }
       }
       newConfig.backgroundImages = newBgs;

       setConfig(newConfig);
       setUploadProgressText('Upload complete!');
    } catch(e) {
       console.error(e);
       setUploadProgressText('Upload failed. Try again.');
    }
    setTimeout(() => setIsUploadingMedia(false), 2000);
  };

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
      const url = URL.createObjectURL(file) + '#' + encodeURIComponent(file.name);
      setConfig(prev => {
        const nextState = { ...prev, [key]: url };
        if (key === 'audioUrl') {
          nextState.name = file.name.replace(/\.[^/.]+$/, "");
        }
        return nextState;
      });
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

          <div>
             <label className="block mb-1">Multiple Backgrounds Style</label>
             <select
               value={config.bgMediaStyle || 'mix-cuts'}
               onChange={(e) => setConfig(prev => ({ ...prev, bgMediaStyle: e.target.value as any }))}
               className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none"
             >
               <option value="tracklist">According to Tracklist Timing</option>
               <option value="random-crossfade">Random Crossfade</option>
               <option value="hard-cut">Hard Cut (Reactive on Music)</option>
               <option value="soft-crossfade">Soft Crossfade (Reactive on Music)</option>
               <option value="mix-cuts">Mix Cuts (Reactive on Music)</option>
             </select>
          </div>

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
                             audioUrl={config.audioUrl.includes('/uploads/') ? '/api/uploads/' + config.audioUrl.split('/uploads/').pop() : config.audioUrl} 
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
                     <video src={img.includes('/uploads/') ? '/api/uploads/' + img.split('/uploads/').pop() : img} className="w-full h-full object-cover rounded border border-zinc-700" muted autoPlay loop playsInline />
                   ) : (
                     <img src={img.includes('/uploads/') ? '/api/uploads/' + img.split('/uploads/').pop() : img} className="w-full h-full object-cover rounded border border-zinc-700" alt="bg" />
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
             <div className="flex justify-between items-center mb-1">
                <label className="block">Black Overlay Effect</label>
                <button type="button" onClick={() => setConfig(prev => ({ ...prev, bypassOverlays: !prev.bypassOverlays }))} className={`text-xs px-2 py-1 rounded transition-colors ${!config.bypassOverlays ? 'bg-indigo-600 text-white' : 'bg-red-600 text-white'}`}>{config.bypassOverlays ? 'Bypassing' : 'Active'}</button>
             </div>
             <select
               value={config.overlayEffect || 'None'}
               onChange={(e) => setConfig(prev => ({ ...prev, overlayEffect: e.target.value }))}
               disabled={config.bypassOverlays}
               className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none disabled:opacity-50"
             >
               <option value="None">None</option>
               <option value="Classic Orbs">Classic Orbs</option>
               <option value="Soft Bokeh">Soft Bokeh</option>
               <option value="Twinkling Dust">Twinkling Dust</option>
               <option value="Drifting Motes">Drifting Motes</option>
               <option value="Cinematic Light Leaks">Cinematic Light Leaks</option>
               <option value="Falling Snow/Ash">Falling Snow/Ash</option>
               <option value="Starfield Hyperdrive">Starfield Hyperdrive</option>
               <option value="Rolling Fog">Rolling Fog</option>
               <option value="Gentle Smoke">Gentle Smoke</option>
               <option value="Film Grain">Film Grain</option>
               <option value="Lens Flare">Lens Flare</option>
               <option value="VHS Glitch">VHS Glitch</option>
               <option value="Camera Viewfinder">Camera Viewfinder</option>
               <option value="Dust & Scratches">Dust & Scratches</option>
               <option value="HUD">HUD</option>
               <option value="Film Leader Countdown">Film Leader Countdown</option>
               <option value="Grid Lines">Grid Lines</option>
               <option value="Computer Code">Computer Code</option>
               <option value="Rain">Rain</option>
             </select>
          </div>
          
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
            <label className="block mb-1">Visualizer Reactivity ({Math.round(config.reactivity * 100)}%)</label>
            <input 
              type="range" 
              min="0" max="1" step="0.05"
              value={config.reactivity}
              onChange={(e) => setConfig(prev => ({ ...prev, reactivity: parseFloat(e.target.value) }))}
              className="w-full"
            />
          </div>

          <div>
            <label className="block mb-1">Black Overlay Opacity ({config.overlayOpacity}%)</label>
            <input 
              type="range" 
              min="0" max="100" step="1"
              value={config.overlayOpacity}
              onChange={(e) => setConfig(prev => ({ ...prev, overlayOpacity: parseInt(e.target.value) }))}
              className="w-full"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block">BG Zoom (Audio Reactive) ({config.bgZoomLevel}%)</label>
              <button
                type="button"
                onClick={() => setConfig(prev => ({ ...prev, bgZoomEnabled: !prev.bgZoomEnabled }))}
                className={`text-xs px-2 py-1 rounded transition-colors ${config.bgZoomEnabled ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300'}`}
              >
                {config.bgZoomEnabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>
            <input 
              type="range" 
              min="0" max="100" step="1"
              value={config.bgZoomLevel}
              disabled={!config.bgZoomEnabled}
              onChange={(e) => setConfig(prev => ({ ...prev, bgZoomLevel: parseInt(e.target.value) }))}
              className={`w-full ${!config.bgZoomEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block">Brightness (Audio Reactive) ({config.brightnessLevel}%)</label>
              <button
                type="button"
                onClick={() => setConfig(prev => ({ ...prev, brightnessEnabled: !prev.brightnessEnabled }))}
                className={`text-xs px-2 py-1 rounded transition-colors ${config.brightnessEnabled ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300'}`}
              >
                {config.brightnessEnabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>
            <input 
              type="range" 
              min="0" max="100" step="1"
              value={config.brightnessLevel}
              disabled={!config.brightnessEnabled}
              onChange={(e) => setConfig(prev => ({ ...prev, brightnessLevel: parseInt(e.target.value) }))}
              className={`w-full ${!config.brightnessEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
          </div>

          
        </div>

        {/* Text */}
        <div className="space-y-3">
          <label className="block text-xs font-semibold uppercase text-zinc-500">Typography</label>
          
          <div>
            <div>
            <label className="block mb-1">Font Family</label>
            <select 
              value={config.textFont}
              onChange={(e) => setConfig(prev => ({ ...prev, textFont: e.target.value }))}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none"
            >
              {GOOGLE_FONTS.map(f => (
                 <option key={f.name} value={f.name}>{f.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block mb-1">Text Size ({config.textSize}%)</label>
            <input 
              type="range" 
              min="20" max="200" step="5"
              value={config.textSize}
              onChange={(e) => setConfig(prev => ({ ...prev, textSize: parseInt(e.target.value) }))}
              className="w-full"
            />
          </div>
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
          onClick={uploadFilesToServer}
          disabled={isUploadingMedia || (!config.audioUrl || !config.audioUrl.startsWith('blob:'))}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded flex items-center justify-center gap-2 transition-colors mb-2"
        >
          {isUploadingMedia ? uploadProgressText : 'Upload Files to Server'}
        </button>
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
