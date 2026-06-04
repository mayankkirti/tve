import React, { useState, useEffect } from 'react';
import { HardDrive, Trash2, Edit2, Play, Download, Settings, RefreshCcw, Youtube } from 'lucide-react';
import { formatTime } from '../lib/utils';
import { getAccessToken, googleSignIn } from '../lib/auth';

export function StorageManager() {
   const [files, setFiles] = useState<any[]>([]);
   const [freeBytes, setFreeBytes] = useState(0);
   const [totalBytes, setTotalBytes] = useState(0);
   const [diskLimitMB, setDiskLimitMB] = useState(2048);
   const [loading, setLoading] = useState(true);
   const [previewTarget, setPreviewTarget] = useState<string | null>(null);
   const [uploadingFile, setUploadingFile] = useState<string | null>(null);

   const loadStorage = async () => {
      setLoading(true);
      try {
         const res = await fetch('/api/disk');
         const data = await res.json();
         if (res.ok) {
            setFiles(data.files || []);
            setFreeBytes(data.freeBytes || 0);
            setTotalBytes(data.totalBytes || 1);
            setDiskLimitMB(data.diskLimitMB || 2048);
         }
      } catch(e) {}
      setLoading(false);
   };

   useEffect(() => {
      loadStorage();
   }, []);

   const updateLimit = async (limit: number) => {
      if (limit < 500) limit = 500;
      setDiskLimitMB(limit);
      await fetch('/api/settings', {
         method: 'PUT',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ diskLimitMB: limit })
      });
      loadStorage();
   };

   const deleteFile = async (name: string) => {
      if(!confirm(`Delete ${name}?`)) return;
      await fetch(`/api/disk/${name}`, { method: 'DELETE' });
      loadStorage();
   };

   const renameFile = async (oldName: string) => {
      const newName = prompt("Rename to:", oldName);
      if(!newName || newName === oldName) return;
      await fetch(`/api/disk/rename`, { 
         method: 'PUT', 
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ oldName, newName })
      });
      loadStorage();
   };

   const uploadToYouTube = async (filename: string) => {
       try {
           let token = await getAccessToken();
           if (!token) {
               const res = await googleSignIn();
               if (res) token = res.accessToken;
               else return;
           }
           
           setUploadingFile(filename);
           const res = await fetch('/api/disk/youtube', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ filename, title: filename, description: 'Uploaded via Storage Manager', token })
           });
           
           const data = await res.json();
           if (res.ok && data.url) {
               alert(`Successfully uploaded to YouTube: ${data.url}`);
               window.open(data.url, '_blank');
           } else {
               alert(data.error || 'Failed to upload to YouTube');
           }
       } catch(e:any) {
           alert(e.message || 'YouTube Upload Failed');
       } finally {
           setUploadingFile(null);
       }
   };

   const usedByAppBytes = files.reduce((acc, f) => acc + f.size, 0);
   const limitBytes = diskLimitMB * 1024 * 1024;
   const usagePercent = Math.min(100, Math.round((usedByAppBytes / limitBytes) * 100));

   if (previewTarget) {
      return (
         <div className="absolute inset-0 bg-black z-50 flex flex-col">
             <div className="p-4 bg-zinc-900 border-b border-zinc-800 flex justify-between items-center">
                 <h2 className="text-zinc-100 font-medium truncate">{previewTarget}</h2>
                 <button onClick={() => setPreviewTarget(null)} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded text-sm transition-colors">Close Preview</button>
             </div>
             <div className="flex-1 overflow-hidden p-8 flex items-center justify-center">
                 <video src={`/api/uploads/${previewTarget}`} controls autoPlay className="max-w-full max-h-full rounded shadow-2xl border border-zinc-800" />
             </div>
         </div>
      );
   }

   return (
      <div className="flex-1 flex flex-col p-8 overflow-y-auto max-w-5xl mx-auto w-full">
         <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-3"><HardDrive className="text-indigo-400" /> Storage Management</h1>
            <button onClick={loadStorage} className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-white transition-colors">
               <RefreshCcw className="w-5 h-5" />
            </button>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl">
               <div className="flex justify-between items-end mb-4">
                  <h3 className="text-zinc-400 text-sm font-medium uppercase tracking-wider">Engine Capacity Usage</h3>
                  <div className="text-2xl font-bold text-white">{Math.round(usedByAppBytes/1024/1024)}<span className="text-sm text-zinc-500 font-normal"> MB</span></div>
               </div>
               <div className="w-full bg-zinc-950 rounded-full h-3 mb-2 overflow-hidden border border-zinc-800">
                  <div className={`h-full ${usagePercent > 90 ? 'bg-red-500' : usagePercent > 70 ? 'bg-yellow-500' : 'bg-indigo-500'} transition-all`} style={{ width: `${usagePercent}%` }} />
               </div>
               <div className="flex justify-between text-xs text-zinc-500">
                  <span>0 MB</span>
                  <span>Limit: {diskLimitMB} MB</span>
               </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl flex flex-col justify-center">
               <h3 className="text-zinc-400 text-sm font-medium uppercase tracking-wider mb-4 flex items-center gap-2"><Settings className="w-4 h-4" /> Capacity Settings</h3>
               <div className="flex items-center gap-4">
                  <input type="range" min="500" max="10240" step="100" value={diskLimitMB} onChange={e => setDiskLimitMB(Number(e.target.value))} onMouseUp={e => updateLimit(Number((e.target as any).value))} className="w-full accent-indigo-500" />
                  <span className="text-white font-bold whitespace-nowrap bg-zinc-800 px-3 py-1 rounded w-24 text-center">{diskLimitMB} MB</span>
               </div>
               <p className="text-xs text-zinc-500 mt-3 leading-relaxed">
                  Maximum storage allowed before the engine automatically deletes the oldest completed videos to make space for new render jobs.
               </p>
            </div>
         </div>

         <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl overflow-hidden flex-1 flex flex-col">
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
               <h3 className="text-zinc-200 font-medium">Disk Contents</h3>
               <span className="text-xs text-zinc-500 px-2 py-1 bg-zinc-950 rounded-full">{files.length} items</span>
            </div>
            {loading ? (
               <div className="p-8 text-center text-zinc-500 flex-1 flex items-center justify-center">Loading storage info...</div>
            ) : files.length === 0 ? (
               <div className="p-8 text-center text-zinc-500 flex-1 flex items-center justify-center">Disk is empty</div>
            ) : (
               <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-max">
                     <thead>
                        <tr className="text-xs text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
                           <th className="p-4 font-medium">File Name</th>
                           <th className="p-4 font-medium w-32">Size</th>
                           <th className="p-4 font-medium w-48">Date</th>
                           <th className="p-4 font-medium w-48 text-right">Actions</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-zinc-800/50">
                        {files.sort((a,b) => b.mtimeMs - a.mtimeMs).map((f) => (
                           <tr key={f.name} className="hover:bg-zinc-800/30 transition-colors group">
                              <td className="p-4">
                                 <div className="flex items-center gap-3">
                                    {f.isVideo ? (
                                       <div className="w-10 h-10 bg-indigo-500/10 rounded flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500/20"><Play className="w-5 h-5"/></div>
                                    ) : (
                                       <div className="w-10 h-10 bg-zinc-800 rounded flex items-center justify-center text-zinc-500"><HardDrive className="w-5 h-5"/></div>
                                    )}
                                    <span className="text-sm font-medium text-zinc-200 max-w-[200px] md:max-w-xs xl:max-w-md truncate" title={f.name}>{f.name}</span>
                                 </div>
                              </td>
                              <td className="p-4 text-sm text-zinc-400">
                                 {Math.round(f.size/1024/1024 * 100) / 100} MB
                              </td>
                              <td className="p-4 text-sm text-zinc-400">
                                 {new Date(f.mtimeMs).toLocaleString()}
                              </td>
                              <td className="p-4">
                                 <div className="flex items-center justify-end gap-2">
                                    {f.isVideo && (
                                       <>
                                          <button onClick={() => setPreviewTarget(f.name)} className="p-2 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded transition-colors" title="Preview">
                                             <Play className="w-4 h-4" />
                                          </button>
                                          <button onClick={() => uploadToYouTube(f.name)} disabled={uploadingFile === f.name} className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded transition-colors disabled:opacity-50" title="Upload to YouTube">
                                             {uploadingFile === f.name ? <RefreshCcw className="w-4 h-4 animate-spin"/> : <Youtube className="w-4 h-4" />}
                                          </button>
                                          <a href={`/api/uploads/${f.name}`} download={f.name} target="_blank" className="p-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded transition-colors" title="Download">
                                             <Download className="w-4 h-4" />
                                          </a>
                                       </>
                                    )}
                                    <button onClick={() => renameFile(f.name)} className="p-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded transition-colors" title="Rename">
                                       <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => deleteFile(f.name)} className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded transition-colors" title="Delete">
                                       <Trash2 className="w-4 h-4" />
                                    </button>
                                 </div>
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            )}
         </div>
      </div>
   );
}
