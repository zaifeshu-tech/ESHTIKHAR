import React, { useState } from 'react';
import {
  CheckCircle2,
  Database,
  Download,
  Edit2,
  KeyRound,
  Plus,
  RotateCcw,
  Shield,
  Truck,
  UserPlus,
  X,
} from 'lucide-react';
import {
  ALL_PERMISSIONS,
  type AuditLogRecord,
  type ConsumerEntryRecord,
  type DeliveryManRecord,
  type PermissionKey,
  type UserPermissionRecord,
  type UserRecord,
} from '../utils/deduplication';
import { generateSQLDump, type AgencySettings, type DatabaseSchema } from '../store/database';

interface DeliveryMenViewProps {
  deliveryMen: DeliveryManRecord[];
  entries: ConsumerEntryRecord[];
  todayIST: string;
  onAddDeliveryMan: (name: string) => { ok: boolean; error?: string };
  onEditDeliveryMan: (id: string, name: string) => void;
  onToggleDeliveryManActive: (id: string) => void;
}

export const DeliveryMenView: React.FC<DeliveryMenViewProps> = ({
  deliveryMen,
  entries,
  todayIST,
  onAddDeliveryMan,
  onEditDeliveryMan,
  onToggleDeliveryManActive,
}) => {
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = newName.trim();
    if (!trimmed) {
      setError('Please enter the Delivery Man name.');
      return;
    }
    const res = onAddDeliveryMan(trimmed);
    if (!res.ok) {
      setError(res.error || 'Could not add Delivery Man.');
      return;
    }
    setNewName('');
  };

  const handleSaveEdit = (id: string) => {
    const trimmed = editingName.trim();
    if (!trimmed) return;
    onEditDeliveryMan(id, trimmed);
    setEditingId(null);
  };

  return (
    <div className="space-y-6">
      {/* Add Delivery Man Form */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
        <div className="flex items-center gap-2.5 mb-3">
          <Truck className="w-5 h-5 text-slate-800" />
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Delivery Men Management</h1>
        </div>
        <p className="text-xs sm:text-sm text-slate-600 mb-4">
          Add Delivery Men once so their names appear automatically in the New Entry dropdown. Deactivating a Delivery Man hides him from new entries while preserving all historical records under his original name.
        </p>

        {error && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-800"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label htmlFor="new-dm-name" className="sr-only">
              Delivery Man Name
            </label>
            <input
              id="new-dm-name"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Enter Delivery Man Name (e.g. Raksharam, Asad, Suresh, Imran)"
              className="w-full min-h-[48px] px-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
          <button
            type="submit"
            className="min-h-[48px] px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold flex items-center justify-center gap-2 shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span className="whitespace-nowrap">Add Delivery Man</span>
          </button>
        </form>
      </div>

      {/* Delivery Men List */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-900">Registered Delivery Men</h2>
          <span className="text-xs font-mono text-slate-500">
            {deliveryMen.filter((d) => d.active).length} active / {deliveryMen.length} total
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 text-xs">
                <th className="py-3 pr-3 font-medium">Delivery Man Name</th>
                <th className="py-3 px-3 font-medium">Status</th>
                <th className="py-3 px-3 font-medium text-right">Today’s Entries</th>
                <th className="py-3 px-3 font-medium text-right">Total Historical Entries</th>
                <th className="py-3 px-3 font-medium">Updated (IST)</th>
                <th className="py-3 pl-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {deliveryMen.map((dm) => {
                const totalCount = entries.filter((e) => e.delivery_man_id === dm.id).length;
                const todayCount = entries.filter(
                  (e) => e.delivery_man_id === dm.id && e.entry_date_ist === todayIST
                ).length;
                const isEditing = editingId === dm.id;

                return (
                  <tr key={dm.id} className="hover:bg-slate-50">
                    <td className="py-3 pr-3 font-bold text-slate-900">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            aria-label="Edit Delivery Man Name"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="min-h-[36px] px-3 py-1 text-sm border border-slate-300 rounded-lg"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(dm.id)}
                            className="min-h-[36px] px-3 py-1 rounded-lg bg-slate-900 text-white text-xs font-semibold cursor-pointer"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="min-h-[36px] px-2.5 py-1 rounded-lg border border-slate-300 text-xs text-slate-600 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        dm.name
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`text-xs font-semibold ${
                          dm.active ? 'text-emerald-700' : 'text-slate-400'
                        }`}
                      >
                        {dm.active ? 'Active (In Dropdown)' : 'Deactivated (History Preserved)'}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-right tabular-nums">{todayCount}</td>
                    <td className="py-3 px-3 font-mono font-bold text-right tabular-nums">
                      {totalCount}
                    </td>
                    <td className="py-3 px-3 font-mono text-xs text-slate-500 whitespace-nowrap">
                      {dm.updated_at}
                    </td>
                    <td className="py-3 pl-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(dm.id);
                            setEditingName(dm.name);
                          }}
                          className="min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleDeliveryManActive(dm.id)}
                          className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                            dm.active
                              ? 'border border-amber-300 text-amber-800 hover:bg-amber-50'
                              : 'bg-emerald-600 text-white hover:bg-emerald-700'
                          }`}
                        >
                          {dm.active ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

interface StaffManagementViewProps {
  users: UserRecord[];
  userPermissions: UserPermissionRecord[];
  onAddStaff: (params: {
    name: string;
    username: string;
    password: string;
    permissions: PermissionKey[];
  }) => { ok: boolean; error?: string };
  onUpdateStaffUser: (id: string, name: string, username: string) => void;
  onToggleStaffActive: (id: string) => void;
  onResetStaffPassword: (id: string, newPassword: string) => void;
  onToggleStaffPermission: (userId: string, permission: PermissionKey) => void;
}

export const StaffManagementView: React.FC<StaffManagementViewProps> = ({
  users,
  userPermissions,
  onAddStaff,
  onUpdateStaffUser,
  onToggleStaffActive,
  onResetStaffPassword,
  onToggleStaffPermission,
}) => {
  const adminUser = users.find((u) => u.role === 'ADMIN') || null;
  const staffUsers = users.filter((u) => u.role === 'STAFF');

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [selectedPerms, setSelectedPerms] = useState<PermissionKey[]>([
    'new_entry',
    'customer_register',
    'view_records',
    'search_consumer',
    'daily_duplication',
  ]);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Reset Password Modal
  const [resetUser, setResetUser] = useState<UserRecord | null>(null);
  const [newPasswordVal, setNewPasswordVal] = useState('');

  // Edit Staff Modal
  const [editingStaff, setEditingStaff] = useState<UserRecord | null>(null);
  const [editStaffName, setEditStaffName] = useState('');
  const [editStaffUsername, setEditStaffUsername] = useState('');

  const handleToggleNewStaffPerm = (key: PermissionKey) => {
    setSelectedPerms((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleCreateStaff = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!name.trim() || !username.trim() || !password) {
      setFormError('Name, Username, and Password are required.');
      return;
    }

    const res = onAddStaff({
      name: name.trim(),
      username: username.trim().toLowerCase(),
      password,
      permissions: selectedPerms,
    });

    if (!res.ok) {
      setFormError(res.error || 'Failed to create staff user.');
      return;
    }

    setFormSuccess(`Staff account "${username.trim().toLowerCase()}" created successfully.`);
    setName('');
    setUsername('');
    setPassword('');
  };

  const isPermEnabled = (userId: string, key: PermissionKey): boolean => {
    const rec = userPermissions.find((p) => p.user_id === userId && p.permission === key);
    return rec ? rec.enabled : false;
  };

  return (
    <div className="space-y-6">
      {/* Primary Admin Account Card (Eshtikhar) */}
      {adminUser && (
        <div className="bg-slate-900 text-white rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="text-xs font-mono text-amber-400 font-bold">
              MASTER ADMINISTRATOR ACCOUNT
            </div>
            <h2 className="text-lg sm:text-xl font-bold mt-1">
              Admin Name: {adminUser.name}
            </h2>
            <div className="text-xs text-slate-300 font-mono mt-1">
              Admin ID (Username): <strong className="text-white">{adminUser.username}</strong> · Default Password: <strong className="text-white">eshtikhar123</strong> · Full Access Enabled
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setEditingStaff(adminUser);
                setEditStaffName(adminUser.name);
                setEditStaffUsername(adminUser.username);
              }}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5 text-amber-400" />
              <span>Edit Admin Name / ID</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setResetUser(adminUser);
                setNewPasswordVal('');
              }}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Change Admin Password</span>
            </button>
          </div>
        </div>
      )}

      {/* Add New Staff Form */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <UserPlus className="w-5 h-5 text-slate-800" />
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            Staff Accounts & Access Permissions
          </h1>
        </div>
        <p className="text-xs sm:text-sm text-slate-600">
          Create staff accounts, reset passwords, activate/deactivate staff access, and toggle individual permissions ON/OFF in real time.
        </p>

        {formError && (
          <div role="alert" className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-800">
            {formError}
          </div>
        )}
        {formSuccess && (
          <div role="status" className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{formSuccess}</span>
          </div>
        )}

        <form onSubmit={handleCreateStaff} className="space-y-4 pt-2 border-t border-slate-100">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="staff-full-name" className="block text-xs font-semibold text-slate-700 mb-1">
                Staff Full Name
              </label>
              <input
                id="staff-full-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Amit Singh"
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl"
              />
            </div>

            <div>
              <label htmlFor="staff-username" className="block text-xs font-semibold text-slate-700 mb-1">
                Username
              </label>
              <input
                id="staff-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. amit"
                className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono bg-slate-50 border border-slate-300 rounded-xl"
              />
            </div>

            <div>
              <label htmlFor="staff-password" className="block text-xs font-semibold text-slate-700 mb-1">
                Initial Password
              </label>
              <input
                id="staff-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl"
              />
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-700 mb-2">
              Initial Permissions for New Staff Member
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ALL_PERMISSIONS.map((perm) => {
                const checked = selectedPerms.includes(perm.key);
                return (
                  <label
                    key={perm.key}
                    className={`min-h-[42px] px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 cursor-pointer ${
                      checked
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleToggleNewStaffPerm(perm.key)}
                      className="sr-only"
                    />
                    <span>{checked ? '☑️' : '⬜'}</span>
                    <span>{perm.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            className="min-h-[46px] px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Staff Account</span>
          </button>
        </form>
      </div>

      {/* Existing Staff Accounts & Live Granular Permission Matrix */}
      <div className="space-y-4">
        {staffUsers.map((staff) => (
          <div key={staff.id} className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">{staff.name}</h2>
                  <span className="text-xs font-mono text-slate-500">(@{staff.username})</span>
                  <span
                    className={`text-xs font-semibold ${
                      staff.active ? 'text-emerald-700' : 'text-red-600'
                    }`}
                  >
                    · {staff.active ? 'Active' : 'Deactivated'}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5 font-mono">
                  Created: {staff.created_at}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingStaff(staff);
                    setEditStaffName(staff.name);
                    setEditStaffUsername(staff.username);
                  }}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Details</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setResetUser(staff);
                    setNewPasswordVal('');
                  }}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Reset Password</span>
                </button>

                <button
                  type="button"
                  onClick={() => onToggleStaffActive(staff.id)}
                  className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    staff.active
                      ? 'border border-red-200 text-red-700 hover:bg-red-50'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  }`}
                >
                  {staff.active ? 'Deactivate Account' : 'Activate Account'}
                </button>
              </div>
            </div>

            {/* 9 Permission Toggles */}
            <div>
              <div className="text-xs font-bold text-slate-700 mb-2.5 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-slate-500" />
                <span>Feature Permissions for {staff.name} (Click to turn ON / OFF):</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {ALL_PERMISSIONS.map((perm) => {
                  const enabled = isPermEnabled(staff.id, perm.key);
                  return (
                    <button
                      key={perm.key}
                      type="button"
                      onClick={() => onToggleStaffPermission(staff.id, perm.key)}
                      className={`min-h-[48px] p-3 rounded-xl border text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                        enabled
                          ? 'bg-emerald-50/70 border-emerald-300 text-slate-900'
                          : 'bg-slate-50 border-slate-200 text-slate-500'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-bold">{perm.label}</div>
                        <div className="text-[11px] font-mono">
                          {enabled ? 'ON (Allowed)' : 'OFF (Revoked)'}
                        </div>
                      </div>
                      <span className="text-base">{enabled ? '☑️' : '⬜'}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Reset Password Modal */}
      {resetUser && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-pw-title"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 id="reset-pw-title" className="text-lg font-bold text-slate-900">
                Reset Password for {resetUser.name}
              </h3>
              <button
                type="button"
                aria-label="Close Reset Password Modal"
                onClick={() => setResetUser(null)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label htmlFor="new-staff-pw" className="block text-xs font-semibold text-slate-700 mb-1">
                New Password
              </label>
              <input
                id="new-staff-pw"
                type="password"
                value={newPasswordVal}
                onChange={(e) => setNewPasswordVal(e.target.value)}
                placeholder="Enter new password"
                className="w-full min-h-[44px] px-3.5 py-2 text-sm border border-slate-300 rounded-xl"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setResetUser(null)}
                className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!newPasswordVal) return;
                  onResetStaffPassword(resetUser.id, newPasswordVal);
                  setResetUser(null);
                }}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer"
              >
                Save New Password
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Staff Modal */}
      {editingStaff && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-staff-title"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 id="edit-staff-title" className="text-lg font-bold text-slate-900">
              Edit Account Details
            </h3>
            <div className="space-y-3">
              <div>
                <label htmlFor="edit-staff-name-input" className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name
                </label>
                <input
                  id="edit-staff-name-input"
                  type="text"
                  value={editStaffName}
                  onChange={(e) => setEditStaffName(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label htmlFor="edit-staff-user-input" className="block text-xs font-semibold text-slate-700 mb-1">
                  Username / Login ID
                </label>
                <input
                  id="edit-staff-user-input"
                  type="text"
                  value={editStaffUsername}
                  onChange={(e) => setEditStaffUsername(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-xl"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingStaff(null)}
                className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!editStaffName.trim() || !editStaffUsername.trim()) return;
                  onUpdateStaffUser(editingStaff.id, editStaffName.trim(), editStaffUsername.trim());
                  setEditingStaff(null);
                }}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface SettingsViewProps {
  db: DatabaseSchema;
  usersMap: Record<string, string>;
  onUpdateSettings: (settings: AgencySettings) => void;
  onResetToDemoData: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  db,
  usersMap,
  onUpdateSettings,
  onResetToDemoData,
}) => {
  const [agencyName, setAgencyName] = useState(db.settings.agencyName);
  const [agencyCode, setAgencyCode] = useState(db.settings.agencyCode);
  const [distributorLocation, setDistributorLocation] = useState(db.settings.distributorLocation);
  const [savedNotice, setSavedNotice] = useState(false);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings({
      ...db.settings,
      agencyName: agencyName.trim() || 'LPG Agency',
      agencyCode: agencyCode.trim() || 'BG-001',
      distributorLocation: distributorLocation.trim() || 'Asia/Kolkata (IST)',
    });
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  const handleDownloadSQLBackup = () => {
    const sql = generateSQLDump(db);
    const blob = new Blob([sql], { type: 'application/sql;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LPG_Database_Backup_${db.seededForDateIST}.sql`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadJSONBackup = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LPG_Database_Backup_${db.seededForDateIST}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Agency Settings */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
          Application Settings, Database Backups & Audit History
        </h1>

        {savedNotice && (
          <div role="status" className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-900">
            Agency settings saved successfully.
          </div>
        )}

        <form onSubmit={handleSaveSettings} className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div>
            <label htmlFor="settings-agency-name" className="block text-xs font-semibold text-slate-700 mb-1">
              LPG Agency Name
            </label>
            <input
              id="settings-agency-name"
              type="text"
              value={agencyName}
              onChange={(e) => setAgencyName(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl"
            />
          </div>

          <div>
            <label htmlFor="settings-agency-code" className="block text-xs font-semibold text-slate-700 mb-1">
              Distributor Code
            </label>
            <input
              id="settings-agency-code"
              type="text"
              value={agencyCode}
              onChange={(e) => setAgencyCode(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono bg-slate-50 border border-slate-300 rounded-xl"
            />
          </div>

          <div>
            <label htmlFor="settings-location" className="block text-xs font-semibold text-slate-700 mb-1">
              Location & Timezone
            </label>
            <input
              id="settings-location"
              type="text"
              value={distributorLocation}
              onChange={(e) => setDistributorLocation(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl"
            />
          </div>

          <div className="sm:col-span-3">
            <button
              type="submit"
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
            >
              Save Agency Settings
            </button>
          </div>
        </form>
      </div>

      {/* Section 20 & 25: Database Tables & Backup */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-slate-700" />
            <h2 className="text-base font-bold text-slate-900">
              Relational Database Tables & Backup
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadSQLBackup}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download SQL Dump (.sql)</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadJSONBackup}
              className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download JSON Backup</span>
            </button>
            <button
              type="button"
              onClick={onResetToDemoData}
              className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Seed Data</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-xs font-mono text-slate-500">users</div>
            <div className="text-xl font-bold font-mono text-slate-900 mt-1">{db.users.length} rows</div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-xs font-mono text-slate-500">user_permissions</div>
            <div className="text-xl font-bold font-mono text-slate-900 mt-1">
              {db.user_permissions.length} rows
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-xs font-mono text-slate-500">delivery_men</div>
            <div className="text-xl font-bold font-mono text-slate-900 mt-1">
              {db.delivery_men.length} rows
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-xs font-mono text-slate-500">customers</div>
            <div className="text-xl font-bold font-mono text-emerald-700 mt-1">
              {db.customers.length} rows
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-xs font-mono text-slate-500">consumer_entries</div>
            <div className="text-xl font-bold font-mono text-slate-900 mt-1">
              {db.consumer_entries.length} rows
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-xs font-mono text-slate-500">audit_logs</div>
            <div className="text-xl font-bold font-mono text-slate-900 mt-1">
              {db.audit_logs.length} rows
            </div>
          </div>
        </div>
      </div>

      {/* Section 19: Audit / History Logs */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Audit / History Logs</h2>
            <p className="text-xs text-slate-500">
              Tracks every edit, deletion, user modification, permission update, and delivery man change in IST.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500">{db.audit_logs.length} event(s)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 text-xs">
                <th className="py-2.5 pr-3 font-medium">Date & Time (IST)</th>
                <th className="py-2.5 px-3 font-medium">Changed By</th>
                <th className="py-2.5 px-3 font-medium">Action</th>
                <th className="py-2.5 px-3 font-medium">Previous Value</th>
                <th className="py-2.5 pl-3 font-medium">New Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {db.audit_logs.map((log: AuditLogRecord) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="py-2.5 pr-3 font-mono text-xs text-slate-600 whitespace-nowrap">
                    {log.timestamp_ist}
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-slate-900 whitespace-nowrap">
                    {usersMap[log.user_id] || log.user_id}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-xs font-bold text-slate-800 whitespace-nowrap">
                    {log.action}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-xs text-slate-500">{log.old_value}</td>
                  <td className="py-2.5 pl-3 font-mono text-xs text-slate-900 font-semibold">
                    {log.new_value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
