import React, { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import { initAuth, googleSignIn } from '../lib/auth';
import type { User } from 'firebase/auth';

export function YouTubeSettings({ 
  token, setToken, autoUploadYT, setAutoUploadYT 
}: { 
  token: string | null, setToken: (t: string|null) => void,
  autoUploadYT: boolean, setAutoUploadYT: (b: boolean) => void 
}) {
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = initAuth(
      (user, t) => {
        setUser(user);
        setToken(t);
      },
      () => {
        setUser(null);
        setToken(null);
      }
    );
    return () => unsubscribe();
  }, [setToken]);

  const handleLogin = async () => {
    try {
      setError(null);
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setToken(res.accessToken);
      }
    } catch (e: any) {
      if(e.code === 'auth/unauthorized-domain') setError('Error: Domain unauthorized in Firebase. Please add this IP to Firebase Console > Authentication > Settings > Authorized domains.'); else setError(e.message || 'Login failed');
    }
  };

  return (
    <div className="bg-zinc-800/50 p-3 rounded border border-zinc-800 space-y-3 mt-4">
       <span className="text-xs font-semibold uppercase text-zinc-500">YouTube Auto-Upload</span>
       {user ? (
          <div className="space-y-3">
             <div className="flex items-center text-xs text-green-400 gap-1"><Check className="w-3 h-3"/> Logged in to YouTube</div>
             <label className="flex items-center gap-2 cursor-pointer text-sm text-zinc-300">
                <input type="checkbox" checked={autoUploadYT} onChange={e => setAutoUploadYT(e.target.checked)} className="rounded bg-zinc-900 border-zinc-700 text-indigo-500" />
                <span>Upload videos automatically</span>
             </label>
          </div>
       ) : (
          <div>
            <p className="text-xs text-zinc-400 mb-2">Sign in to allow auto-uploading rendered videos to YouTube.</p>
            <button className="gsi-material-button w-full flex items-center justify-center bg-white text-zinc-900 rounded py-1.5 hover:bg-zinc-200 transition-colors" onClick={handleLogin}>
              <span className="text-xs font-medium px-2">Sign in with Google</span>
            </button>
            {error && <div className="text-[10px] text-red-400 mt-1 text-center">{error}</div>}
          </div>
       )}
    </div>
  );
}
