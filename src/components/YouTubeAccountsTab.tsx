import React, { useState, useEffect } from 'react';
import { Youtube, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { googleSignIn } from '../lib/auth';

export interface YTAccount {
  id: string;
  name: string;
  email: string;
  token: string;
}

interface YouTubeAccountsTabProps {
  activeToken: string | null;
  setActiveToken: (token: string | null) => void;
  autoUploadYT: boolean;
  setAutoUploadYT: (b: boolean) => void;
}

export function YouTubeAccountsTab({ activeToken, setActiveToken, autoUploadYT, setAutoUploadYT }: YouTubeAccountsTabProps) {
  const [accounts, setAccounts] = useState<YTAccount[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('youtubeAccounts');
      if (stored) {
        const parsed = JSON.parse(stored);
        setAccounts(parsed);
        if (parsed.length > 0 && !activeToken) {
            setActiveToken(parsed[0].token);
        }
      }
    } catch (e) {
      console.error("Failed to parse stored youtube accounts", e);
    }
  }, [activeToken, setActiveToken]);

  const saveAccounts = (newAccounts: YTAccount[]) => {
    setAccounts(newAccounts);
    localStorage.setItem('youtubeAccounts', JSON.stringify(newAccounts));
  };

  const handleLogin = async () => {
    try {
      setError(null);
      const res = await googleSignIn();
      if (res) {
        const newAccount: YTAccount = {
          id: res.user.uid,
          name: res.user.displayName || 'Unknown',
          email: res.user.email || 'Unknown',
          token: res.accessToken,
        };
        
        let updated = [...accounts];
        const existingIdx = updated.findIndex(a => a.id === newAccount.id);
        if (existingIdx >= 0) {
          updated[existingIdx] = newAccount;
        } else {
          updated.push(newAccount);
        }
        
        saveAccounts(updated);
        // Automatically make it active if none is selected
        if (!activeToken) {
          setActiveToken(newAccount.token);
        }
      }
    } catch (e: any) {
      if(e.code === 'auth/unauthorized-domain') {
          setError('Error: Domain unauthorized in Firebase. Please add this IP to Firebase Console > Authentication > Settings > Authorized domains.');
      } else {
          setError(e.message || 'Login failed');
      }
    }
  };

  const logoutAccount = (accountId: string) => {
    const accountToRemove = accounts.find(a => a.id === accountId);
    const updated = accounts.filter(a => a.id !== accountId);
    saveAccounts(updated);
    if (activeToken && accountToRemove && activeToken === accountToRemove.token) {
      setActiveToken(updated.length > 0 ? updated[0].token : null);
    }
  };

  return (
    <div className="absolute inset-0 bg-[#0a0a0c] z-40 overflow-y-auto w-full flex justify-center">
      <div className="w-full max-w-4xl p-8 pt-16">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
             <Youtube className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-3">
              YouTube Accounts
            </h1>
            <p className="text-zinc-400 mt-1">Manage multiple YouTube accounts for automated uploads</p>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-8 shadow-xl">
           <div className="flexjustify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-zinc-200">Connected Accounts</h2>
           </div>

           {error && <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded mb-4">{error}</div>}

           <div className="space-y-4">
              {accounts.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-zinc-800 rounded-lg">
                   <p className="text-zinc-500 mb-4">No YouTube accounts connected.</p>
                   <button onClick={handleLogin} className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-medium transition-colors">
                     <Plus className="w-4 h-4" />
                     Add YouTube Account
                   </button>
                </div>
              ) : (
                <div className="space-y-3">
                    {accounts.map(acc => {
                       const isActive = activeToken === acc.token;
                       return (
                         <div key={acc.id} className={`flex items-center justify-between p-4 rounded-lg border ${isActive ? 'bg-red-500/5 border-red-500/30' : 'bg-zinc-800/50 border-zinc-700 hover:border-zinc-600'} transition-colors`}>
                           <div className="flex items-center gap-4 cursor-pointer flex-1" onClick={() => setActiveToken(acc.token)}>
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isActive ? 'border-red-500' : 'border-zinc-500'}`}>
                                 {isActive && <div className="w-2.5 h-2.5 rounded-full bg-red-500" />}
                              </div>
                              <div>
                                 <div className="font-medium text-zinc-200">{acc.name}</div>
                                 <div className="text-xs text-zinc-500">{acc.email}</div>
                              </div>
                              {isActive && <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-medium bg-red-500/20 text-red-400">Active</span>}
                           </div>
                           <button 
                             onClick={(e) => { e.stopPropagation(); logoutAccount(acc.id); }} 
                             className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-700 rounded transition-colors"
                             title="Remove Account"
                           >
                             <Trash2 className="w-4 h-4" />
                           </button>
                         </div>
                       );
                    })}
                    
                    <div className="pt-4 mt-2 border-t border-zinc-800">
                      <button onClick={handleLogin} className="inline-flex items-center gap-2 text-red-400 hover:text-red-300 transition-colors text-sm font-medium">
                         <Plus className="w-4 h-4" />
                         Add Another Account
                      </button>
                    </div>
                </div>
              )}
           </div>
        </div>
        
        {accounts.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl space-y-4">
             <h2 className="text-lg font-semibold text-zinc-200">Upload Preferences</h2>
             
             <label className="flex items-center gap-3 cursor-pointer p-4 border border-zinc-800 rounded-lg hover:border-zinc-700 transition-colors">
                <input 
                  type="checkbox" 
                  checked={autoUploadYT} 
                  onChange={e => setAutoUploadYT(e.target.checked)} 
                  className="w-5 h-5 rounded bg-zinc-900 border-zinc-700 text-red-500 focus:ring-red-500 focus:ring-offset-zinc-900" 
                />
                <div>
                   <div className="font-medium text-zinc-200">Auto-upload videos</div>
                   <div className="text-xs text-zinc-500">Automatically upload rendered videos to the active YouTube account.</div>
                </div>
             </label>
             
          </div>
        )}

      </div>
    </div>
  );
}
