import React, { useState } from 'react';
import { Shield, KeyRound, CheckCircle2 } from 'lucide-react';

export function SecuritySettings() {
   const [oldPassword, setOldPassword] = useState('');
   const [newPassword, setNewPassword] = useState('');
   const [confirmPassword, setConfirmPassword] = useState('');
   const [error, setError] = useState('');
   const [success, setSuccess] = useState('');
   const [loading, setLoading] = useState(false);

   const handleChangePassword = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setSuccess('');
      
      if (newPassword !== confirmPassword) {
         setError("New passwords do not match.");
         return;
      }

      if (newPassword.length < 5) {
         setError("Password must be at least 5 characters long.");
         return;
      }

      setLoading(true);
      try {
         const res = await fetch('/api/settings/password', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ oldPassword, newPassword })
         });
         const data = await res.json();
         
         if (res.ok) {
             setSuccess("Password updated successfully.");
             setOldPassword('');
             setNewPassword('');
             setConfirmPassword('');
         } else {
             setError(data.error || 'Failed to update password');
         }
      } catch (e: any) {
         setError('Network error');
      } finally {
         setLoading(false);
      }
   };

   return (
      <div className="flex-1 flex flex-col p-8 overflow-y-auto max-w-5xl mx-auto w-full">
         <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-3"><Shield className="text-indigo-400" /> Security Settings</h1>
         </div>

         <div className="max-w-md bg-zinc-900 border border-zinc-800 rounded-xl p-8 shadow-xl">
             <div className="flex items-center gap-3 mb-6 border-b border-zinc-800 pb-4">
                 <div className="p-2 bg-indigo-500/10 rounded-lg">
                     <KeyRound className="w-5 h-5 text-indigo-400" />
                 </div>
                 <div>
                     <h3 className="font-semibold text-zinc-200">Change Password</h3>
                     <p className="text-xs text-zinc-500">Update the password used to access TVE and TVE Remote Services.</p>
                 </div>
             </div>

             <form onSubmit={handleChangePassword} className="space-y-4">
                 <div>
                    <label className="text-xs text-zinc-400 font-medium mb-1 block">Current Password</label>
                    <input type="password" value={oldPassword} onChange={e => setOldPassword(e.target.value)} required 
                           className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-colors" />
                 </div>
                 
                 <div>
                    <label className="text-xs text-zinc-400 font-medium mb-1 block">New Password</label>
                    <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required 
                           className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-colors" />
                 </div>
                 
                 <div>
                    <label className="text-xs text-zinc-400 font-medium mb-1 block">Confirm New Password</label>
                    <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required 
                           className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-colors" />
                 </div>

                 {error && <div className="text-xs text-red-500 text-center bg-red-500/10 py-2 rounded">{error}</div>}
                 {success && <div className="text-xs text-green-500 flex items-center justify-center gap-1 bg-green-500/10 py-2 rounded"><CheckCircle2 className="w-4 h-4"/> {success}</div>}

                 <button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 rounded mt-4 transition-colors disabled:opacity-50">
                    {loading ? 'Updating...' : 'Update Password'}
                 </button>
             </form>
         </div>
      </div>
   );
}
