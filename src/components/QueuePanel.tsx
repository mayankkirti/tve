import React, { useEffect, useState } from 'react';
import { RenderJob } from '../types';
import { Play, X, Download, AlertCircle, Loader, Clock, Trash2 } from 'lucide-react';
import { formatTime } from '../lib/utils';
import { YouTubeUploader } from './YouTubeUploader';

export function QueuePanel({
  jobs,
  startQueue,
  killJob,
  pauseJob,
  resumeJob,
  removeJob
}: {
  jobs: RenderJob[];
  startQueue: () => void;
  killJob: (id: string) => void;
  pauseJob: (id: string) => void;
  resumeJob: (id: string) => void;
  removeJob: (id: string) => void;
}) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const hasJobs = jobs.length > 0;
  const isRendering = jobs.some(j => j.status === 'rendering');
  const hasQueued = jobs.some(j => j.status === 'queued');

  // Calculate totals
  let totalTookMs = 0;
  let totalLeftMs = 0;
  let hasPendingEtas = false;

  jobs.forEach(j => {
    if (j.startTime) {
      const endTime = j.endTime || now;
      totalTookMs += Math.max(0, endTime - j.startTime);
    }
    if (j.status === 'rendering' && j.etaMilliseconds !== undefined) {
      totalLeftMs += Math.max(0, j.etaMilliseconds);
    } else if (j.status === 'queued') {
      hasPendingEtas = true;
    }
  });

  return (
    <div className="w-80 bg-zinc-900 border-l border-zinc-800 flex flex-col h-full overflow-y-auto">
      <div className="p-4 border-b border-zinc-800 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-zinc-100 flex items-center gap-2">
            Render Queue
            <span className="bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full text-xs">{jobs.length}</span>
          </h2>
          <div className="flex items-center gap-2">
            <button
               onClick={async () => {
                 try {
                    await fetch('/api/cleanup', { method: 'POST' });
                    // Provide some fast local optimistic update or let user figure it out, but they asked for server cleanup.
                    // To do local we would need a clearJobs fn from useRenderQueue, but let's just alert
                    window.location.reload(); 
                 } catch(e) {}
               }}
               className="text-orange-400 hover:text-orange-300 flex items-center gap-1 text-sm bg-orange-400/10 hover:bg-orange-400/20 px-2 py-1 rounded"
            >
              <Trash2 className="w-4 h-4" /> Cleanup Server
            </button>
            {hasQueued && !isRendering && (
               <button 
               onClick={startQueue}
               className="text-green-400 hover:text-green-300 flex items-center gap-1 text-sm bg-green-400/10 hover:bg-green-400/20 px-2 py-1 rounded"
             >
               <Play className="w-4 h-4" /> Start
             </button>
            )}
          </div>
        </div>
        
        {hasJobs && (
          <div className="bg-zinc-950 rounded p-2 text-xs border border-zinc-800 flex flex-col gap-1">
            <div className="flex justify-between text-zinc-300">
              <span className="text-zinc-500">Total Took:</span>
              <span className="font-mono">{formatTime(totalTookMs)}</span>
            </div>
            <div className="flex justify-between text-zinc-300">
              <span className="text-zinc-500">Total Left:</span>
              <span className="font-mono">
                {totalLeftMs > 0 || isRendering ? formatTime(totalLeftMs) : '00:00:00'}
                {hasPendingEtas && <span className="text-zinc-500 ml-1">+ Pending</span>}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 p-4 space-y-4">
        {!hasJobs && (
          <div className="flex flex-col items-center justify-center h-40 text-zinc-600 space-y-2">
             <AlertCircle className="w-8 h-8 opacity-50" />
             <p className="text-sm">Queue is empty</p>
          </div>
        )}

        {jobs.map(job => {
          let timeTook = 0;
          let timeLeft = job.etaMilliseconds || 0;

          if (job.startTime) {
            const endTime = job.endTime || now;
            timeTook = Math.max(0, endTime - job.startTime);
          }

          return (
            <div key={job.id} className="bg-zinc-800 rounded p-3 border border-zinc-700">
              <div className="flex justify-between items-start mb-2">
                <div className="min-w-0">
                  <h3 className="font-semibold text-zinc-200 truncate">{job.config.name || 'Untitled Video'}</h3>
                  <p className="text-xs text-zinc-400">{job.config.resolution.label}</p>
                </div>
                <button onClick={() => removeJob(job.id)} className="text-zinc-500 hover:text-red-400">
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              {/* Status Indicator */}
              <div className="flex flex-col gap-2 mt-3 text-xs">
                <div className="flex items-center gap-2">
                  {job.status === 'queued' && <span className="text-zinc-400">Queued</span>}
                  {job.status === 'uploading' && (
                    <>
                      <Loader className="w-3 h-3 text-blue-400 animate-spin" />
                      <span className="text-blue-400 font-medium">Uploading... {job.progress}%</span>
                    </>
                  )}
                  {job.status === 'rendering' && (
                    <>
                      <Loader className="w-3 h-3 text-indigo-400 animate-spin" />
                      <span className="text-indigo-400 font-medium">Rendering... {job.progress}%</span>
                    </>
                  )}
                  {job.status === 'completed' && <span className="text-green-400">Completed</span>}
                  {job.status === 'failed' && <span className="text-red-400">Failed: {job.error}</span>}
                  {job.status === 'killed' && <span className="text-orange-400">Killed</span>}
                  {job.status === 'paused' && <span className="text-yellow-400">Paused</span>}
                </div>

                {job.status === 'completed' && job.blobUrl && (
                  <div className="flex gap-2">
                    <a 
                      href={job.blobUrl} 
                      download={job.config.name ? `${job.config.name}.mp4` : 'video.mp4'}
                      className="flex-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 py-1.5 rounded flex items-center justify-center gap-2 text-xs font-medium transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      Download Video
                    </a>
                    <YouTubeUploader job={job} />
                  </div>
                )}
                
                {job.status === 'rendering' && (
                  <button 
                    onClick={() => pauseJob(job.id)}
                    className="flex-1 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 py-1.5 rounded text-xs font-medium transition-colors"
                  >
                    Pause
                  </button>
                )}
                {job.status === 'paused' && (
                  <button 
                    onClick={() => resumeJob(job.id)}
                    className="flex-1 bg-green-500/10 hover:bg-green-500/20 text-green-500 py-1.5 rounded text-xs font-medium transition-colors"
                  >
                    Resume
                  </button>
                )}
                {(job.status === 'rendering' || job.status === 'uploading' || job.status === 'paused') && (
                  <button 
                    onClick={() => killJob(job.id)}
                    className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 py-1.5 rounded text-xs font-medium transition-colors"
                  >
                    Kill {job.status === 'uploading' ? 'Upload' : 'Render'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
