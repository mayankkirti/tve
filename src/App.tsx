import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { VideoConfig } from './types';
import { RESOLUTIONS } from './constants';
import { useRenderQueue } from './hooks/useRenderQueue';
import { SettingsPanel } from './components/SettingsPanel';
import { QueuePanel } from './components/QueuePanel';
import { generateSeoFileName } from './lib/utils';
import { LoginScreen } from './components/LoginScreen';
import { StorageManager } from './components/StorageManager';
import { SecuritySettings } from './components/SecuritySettings';
import { LogOut, MonitorPlay, HardDrive, Shield } from 'lucide-react';

export const createDefaultConfig = (): VideoConfig => ({
  id: uuidv4(),
  name: 'My Vibe Video',
  backgroundImages: [],
  audioUrl: null,
  audioCropEnabled: false,
  audioCropStart: 0,
  audioCropEnd: 0,
  logoUrl: '/logo.png', // Fallback to public/logo.png
  logoSize: 100,
  tracklistRaw: '',
  parsedTracklist: [],
  style: 'psychedelic',
  reactivity: 0.8,
  brightnessIntensity: 0.5,
  textSize: 100, // 100% scale
  textFont: 'Inter',
  resolution: RESOLUTIONS[2], // Default to 1080p now since it's 3rd
  fps: 30, // Default to 30 FPS
  enableBlackOverlay: true, bypassOverlayFX: false, overlayOpacity: 50,
  bgZoomEnabled: true,
  bgZoomLevel: 50,
  brightnessEnabled: true,
  brightnessLevel: 50,
  channelName: 'Trisha Frequencies',
  albumName: '',
  bgMediaStyle: 'mix-cuts',
  overlayEffect: 'None',
});

export default function App() {
  const [config, setConfig] = useState<VideoConfig>(createDefaultConfig());
  const [youtubeToken, setYoutubeToken] = useState<string | null>(null);
  const [autoUploadYT, setAutoUploadYT] = useState<boolean>(true);
  const [authToken, setAuthToken] = useState<string | null>(localStorage.getItem('auth_token'));
  const [currentView, setCurrentView] = useState<'studio' | 'storage' | 'security'>('studio');

  const { jobs, addJob, removeJob, killJob, pauseJob, resumeJob, startQueue } = useRenderQueue(youtubeToken, autoUploadYT);

  useEffect(() => {
    const isRendering = jobs.some(j => j.status === 'rendering' || j.status === 'uploading');
    const hasQueued = jobs.some(j => j.status === 'queued');
    if (!isRendering && hasQueued) {
      startQueue();
    }
  }, [jobs, startQueue]);

  const handleLogout = async () => {
     try {
        await fetch('/api/logout', { 
           method: 'POST',
           headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` } 
        });
     } catch(e) {}
     localStorage.removeItem('auth_token');
     setAuthToken(null);
  };

  if (!authToken) {
     return <LoginScreen onLoginSuccess={setAuthToken} />;
  }

  return (
    <div className="flex h-screen bg-black text-zinc-100 font-sans overflow-hidden">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=${config.textFont.replace(/ /g, '+')}:wght@400;700&display=swap');
      `}</style>

      {/* Universal Left Navigation Rail */}
      <div className="w-16 bg-zinc-950 border-r border-zinc-800 flex flex-col items-center py-6 gap-6 shrink-0 z-50">
         <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center font-bold shadow-lg shadow-indigo-500/20 text-white">
            T
         </div>
         <nav className="flex-1 flex flex-col gap-4 mt-4 w-full">
            <button title="Studio" onClick={() => setCurrentView('studio')} className={`w-full flex justify-center py-3 relative ${currentView === 'studio' ? 'text-indigo-400' : 'text-zinc-600 hover:text-zinc-400'}`}>
               <MonitorPlay className="w-6 h-6" />
               {currentView === 'studio' && <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 rounded-r" />}
            </button>
            <button title="Storage Manager" onClick={() => setCurrentView('storage')} className={`w-full flex justify-center py-3 relative ${currentView === 'storage' ? 'text-indigo-400' : 'text-zinc-600 hover:text-zinc-400'}`}>
               <HardDrive className="w-6 h-6" />
               {currentView === 'storage' && <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 rounded-r" />}
            </button>
            <button title="Security" onClick={() => setCurrentView('security')} className={`w-full flex justify-center py-3 relative ${currentView === 'security' ? 'text-indigo-400' : 'text-zinc-600 hover:text-zinc-400'}`}>
               <Shield className="w-6 h-6" />
               {currentView === 'security' && <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 rounded-r" />}
            </button>
         </nav>
         
         <button title="Logout" onClick={handleLogout} className="text-zinc-600 hover:text-red-400 transition-colors p-2 rounded block">
            <LogOut className="w-5 h-5" />
         </button>
      </div>
      
      {currentView === 'studio' && (
         <>
          {/* Left Sidebar - Settings */}
          <SettingsPanel 
            config={config} 
            setConfig={setConfig} 
            onReset={() => setConfig(createDefaultConfig())}
            onAddToQueue={() => {
              addJob({...config});
            }} 
            youtubeToken={youtubeToken}
            setYoutubeToken={setYoutubeToken}
            autoUploadYT={autoUploadYT}
            setAutoUploadYT={setAutoUploadYT}
          />

          {/* Main Preview Area */}
          <main className="flex-1 flex flex-col items-center justify-center relative p-8 overflow-y-auto bg-[#0a0a0c]">
            <div className="absolute top-4 left-4 text-zinc-500 font-medium tracking-widest text-sm uppercase">
              Trisha Video Engine
            </div>

            <div 
              className="bg-zinc-900 border border-zinc-800 rounded-lg flex flex-col items-center justify-center shadow-2xl relative overflow-hidden transition-all duration-300 shrink-0"
              style={{ 
                 aspectRatio: `${config.resolution.width} / ${config.resolution.height}`, 
                 width: '100%',
                 maxHeight: '65vh',
                 maxWidth: `min(56rem, calc(65vh * (${config.resolution.width} / ${config.resolution.height})))`
              }}
            >
                 {config.backgroundImages.length > 0 ? (
                    config.backgroundImages[0].endsWith('#video') ? (
                       <video src={config.backgroundImages[0]?.includes('/uploads/') ? '/api/uploads/' + config.backgroundImages[0].split('/uploads/').pop()?.replace('#video', '').replace('#image', '') : config.backgroundImages[0].split('#')[0]} className="absolute inset-0 w-full h-full object-cover" style={{ opacity: config.enableBlackOverlay ? 1 - (config.overlayOpacity !== undefined ? config.overlayOpacity / 100 : 0.5) : 1 }} autoPlay loop muted playsInline volume={0} />
                    ) : (
                       <img src={config.backgroundImages[0]?.includes('/uploads/') ? '/api/uploads/' + config.backgroundImages[0].split('/uploads/').pop()?.replace('#image', '').replace('#video', '') : config.backgroundImages[0].split('#')[0]} className="absolute inset-0 w-full h-full object-cover" style={{ opacity: config.enableBlackOverlay ? 1 - (config.overlayOpacity !== undefined ? config.overlayOpacity / 100 : 0.5) : 1 }} alt="Background preview" />
                    )
                 ) : (
                    <div className="absolute inset-0 w-full h-full bg-zinc-950 opacity-80" />
                 )}

                 <div className="z-10 text-center space-y-4">
                     <h3 className="text-2xl font-bold text-zinc-300">Ready to Render</h3>
                     <p className="text-zinc-500 max-w-md mx-auto text-sm">
                       Configure your media, visuals, and tracklist in the panel. When ready, click "Add to Queue" to generate your high-quality reactive video in the background.
                     </p>
                 </div>

                 <div 
                     className="absolute top-4 left-6 h-16 flex items-center text-white z-10 drop-shadow-md"
                     style={{ fontFamily: `"${config.textFont}", sans-serif`, fontSize: `${1.25 * (config.textSize / 100)}rem` }}
                 >
                     {config.channelName}
                 </div>

                 {config.logoUrl && (
                   <img src={config.logoUrl?.includes('/uploads/') ? '/api/uploads/' + config.logoUrl.split('/uploads/').pop() : config.logoUrl} className="absolute top-4 right-6 w-16 h-16 object-contain z-10" alt="Logo" />
                 )}

                 <div className="absolute bottom-6 left-6 text-left z-10 drop-shadow-md">
                     {config.albumName && (
                         <div className="text-zinc-300 italic" style={{ fontFamily: `"${config.textFont}", sans-serif`, fontSize: `${0.875 * (config.textSize / 100)}rem` }}>
                             {config.albumName}
                         </div>
                     )}
                     <div className="text-zinc-200" style={{ fontFamily: `"${config.textFont}", sans-serif`, fontSize: `${1.125 * (config.textSize / 100)}rem` }}>
                         {config.parsedTracklist[0]?.artistName || 'Artist Name'}
                     </div>
                     <div className="text-white font-bold" style={{ fontFamily: `"${config.textFont}", sans-serif`, fontSize: `${1.5 * (config.textSize / 100)}rem` }}>
                         {config.parsedTracklist[0]?.songName || 'Song Name'}
                     </div>
                 </div>
            </div>

            {/* Timeline View */}
            <div className="w-full max-w-4xl mt-8 bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex flex-col gap-2 shrink-0">
                <h4 className="text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-2">Timeline</h4>
                <div 
                   className="w-full h-10 bg-zinc-800 rounded relative overflow-x-auto overflow-y-hidden flex items-center border border-zinc-700"
                   onWheel={(e) => { e.currentTarget.scrollLeft += e.deltaY; }}
                >
                    {config.parsedTracklist.length === 0 && (
                        <div className="text-zinc-500 text-xs px-3">No tracks added. Add tracks in settings.</div>
                    )}
                    {config.parsedTracklist.map((track, i) => (
                        <div key={i} className="flex-none min-w-[120px] max-w-[200px] h-full border-r border-zinc-700/50 bg-indigo-500/20 hover:bg-indigo-500/40 cursor-pointer flex items-center px-2 relative group transition-colors">
                            <span className="text-xs text-zinc-300 truncate font-medium">{track.songName}</span>
                            <span className="absolute left-1 bottom-0 text-[10px] text-zinc-500 group-hover:text-zinc-300">{track.timestamp}</span>
                        </div>
                    ))}
                </div>
                <div className="w-full flex justify-between text-[10px] text-zinc-600 font-mono mt-1">
                    <span>00:00:00.0</span><span>01:00:00.0</span><span>02:00:00.0</span><span>03:00:00.0</span><span>...</span>
                </div>
            </div>
          </main>

          {/* Right Sidebar - Queue */}
          <QueuePanel 
            jobs={jobs}
            startQueue={startQueue}
            killJob={killJob}
            pauseJob={pauseJob}
            resumeJob={resumeJob}
            removeJob={removeJob}
          />
         </>
      )}

      {currentView === 'storage' && <StorageManager />}
      {currentView === 'security' && <SecuritySettings />}

    </div>
  );
}
