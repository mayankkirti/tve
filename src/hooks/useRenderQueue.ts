import { useState, useCallback, useRef } from 'react';
import { RenderJob, VideoConfig } from '../types';
import { v4 as uuidv4 } from 'uuid';

export function useRenderQueue() {
  const [jobs, setJobs] = useState<RenderJob[]>([]);
  const cancelTokens = useRef<{ [jobId: string]: () => void }>({});

  const addJob = useCallback((config: VideoConfig, fileSystemWritable?: any, outPath?: string) => {
    const newJob: RenderJob = {
      id: uuidv4(),
      config,
      status: 'queued',
      progress: 0,
      fileSystemWritable,
      outPath
    };
    setJobs((prev) => [...prev, newJob]);
  }, []);

  const removeJob = useCallback((id: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== id));
    if (cancelTokens.current[id]) {
        cancelTokens.current[id]();
        delete cancelTokens.current[id];
    }
  }, []);

  const killJob = useCallback((id: string) => {
    setJobs((prev) =>
      prev.map((j) => (j.id === id ? { ...j, status: 'killed', endTime: Date.now(), etaMilliseconds: 0 } : j))
    );
    if (cancelTokens.current[id]) {
      cancelTokens.current[id]();
      delete cancelTokens.current[id];
    }
  }, []);

  const updateJob = useCallback((id: string, updates: Partial<RenderJob>) => {
    setJobs((prev) =>
      prev.map((j) => (j.id === id ? { ...j, ...updates } : j))
    );
  }, []);

  const startQueue = useCallback(async () => {
    const nextJob = jobs.find((j) => j.status === 'queued');
    if (!nextJob) return;

    let isCancelled = false;
    cancelTokens.current[nextJob.id] = () => {
      isCancelled = true;
    };

    updateJob(nextJob.id, { status: 'uploading', progress: 0, startTime: Date.now() });

    try {
      // Gather files for backend upload using chunked uploads
      updateJob(nextJob.id, { progress: 0 }); // signal upload started
      
      let totalBytesToUpload = 0;
      let uploadedBytes = 0;

      const uploadFileInChunks = async (blob: Blob, filename: string): Promise<string> => {
        const uploadId = uuidv4();
        const chunkSize = 1024 * 1024 * 4; // 4MB chunks to bypass nginx limits
        const totalChunks = Math.ceil(blob.size / chunkSize);
        
        if (totalChunks === 0) {
            const formData = new FormData();
            formData.append('uploadId', uploadId);
            formData.append('chunkIndex', '0');
            formData.append('totalChunks', '1');
            formData.append('filename', filename);
            formData.append('chunk', blob, 'chunk');
            
            let res;
            let retries = 5;
            let data;
            while(retries > 0) {
              res = await fetch('/api/upload-chunk', { 
                method: 'POST', 
                body: formData,
                headers: { 'Accept': 'application/json' },
                credentials: 'same-origin'
              });
              if (res.status === 429) {
                 retries--;
                 await new Promise(r => setTimeout(r, 2000));
                 continue;
              }
              if (res.url && res.url.includes('cookie_check')) {
                 const iframe = document.createElement('iframe');
                 iframe.src = res.url;
                 iframe.style.display = 'none';
                 document.body.appendChild(iframe);
                 await new Promise(r => setTimeout(r, 3000));
                 document.body.removeChild(iframe);
                 retries--;
                 continue;
              }
              if (!res.ok) {
                 retries--;
                 await new Promise(r => setTimeout(r, 2000));
                 continue;
              }
              try {
                const text = await res.text();
                data = JSON.parse(text);
                break;
              } catch (e: any) {
                retries--;
                await new Promise(r => setTimeout(r, 2000));
                continue;
              }
            }
            if (!data) throw new Error(`Empty file upload failed`);
            return data.path;
        }

        for (let i = 0; i < totalChunks; i++) {
          if (isCancelled) throw new Error("Killed by user");
          const start = i * chunkSize;
          const end = Math.min(start + chunkSize, blob.size);
          const chunk = blob.slice(start, end);
          
          const formData = new FormData();
          formData.append('uploadId', uploadId);
          formData.append('chunkIndex', String(i));
          formData.append('totalChunks', String(totalChunks));
          formData.append('filename', filename);
          formData.append('chunk', chunk, 'chunk');
          
          let res;
          let retries = 5;
          let data;
          while(retries > 0) {
            res = await fetch('/api/upload-chunk', { 
              method: 'POST', 
              body: formData,
              headers: { 'Accept': 'application/json' },
              credentials: 'same-origin'
            });
            
            if (res.status === 429) {
               retries--;
               await new Promise(r => setTimeout(r, 2000));
               continue;
            }
            
            if (res.url && res.url.includes('cookie_check')) {
               const iframe = document.createElement('iframe');
               iframe.src = res.url;
               iframe.style.display = 'none';
               document.body.appendChild(iframe);
               await new Promise(r => setTimeout(r, 3000));
               document.body.removeChild(iframe);
               
               retries--;
               continue;
            }
            
            if (!res.ok) {
               retries--;
               await new Promise(r => setTimeout(r, 2000));
               continue;
            }
            
            try {
               const text = await res.text();
               data = JSON.parse(text);
               break;
            } catch(e: any) {
               retries--;
               await new Promise(r => setTimeout(r, 2000));
               continue;
            }
          }
          
          if (!data) throw new Error(`Chunk upload failed: ${i}`);
          
          uploadedBytes += chunk.size;
          const progressPercent = Math.floor((uploadedBytes / totalBytesToUpload) * 100);
          updateJob(nextJob.id, { progress: Math.min(99, progressPercent) });
          await new Promise(r => setTimeout(r, 600));
          if (data.fileId) {
            return data.path; 
          }
          // small delay
          await new Promise(r => setTimeout(r, 500));
        }
        throw new Error("Upload failed to finalize");
      };

      const serverConfig: any = { ...nextJob.config };

      // Pre-fetch everything to determine total size
      const filesToUpload: { blob: Blob, filename: string, assign: (path: string) => void }[] = [];
      
      if (nextJob.config.audioUrl) {
         try {
           const audioRes = await fetch(nextJob.config.audioUrl);
           const audioBlob = await audioRes.blob();
           filesToUpload.push({ blob: audioBlob, filename: 'audio.mp3', assign: p => serverConfig.audioPath = p });
         } catch (e) {
             throw new Error('Failed to fetch audio track');
         }
      } else {
         throw new Error('Audio track missing');
      }

      if (nextJob.config.logoUrl) {
         try {
           const logoRes = await fetch(nextJob.config.logoUrl);
           const logoBlob = await logoRes.blob();
           filesToUpload.push({ blob: logoBlob, filename: 'logo.png', assign: p => serverConfig.logoPath = p });
         } catch (e) {
             // ignore
         }
      }

      serverConfig.bgPaths = [];
      for (let i = 0; i < nextJob.config.backgroundImages.length; i++) {
          if (isCancelled) throw new Error("Killed by user");
          try {
             const bgUrl = nextJob.config.backgroundImages[i];
             const isVideo = bgUrl.endsWith('#video');
             const urlToFetch = isVideo ? bgUrl.replace('#video', '') : bgUrl;
             const bgRes = await fetch(urlToFetch);
             const bgBlob = await bgRes.blob();
             const ext = isVideo ? (bgBlob.type === 'video/mp4' || urlToFetch.endsWith('.mp4') ? 'mp4' : 'webm') : 'png';
             filesToUpload.push({ blob: bgBlob, filename: `bg_${i}.${ext}`, assign: p => serverConfig.bgPaths.push(p) });
          } catch (e) {}
      }

      totalBytesToUpload = filesToUpload.reduce((acc, f) => acc + f.blob.size, 0);

      // Upload them sequentially
      for (const item of filesToUpload) {
         const path = await uploadFileInChunks(item.blob, item.filename);
         item.assign(path);
      }

      if (isCancelled) throw new Error("Killed by user");

      let response: Response | undefined;
      let renderRetries = 5;
      while(renderRetries > 0) {
         response = await fetch('/api/render', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(serverConfig)
         });
         
         if (response.url && response.url.includes('cookie_check')) {
            const iframe = document.createElement('iframe');
            iframe.src = response.url;
            iframe.style.display = 'none';
            document.body.appendChild(iframe);
            await new Promise(r => setTimeout(r, 3000));
            document.body.removeChild(iframe);
            renderRetries--;
            continue;
         }
         if (response.status === 429 || response.status === 503 || response.status === 502) {
             renderRetries--;
             await new Promise(r => setTimeout(r, 5000));
             continue; // Wait and try again if paused.
         }
         break;
      }
      
      if (!response) throw new Error("Failed to start render");
      if (!response.ok) {
         let errorText = 'Failed to start render on server';
         try {
             const text = await response.text();
             try {
                const d = JSON.parse(text);
                errorText = d.error || errorText;
             } catch {
                errorText = text;
             }
         } catch {
         }
         throw new Error(errorText);
      }
      
      let resJsonData;
      try {
         const text = await response.text();
         resJsonData = JSON.parse(text);
      } catch(e: any) {
         throw new Error(`Start render JSON error`);
      }
      const { jobId } = resJsonData;

      updateJob(nextJob.id, { backendId: jobId, status: 'rendering', startTime: Date.now(), progress: 0, etaMilliseconds: 0 });

      let lastProgress = 0;
      let errorCount = 0;

      while (!isCancelled) {
          try {
            const statusRes = await fetch(`/api/jobs/${jobId}`, { credentials: 'same-origin' });
            
            if (statusRes.url && statusRes.url.includes('cookie_check')) {
               const iframe = document.createElement('iframe');
               iframe.src = statusRes.url;
               iframe.style.display = 'none';
               document.body.appendChild(iframe);
               await new Promise(r => setTimeout(r, 3000));
               document.body.removeChild(iframe);
               continue;
            }
            
            if (!statusRes.ok) {
               if (statusRes.status === 404) {
                 throw new Error("Job not found on server (memory was cleared or server restarted). Please retry.");
               }
               if (statusRes.status === 429 || statusRes.status === 503 || statusRes.status === 502) {
                 // Environment paused or rate limited. Don't throw, just wait longer and retry.
                 await new Promise(r => setTimeout(r, 10000));
                 continue;
               }
               throw new Error(`Failed to poll job status: HTTP ${statusRes.status}`);
            }
            errorCount = 0; // reset on success
            let statusData;
            try {
               const text = await statusRes.text();
               statusData = JSON.parse(text);
            } catch(e: any) {
               throw new Error(`Status JSON error`);
            }
            
            if (statusData.status === 'completed') {
             try {
                let videoRes;
                let dlRetries = 10;
                while(dlRetries > 0) {
                   videoRes = await fetch(`/api/jobs/${jobId}/download`, { method: 'HEAD', credentials: 'same-origin' });
                   if (videoRes.status === 429) {
                      dlRetries--;
                      await new Promise(r => setTimeout(r, 2000));
                      continue;
                   }
                   if (videoRes.url && videoRes.url.includes('cookie_check')) {
                      dlRetries--;
                      await new Promise(r => setTimeout(r, 2000));
                      continue;
                   }
                   break;
                }
                if (videoRes && videoRes.ok) {
                   updateJob(nextJob.id, { 
                       status: 'completed', 
                       progress: 100, 
                       blobUrl: `/api/jobs/${jobId}/download`, 
                       endTime: Date.now(), 
                       etaMilliseconds: 0 
                   });
                } else {
                   const errInfo = videoRes ? videoRes.status : 'unknown';
                   throw new Error("Rendered video unavailable: " + errInfo);
                }
             } catch (e: any) {
                updateJob(nextJob.id, { 
                   status: 'failed', 
                   error: e.message || 'Failed to download final video',
                   endTime: Date.now() 
                });
             }
             break;
          } else if (statusData.status === 'error') {
             throw new Error(statusData.error);
          } else {
             const currentProgress = statusData.progress || 0;
             if (currentProgress > lastProgress) {
                 lastProgress = currentProgress;
                 setJobs(prevJobs => {
                    const currentJob = prevJobs.find(j => j.id === nextJob.id);
                    if (!currentJob || !currentJob.startTime) return prevJobs;
                    const elapsedTime = Date.now() - currentJob.startTime;
                    let etaMilliseconds = currentJob.etaMilliseconds;
                    if (currentProgress > 0) {
                      const totalEstimatedTime = (elapsedTime / currentProgress) * 100;
                      etaMilliseconds = totalEstimatedTime - elapsedTime;
                    }
                    return prevJobs.map(j => 
                      j.id === nextJob.id ? { ...j, progress: currentProgress, etaMilliseconds } : j
                    );
                 });
             }
          }
          } catch(err: any) {
             errorCount++;
             if (err.message && err.message.includes("Job not found")) {
                 throw err;
             }
             if (errorCount > 100) {
                 throw err;
             }
             // Backoff slightly more on repeated errors
             await new Promise(r => setTimeout(r, 5000));
          }
          await new Promise(r => setTimeout(r, 4000));
      }
    } catch (err: any) {
      if (!isCancelled) {
        updateJob(nextJob.id, {
          status: 'failed',
          error: err?.message || 'Unknown error',
          endTime: Date.now()
        });
      }
    } finally {
      delete cancelTokens.current[nextJob.id];
    }
  }, [jobs, updateJob]);

  return { jobs, addJob, removeJob, killJob, startQueue };
}
