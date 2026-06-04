import React, { useState } from 'react';
import { Lock, LogIn, KeyRound } from 'lucide-react';

export function LoginScreen({ onLoginSuccess }: { onLoginSuccess: (token: string) => void }) {
   const [username, setUsername] = useState('');
   const [password, setPassword] = useState('');
   const [mfaCode, setMfaCode] = useState('');
   const [isMfaStep, setIsMfaStep] = useState(false);
   const [error, setError] = useState('');
   const [loading, setLoading] = useState(false);

   const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError('');
      try {
         if (!isMfaStep) {
            const res = await fetch('/api/login', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (res.ok && data.mfaRequired) {
                setIsMfaStep(true);
            } else if (res.ok && data.token) {
                localStorage.setItem('auth_token', data.token);
                onLoginSuccess(data.token);
            } else {
                setError(data.error || 'Login failed');
            }
         } else {
            const res = await fetch('/api/verify-mfa', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ code: mfaCode, username })
            });
            const data = await res.json();
            if (res.ok && data.token) {
                localStorage.setItem('auth_token', data.token);
                onLoginSuccess(data.token);
            } else {
                setError(data.error || 'Verification failed');
            }
         }
      } catch (e: any) {
         setError('Network error');
      } finally {
         setLoading(false);
      }
   };

   return (
      <div className="flex h-screen items-center justify-center bg-black font-sans text-zinc-100">
         <form onSubmit={handleLogin} className="bg-zinc-900 border border-zinc-800 p-8 rounded-xl shadow-2xl max-w-sm w-full space-y-6">
            <div className="flex flex-col items-center">
               <div className="bg-indigo-500/20 p-3 rounded-full mb-4">
                  {isMfaStep ? <KeyRound className="w-8 h-8 text-indigo-400" /> : <Lock className="w-8 h-8 text-indigo-400" />}
               </div>
               <h2 className="text-xl font-bold tracking-tight">{isMfaStep ? 'Two-Factor Auth' : 'Access Trisha Video Engine'}</h2>
               <p className="text-xs text-zinc-500 mt-2 text-center">
                  {isMfaStep 
                     ? 'Please enter the 6-digit code sent to neurographs@gmail.com' 
                     : 'Please enter your credentials to access the remote server rendering tools.'}
               </p>
            </div>
            
            <div className="space-y-4">
               {!isMfaStep ? (
                  <>
                     <div>
                        <label className="text-xs text-zinc-400 font-medium mb-1 block">Username</label>
                        <input type="text" value={username} onChange={e => setUsername(e.target.value)} required 
                               className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-colors" />
                     </div>
                     <div>
                        <label className="text-xs text-zinc-400 font-medium mb-1 block">Password</label>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required 
                               className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-colors" />
                     </div>
                  </>
               ) : (
                  <div>
                     <label className="text-xs text-zinc-400 font-medium mb-1 block">6-Digit Code</label>
                     <input type="text" value={mfaCode} onChange={e => setMfaCode(e.target.value)} required placeholder="000000"
                            className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-center tracking-widest text-lg font-mono focus:outline-none focus:border-indigo-500 transition-colors" />
                     <button type="button" onClick={() => setIsMfaStep(false)} className="text-xs text-indigo-400 mt-3 hover:underline text-center w-full block">Cancel</button>
                  </div>
               )}
            </div>

            {error && <div className="text-xs text-red-500 text-center bg-red-500/10 py-2 rounded">{error}</div>}

            <button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 rounded flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
               {loading ? 'Authenticating...' : (isMfaStep ? <><KeyRound className="w-4 h-4"/> Verify Code</> : <><LogIn className="w-4 h-4"/> Sign In</>)}
            </button>
         </form>
      </div>
   );
}
