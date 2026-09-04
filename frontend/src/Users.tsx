import React, { useEffect, useState, useId } from 'react';
import { fetchUsers, createUser, deleteUser, updateUserInfo, type User } from './api';
import { 
  UserPlus, 
  Trash2, 
  Shield, 
  User as UserIcon, 
  X, 
  Check, 
  Lock, 
  ChevronLeft, 
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useToast } from './ToastContext';
import { ConfirmModal } from './components/Modal';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Users() {
  const { showToast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editPassword, setEditPassword] = useState('');

  // Delete modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);

  const usernameInputId = useId();
  const passwordInputId = useId();
  const navigate = useNavigate();

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await fetchUsers();
      setUsers(data);
    } catch (err) {
      setError('Failed to load users');
      showToast('Failed to load users', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createUser({ username: newUsername, password: newPassword, is_admin: newIsAdmin });
      showToast(`User "${newUsername}" created successfully`, 'success');
      setNewUsername('');
      setNewPassword('');
      setNewIsAdmin(false);
      setShowAddForm(false);
      loadUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to create user');
      showToast(err.message || 'Failed to create user', 'error');
    }
  };

  const promptDeleteUser = (username: string) => {
    setUserToDelete(username);
    setDeleteModalOpen(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      await deleteUser(userToDelete);
      showToast(`User "${userToDelete}" deleted`, 'success');
      loadUsers();
    } catch (err) {
      setError('Failed to delete user');
      showToast('Failed to delete user', 'error');
    } finally {
      setDeleteModalOpen(false);
      setUserToDelete(null);
    }
  };

  const handleUpdatePassword = async (username: string) => {
    if (!editPassword || editPassword.length < 8) {
      showToast('Password must be at least 8 characters long', 'error');
      return;
    }
    try {
      await updateUserInfo(username, { password: editPassword });
      setEditingUser(null);
      setEditPassword('');
      showToast(`Password updated for user "${username}"`, 'success');
    } catch (err: any) {
      setError('Failed to update password');
      showToast(err?.message || 'Failed to update password', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans p-4 md:p-8 transition-colors duration-200">
      <div className="max-w-4xl mx-auto">
        
        {/* Confirm Delete Modal */}
        <ConfirmModal
          isOpen={deleteModalOpen}
          title="Delete User Account?"
          message={`Are you sure you want to delete the user "${userToDelete}"? This user will immediately lose access to Frosty.`}
          confirmText="Delete User"
          cancelText="Cancel"
          variant="danger"
          onConfirm={confirmDeleteUser}
          onCancel={() => {
            setDeleteModalOpen(false);
            setUserToDelete(null);
          }}
        />

        <header className="mb-8 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/settings')}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              aria-label="Return to settings"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">User Management</h1>
              <p className="text-slate-600 dark:text-slate-300 text-sm">Control authorized accounts and admin access</p>
            </div>
          </div>
          <button 
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl shadow-md shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 transition-all font-bold min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            {showAddForm ? <X className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
            <span>{showAddForm ? 'Cancel' : 'Add User'}</span>
          </button>
        </header>

        {error && (
          <div 
            className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 px-4 py-3 rounded-2xl mb-6 flex items-center gap-3"
            role="alert"
          >
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
            <p className="text-sm font-semibold">{error}</p>
          </div>
        )}

        {showAddForm && (
          <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 mb-8 transition-all animate-in slide-in-from-top-4 duration-300">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-slate-900 dark:text-white">
              <UserPlus className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Create New User
            </h2>
            <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <label htmlFor={usernameInputId} className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider">
                  Username
                </label>
                <input
                  id={usernameInputId}
                  type="text"
                  required
                  autoComplete="username"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white text-base"
                  placeholder="e.g. jane_doe"
                />
              </div>
              <div>
                <label htmlFor={passwordInputId} className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider">
                  Password (min 8 chars)
                </label>
                <input
                  id={passwordInputId}
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white text-base"
                  placeholder="••••••••"
                />
              </div>
              <div className="flex items-end pb-1">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={newIsAdmin}
                  onClick={() => setNewIsAdmin(!newIsAdmin)}
                  className="flex items-center gap-3 cursor-pointer group p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors w-full min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  <div 
                    className={cn(
                      "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all",
                      newIsAdmin ? "bg-indigo-600 border-indigo-600 text-white" : "bg-transparent border-slate-400 dark:border-slate-500"
                    )}
                  >
                    {newIsAdmin && <Check className="w-4 h-4" />}
                  </div>
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">Admin Privileges</span>
                </button>
              </div>
              <div className="md:col-span-2 lg:col-span-3 flex justify-end gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-6 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 text-white px-8 py-2.5 rounded-xl font-bold hover:bg-indigo-700 shadow-md shadow-indigo-200 dark:shadow-none transition-all min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-4">
              <RefreshCw className="w-10 h-10 animate-spin text-indigo-600 dark:text-indigo-400" />
              <p className="font-semibold text-base">Fetching accounts...</p>
            </div>
          ) : users.map((user) => (
            <div key={user.username} className="bg-white dark:bg-slate-800 p-5 md:p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0",
                  user.is_admin ? "bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400" : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400"
                )}>
                  {user.is_admin ? <Shield className="w-6 h-6" /> : <UserIcon className="w-6 h-6" />}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    {user.username}
                    {user.is_admin && (
                      <span className="text-[10px] bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 px-2.5 py-0.5 rounded-full uppercase tracking-wider font-extrabold border border-indigo-200 dark:border-indigo-800">
                        Admin
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold mt-0.5">
                    {user.is_admin ? 'Administrator Account' : 'Standard User'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {editingUser === user.username ? (
                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleUpdatePassword(user.username);
                    }} 
                    className="flex items-center gap-2 animate-in fade-in zoom-in-95 duration-200 w-full md:w-auto"
                  >
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm w-full md:w-48 text-slate-900 dark:text-white"
                      placeholder="New password"
                      autoFocus
                      aria-label={`New password for ${user.username}`}
                    />
                    <button 
                      type="submit" 
                      className="p-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                      aria-label="Save password"
                    >
                      <Check className="w-5 h-5" />
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setEditingUser(null)} 
                      className="p-2.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                      aria-label="Cancel password change"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </form>
                ) : (
                  <>
                    <button 
                      onClick={() => {
                        setEditingUser(user.username);
                        setEditPassword('');
                      }}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-sm font-bold min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                    >
                      <Lock className="w-4 h-4" />
                      <span>Change Password</span>
                    </button>
                    <button 
                      onClick={() => promptDeleteUser(user.username)}
                      disabled={user.username === 'admin'}
                      className="p-2.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors disabled:opacity-20 disabled:cursor-not-allowed min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                      aria-label={`Delete user ${user.username}`}
                      title={user.username === 'admin' ? "Cannot delete default admin account" : "Delete user account"}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
