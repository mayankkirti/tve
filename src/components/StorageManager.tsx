import React, { useState, useEffect } from 'react';
import { HardDrive, Trash2, Edit2, Play, Download, Settings, RefreshCcw, Youtube, Grid, List, Link, FileText, Image as ImageIcon, Music, File, X, Copy } from 'lucide-react';
import { formatTime } from '../lib/utils';
import { googleSignIn } from '../lib/auth';

export function StorageManager() {
   const [files, setFiles] = useState<any[]>([]);
   const [freeBytes, setFreeBytes] = useState(0);
   const [totalBytes, setTotalBytes] = useState(0);
   const [diskLimitMB, setDiskLimitMB] = useState(2048);
   const [loading, setLoading] = useState(true);
   const [previewTarget, setPreviewTarget] = useState<string | null>(null);
   const [uploadingFile, setUploadingFile] = useState<string | null>(null);
   const [viewMode, setViewMode] = useState<'details' | 'icons'>('details');
   const [copiedLink, setCopiedLink] = useState<string | null>(null);

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

   const copyLink = (name: string) => {
      const url = `${window.location.origin}/api/uploads/${name}`;
      navigator.clipboard.writeText(url);
      setCopiedLink(name);
      setTimeout(() => setCopiedLink(null), 2000);
   };

   const uploadToYouTube = async (filename: string) => {
       try {
           let token = null;
           const stored = localStorage.getItem('youtubeAccounts');
           if (stored) {
             const parsed = JSON.parse(stored);
             if (parsed && parsed.length > 0) token = parsed[0].token;
           }
           if (!token) {
               const res = await googleSignIn();
               if (res) {
                   token = res.accessToken;
                   localStorage.setItem('youtubeAccounts', JSON.stringify([{
                       id: res.user.uid,
                       name: res.user.displayName || 'Unknown',
                       email: res.user.email || 'Unknown',
                       token: res.accessToken,
                   }]));
               } else return;
           }
           
           setUploadingFile(filename);
           let res = await fetch('/api/disk/youtube', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ filename, title: filename, description: 'Uploaded via Storage Manager', token })
           });
           
           if (res.status === 401 || res.status === 403) {
               try {
                   const signRes = await googleSignIn();
                   if (signRes) {
                       token = signRes.accessToken;
                       localStorage.setItem('youtubeAccounts', JSON.stringify([{
                           id: signRes.user.uid,
                           name: signRes.user.displayName || 'Unknown',
                           email: signRes.user.email || 'Unknown',
                           token: signRes.accessToken,
                       }]));
                       res = await fetch('/api/disk/youtube', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ filename, title: filename, description: 'Uploaded via Storage Manager', token })
                       });
                   } else {
                       return;
                   }
               } catch (e: any) {
                   if (e?.message?.includes("popup")) {
                       alert("Popup blocked. Please open the app in a new tab to sign in to YouTube.");
                   } else {
                       alert("Authentication failed: " + e.message);
                   }
                   return;
               }
           }

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

   const getFileIcon = (filename: string, isVideo: boolean) => {
      if (isVideo || filename.endsWith('.mp4') || filename.endsWith('.webm')) return <Play className="w-8 h-8"/>;
      if (filename.endsWith('.jpg') || filename.endsWith('.png') || filename.endsWith('.gif') || filename.endsWith('.jpeg')) return <ImageIcon className="w-8 h-8"/>;
      if (filename.endsWith('.mp3') || filename.endsWith('.wav') || filename.endsWith('.ogg')) return <Music className="w-8 h-8"/>;
      if (filename.endsWith('.txt') || filename.endsWith('.json')) return <FileText className="w-8 h-8"/>;
      return <File className="w-8 h-8"/>;
   };

   const isImage = (f:string) => f.endsWith('.jpg') || f.endsWith('.png') || f.endsWith('.gif') || f.endsWith('.jpeg');
   const isAudio = (f:string) => f.endsWith('.mp3') || f.endsWith('.wav') || f.endsWith('.ogg');
   const isVideoFile = (f:string) => f.endsWith('.mp4') || f.endsWith('.webm') || f.endsWith('.mkv');

   return (
      <div className="fixed inset-0 z-50 flex flex-col bg-[#1E1E1E] text-white overflow-hidden">
         <div className="h-10 bg-[#303030] border-b border-[#121212] flex items-center px-4 justify-between select-none shadow-md shrink-0">
            <div className="flex items-center gap-4">
               <button onClick={() => {
                   const closeEvent = new CustomEvent('close-storage');
                   window.dispatchEvent(closeEvent);
               }} className="p-1 hover:bg-[#E95420] hover:text-white text-[#AAAAAA] rounded transition-colors" title="Close">
                  <X className="w-5 h-5" />
               </button>
               <span className="font-bold text-sm text-[#DFDFDF]">Storage Manager</span>
            </div>
            <div className="flex items-center space-x-4 text-xs font-medium text-[#B0B0B0]">
               <div className="flex items-center gap-2">
                  <span className="w-32 bg-[#121212] rounded-full h-2 overflow-hidden shadow-inner">
                     <div className={`h-full ${usagePercent > 90 ? 'bg-[#E95420]' : 'bg-[#E95420] opacity-80'}`} style={{ width: `${usagePercent}%` }} />
                  </span>
                  <span>{Math.round(usedByAppBytes/1024/1024)} MB / {diskLimitMB} MB</span>
               </div>
               <button onClick={loadStorage} className="p-1 hover:text-white hover:bg-[#404040] rounded transition-colors" title="Refresh">
                  <RefreshCcw className="w-4 h-4" />
               </button>
            </div>
         </div>

         <div className="flex flex-1 overflow-hidden">
            <div className="w-56 bg-[#252525] border-r border-[#151515] flex flex-col p-2 space-y-1 shrink-0">
               <div className="px-3 py-2 text-xs font-semibold text-[#808080] uppercase tracking-wider mt-2 mb-1">Locations</div>
               <button className="flex items-center gap-3 px-3 py-2 bg-[#E95420] text-white rounded-md transition-colors text-sm font-medium">
                  <HardDrive className="w-4 h-4" /> App Storage
               </button>
               
               <div className="mt-auto p-4 border-t border-[#1a1a1a]">
                  <div className="flex items-center gap-2 text-xs text-[#808080] mb-2 font-medium">
                     <Settings className="w-4 h-4"/> Settings
                  </div>
                  <div className="text-xs text-[#A0A0A0] flex flex-col gap-2">
                     <label className="flex flex-col gap-1">
                        Disk Limit (MB)
                        <div className="flex items-center gap-2">
                           <input type="number" min="500" value={diskLimitMB} onChange={e => setDiskLimitMB(Number(e.target.value))} className="w-full bg-[#121212] border border-[#303030] rounded px-2 py-1 text-white focus:outline-none focus:border-[#E95420]" />
                           <button onClick={() => updateLimit(diskLimitMB)} className="px-2 py-1 bg-[#404040] hover:bg-[#505050] rounded transition-colors text-[#DFDFDF]" title="Save Limit">Save</button>
                        </div>
                     </label>
                  </div>
               </div>
            </div>

            <div className="flex-1 flex flex-col bg-[#1E1E1E] overflow-hidden">
               <div className="flex items-center justify-between p-3 border-b border-[#2C2C2C] bg-[#222222] shrink-0">
                  <div className="flex items-center gap-2 text-sm text-[#CCCCCC]">
                     <span className="font-semibold text-white">/</span>
                     <span>App Storage</span>
                     <span className="text-[#888888]">({files.length} items)</span>
                  </div>
                  <div className="flex items-center bg-[#151515] rounded-md p-1 border border-[#303030]">
                     <button onClick={() => setViewMode('icons')} className={`p-1.5 rounded-sm ${viewMode === 'icons' ? 'bg-[#3A3A3A] text-white shadow' : 'text-[#888888] hover:text-[#CCCCCC]'} transition-all`} title="Icon View">
                        <Grid className="w-4 h-4" />
                     </button>
                     <button onClick={() => setViewMode('details')} className={`p-1.5 rounded-sm ${viewMode === 'details' ? 'bg-[#3A3A3A] text-white shadow' : 'text-[#888888] hover:text-[#CCCCCC]'} transition-all`} title="List View">
                        <List className="w-4 h-4" />
                     </button>
                  </div>
               </div>

               <div className="flex-1 overflow-y-auto p-4 relative">
                  {loading ? (
                     <div className="h-full flex items-center justify-center text-[#888888]">Loading files...</div>
                  ) : files.length === 0 ? (
                     <div className="h-full flex items-center justify-center text-[#888888]">Folder is empty</div>
                  ) : viewMode === 'icons' ? (
                     <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {files.sort((a,b) => b.mtimeMs - a.mtimeMs).map(f => (
                           <div key={f.name} className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-[#303030] group cursor-pointer border border-transparent hover:border-[#404040] relative">
                              <div className="w-16 h-16 bg-[#2A2A2A] rounded-xl shadow border border-[#353535] flex items-center justify-center text-[#E95420] group-hover:scale-105 transition-transform overflow-hidden relative">
                                  {isImage(f.name) ? <img src={`/api/uploads/${f.name}`} className="w-full h-full object-cover" /> : getFileIcon(f.name, f.isVideo)}
                              </div>
                              <span className="text-xs text-center break-words w-full truncate text-[#DDDDDD] group-hover:text-white" title={f.name}>{f.name}</span>
                              <div className="absolute top-1 right-1 flex-col gap-1 hidden group-hover:flex bg-[#1E1E1E]/90 p-1 rounded-md shadow-lg border border-[#333333] z-10">
                                 <button onClick={() => setPreviewTarget(f.name)} className="p-1.5 hover:bg-[#E95420] hover:text-white rounded text-[#AAAAAA]" title="Preview"><Play className="w-3 h-3"/></button>
                                 {(f.isVideo || isVideoFile(f.name)) && <button onClick={() => uploadToYouTube(f.name)} disabled={uploadingFile === f.name} className="p-1.5 hover:bg-red-500 hover:text-white rounded text-[#AAAAAA] disabled:opacity-50" title="Upload to YT">{uploadingFile === f.name ? <RefreshCcw className="w-3 h-3 animate-spin"/> : <Youtube className="w-3 h-3"/>}</button>}
                                 <a href={`/api/uploads/${f.name}`} download={f.name} target="_blank" className="p-1.5 hover:bg-[#E95420] hover:text-white rounded text-[#AAAAAA] inline-block" title="Download"><Download className="w-3 h-3"/></a>
                                 <button onClick={() => copyLink(f.name)} className="p-1.5 hover:bg-[#E95420] hover:text-white rounded text-[#AAAAAA]" title="Copy Link">{copiedLink === f.name ? <Copy className="w-3 h-3 text-green-400" /> : <Link className="w-3 h-3" />}</button>
                                 <button onClick={() => renameFile(f.name)} className="p-1.5 hover:bg-[#E95420] hover:text-white rounded text-[#AAAAAA]" title="Rename"><Edit2 className="w-3 h-3"/></button>
                                 <button onClick={() => deleteFile(f.name)} className="p-1.5 hover:bg-red-500 hover:text-white rounded text-[#AAAAAA]" title="Delete"><Trash2 className="w-3 h-3"/></button>
                              </div>
                           </div>
                        ))}
                     </div>
                  ) : (
                     <table className="w-full text-left border-collapse min-w-max">
                        <thead>
                           <tr className="text-xs text-[#808080] border-b border-[#303030]">
                              <th className="font-semibold p-2 pb-3 sticky top-0 bg-[#1E1E1E]">Name</th>
                              <th className="font-semibold p-2 pb-3 w-32 sticky top-0 bg-[#1E1E1E]">Size</th>
                              <th className="font-semibold p-2 pb-3 w-48 sticky top-0 bg-[#1E1E1E]">Modified</th>
                              <th className="font-semibold p-2 pb-3 text-right sticky top-0 bg-[#1E1E1E]">Actions</th>
                           </tr>
                        </thead>
                        <tbody>
                           {files.sort((a,b) => b.mtimeMs - a.mtimeMs).map(f => (
                              <tr key={f.name} className="border-b border-[#252525] hover:bg-[#2A2A2A] transition-colors group">
                                 <td className="p-2">
                                    <div className="flex items-center gap-3">
                                       <div className="text-[#E95420] w-6 h-6 flex items-center justify-center shrink-0">
                                          {getFileIcon(f.name, f.isVideo)}
                                       </div>
                                       <span className="text-sm font-medium text-[#EAEAEA] truncate max-w-[200px] sm:max-w-xs">{f.name}</span>
                                    </div>
                                 </td>
                                 <td className="p-2 text-sm text-[#AAAAAA] whitespace-nowrap">{(f.size / 1048576).toFixed(2)} MB</td>
                                 <td className="p-2 text-sm text-[#AAAAAA] whitespace-nowrap">{new Date(f.mtimeMs).toLocaleString()}</td>
                                 <td className="p-2">
                                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                       <button onClick={() => setPreviewTarget(f.name)} className="p-1.5 hover:bg-[#E95420] hover:text-white rounded text-[#AAAAAA]" title="Preview"><Play className="w-4 h-4"/></button>
                                       {(f.isVideo || isVideoFile(f.name)) && <button onClick={() => uploadToYouTube(f.name)} disabled={uploadingFile === f.name} className="p-1.5 hover:bg-red-500 hover:text-white rounded text-[#AAAAAA] disabled:opacity-50" title="Upload to YT">{uploadingFile === f.name ? <RefreshCcw className="w-4 h-4 animate-spin"/> : <Youtube className="w-4 h-4"/>}</button>}
                                       <a href={`/api/uploads/${f.name}`} download={f.name} target="_blank" className="p-1.5 hover:bg-[#E95420] hover:text-white rounded text-[#AAAAAA] block" title="Download"><Download className="w-4 h-4"/></a>
                                       <button onClick={() => copyLink(f.name)} className="p-1.5 hover:bg-[#E95420] hover:text-white rounded text-[#AAAAAA]" title="Copy Link">{copiedLink === f.name ? <Copy className="w-4 h-4 text-green-400" /> : <Link className="w-4 h-4" />}</button>
                                       <button onClick={() => renameFile(f.name)} className="p-1.5 hover:bg-[#E95420] hover:text-white rounded text-[#AAAAAA]" title="Rename"><Edit2 className="w-4 h-4"/></button>
                                       <button onClick={() => deleteFile(f.name)} className="p-1.5 hover:bg-red-500 hover:text-white rounded text-[#AAAAAA]" title="Delete"><Trash2 className="w-4 h-4"/></button>
                                    </div>
                                 </td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  )}
               </div>
            </div>
         </div>

         {previewTarget && (
            <div className="absolute inset-0 bg-black/90 z-[60] flex flex-col overflow-hidden backdrop-blur-sm">
               <div className="h-14 bg-[#1E1E1E]/80 border-b border-[#303030] flex items-center px-4 justify-between shrink-0">
                  <div className="flex items-center gap-3">
                     <span className="text-white font-medium truncate max-w-lg">{previewTarget}</span>
                  </div>
                  <button onClick={() => setPreviewTarget(null)} className="p-2 hover:bg-[#E95420] hover:text-white text-[#AAAAAA] rounded transition-colors"><X className="w-5 h-5"/></button>
               </div>
               <div className="flex-1 overflow-hidden p-8 flex items-center justify-center relative">
                  {(isVideoFile(previewTarget) || files.find(f => f.name === previewTarget)?.isVideo) ? (
                     <video src={`/api/uploads/${previewTarget}`} controls autoPlay className="max-w-full max-h-full rounded-lg shadow-2xl bg-black" />
                  ) : isImage(previewTarget) ? (
                     <img src={`/api/uploads/${previewTarget}`} className="max-w-full max-h-full rounded-lg shadow-2xl object-contain" />
                  ) : isAudio(previewTarget) ? (
                     <audio src={`/api/uploads/${previewTarget}`} controls autoPlay className="w-96 shadow-2xl" />
                  ) : (
                     <div className="text-center text-[#AAAAAA] flex flex-col items-center">
                        <FileText className="w-24 h-24 mb-4 text-[#E95420] opacity-80" />
                        <p className="text-xl">Preview not available for this file type</p>
                        <a href={`/api/uploads/${previewTarget}`} target="_blank" className="mt-4 px-6 py-2 bg-[#E95420] hover:bg-[#D54A1B] text-white rounded font-medium shadow">Download File</a>
                     </div>
                  )}
               </div>
            </div>
         )}
      </div>
   );
}

