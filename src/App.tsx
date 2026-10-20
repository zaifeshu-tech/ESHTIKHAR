/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard,
  PlusCircle,
  FileSpreadsheet,
  Search,
  CopyCheck,
  CalendarClock,
  CalendarRange,
  Download,
  Truck,
  Users,
  Settings,
  LogOut,
  Flame,
  Menu,
  X,
  UserCheck,
  Cloud,
  Zap,
  Bot,
  Box,
  Atom,
  Smartphone,
} from 'lucide-react';
import {
  triggerDebouncedDriveSync,
  getAutoSyncState,
  subscribeAutoSync,
  type AutoSyncState,
} from './utils/driveAutoSync';
import {
  DESIGNATED_DRIVE_EMAIL,
  getGoogleUser,
  getGoogleAccessToken,
  initGoogleAuth,
} from './utils/googleDriveService';
import {
  ALL_PERMISSIONS,
  autoFetchCustomer,
  evaluateDuplicateStatus,
  formatIST,
  normalizeConsumerNumber,
  type AuditLogRecord,
  type ConsumerEntryRecord,
  type CustomerRecord,
  type PermissionKey,
  type UserRecord,
} from './utils/deduplication';
import {
  createInitialSeedDatabase,
  hashPassword,
  loadDatabase,
  loadDatabaseFromIDB,
  saveDatabase,
  verifyPassword,
  type AgencySettings,
  type DatabaseSchema,
} from './store/database';
import { LoginView } from './components/LoginView';
import { DashboardView, type NavSection } from './components/DashboardView';
import { NewEntryView } from './components/NewEntryView';
import { CustomerRegisterView } from './components/CustomerRegisterView';
import { DailyDuplicationView } from './components/DailyDuplicationView';
import { ThirtyDayReportView, MonthlyReportView } from './components/Reports30DayAndMonthlyView';
import { RecordsView, SearchConsumerView } from './components/RecordsAndSearchView';
import { ExportView } from './components/ExportView';
import { GoogleDriveView } from './components/GoogleDriveView';
import { GeminiChatView } from './components/GeminiChatView';
import { LpgCylinder3DView } from './components/LpgCylinder3DView';
import { ScienceSafetyView } from './components/ScienceSafetyView';
import { DownloadAppView } from './components/DownloadAppView';
import { DownloadAppModal } from './components/DownloadAppModal';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import {
  DeliveryMenView,
  StaffManagementView,
  SettingsView,
} from './components/AdminManagementView';

const REMEMBERED_DM_KEY = 'lpg_remembered_delivery_man_id';
const SESSION_USER_KEY = 'lpg_active_session_user_id';

export default function App() {
  const [db, setDb] = useState<DatabaseSchema>(() => loadDatabase());
  const [currentIST, setCurrentIST] = useState(() => formatIST(new Date()));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);

  // Check for ?autostart=1 or persisted session user
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') {
        return 'usr_admin';
      }
      return sessionStorage.getItem(SESSION_USER_KEY);
    } catch {
      return null;
    }
  });

  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');

  // Remember selected Delivery Man across entries (Section 6)
  const [selectedDeliveryManId, setSelectedDeliveryManId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(REMEMBERED_DM_KEY);
      if (saved) return saved;
    } catch {
      // ignore
    }
    return 'dm_raksharam';
  });

  // Live Indian Standard Time (IST / Asia/Kolkata) Clock
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIST(formatIST(new Date()));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Hydrate full persistent database from IndexedDB (supports 50,000+ customers with no quota error)
  useEffect(() => {
    loadDatabaseFromIDB()
      .then((idbDb) => {
        if (idbDb && idbDb.customers && idbDb.customers.length >= db.customers.length) {
          setDb(idbDb);
        }
      })
      .catch((err) => {
        console.warn('IDB load error:', err);
      });
  }, []);


  // Google Drive & Auto-Sync state
  const [autoSyncState, setAutoSyncState] = useState<AutoSyncState>(() => getAutoSyncState());
  const [googleUser, setGoogleUser] = useState(() => getGoogleUser());

  useEffect(() => {
    const unsubAuth = initGoogleAuth(
      (user) => {
        setGoogleUser(user);
        setAutoSyncState(getAutoSyncState());
      },
      () => {
        setGoogleUser(null);
        setAutoSyncState(getAutoSyncState());
      }
    );
    const unsubSync = subscribeAutoSync(() => {
      setAutoSyncState(getAutoSyncState());
    });
    return () => {
      unsubAuth();
      unsubSync();
    };
  }, []);

  // Persist DB changes automatically and auto-sync live records to Google Drive
  const updateDatabase = (updater: (prev: DatabaseSchema) => DatabaseSchema) => {
    setDb((prev) => {
      const next = updater(prev);
      saveDatabase(next);

      // Trigger debounced live update to Google Drive folder for zaifeshu@gmail.com
      const dmMap = next.delivery_men.reduce((acc, dm) => {
        acc[dm.id] = dm.name;
        return acc;
      }, {} as Record<string, string>);
      const uMap = next.users.reduce((acc, u) => {
        acc[u.id] = u.name;
        return acc;
      }, {} as Record<string, string>);
      triggerDebouncedDriveSync(next, dmMap, uMap, 2000);

      return next;
    });
  };

  const handleSelectDeliveryMan = (dmId: string) => {
    setSelectedDeliveryManId(dmId);
    try {
      localStorage.setItem(REMEMBERED_DM_KEY, dmId);
    } catch {
      // ignore
    }
  };

  const currentUser: UserRecord | null = useMemo(() => {
    if (!currentUserId) return null;
    const found = db.users.find((u) => u.id === currentUserId);
    if (!found || !found.active) return null;
    return found;
  }, [db.users, currentUserId]);

  const deliveryMenMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const dm of db.delivery_men) {
      map[dm.id] = dm.name;
    }
    return map;
  }, [db.delivery_men]);

  const usersMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const u of db.users) {
      map[u.id] = u.name;
    }
    return map;
  }, [db.users]);

  // Periodic background check to keep Google Drive in sync with live changes
  useEffect(() => {
    const interval = setInterval(() => {
      if (getGoogleAccessToken()) {
        triggerDebouncedDriveSync(db, deliveryMenMap, usersMap, 500);
      }
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [db, deliveryMenMap, usersMap]);

  const activeDeliveryMen = useMemo(
    () => db.delivery_men.filter((dm) => dm.active),
    [db.delivery_men]
  );

  // Ensure selectedDeliveryManId is an active delivery man if possible
  useEffect(() => {
    if (
      selectedDeliveryManId &&
      !activeDeliveryMen.some((dm) => dm.id === selectedDeliveryManId)
    ) {
      setSelectedDeliveryManId(activeDeliveryMen[0]?.id || '');
    }
  }, [activeDeliveryMen, selectedDeliveryManId]);

  // Permission evaluation helper
  const hasPermission = (perm: PermissionKey): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'ADMIN') return true;
    const record = db.user_permissions.find(
      (p) => p.user_id === currentUser.id && p.permission === perm
    );
    return record ? record.enabled : false;
  };

  // Authentication handlers
  const handleLogin = (username: string, password: string): { ok: boolean; error?: string } => {
    const normalizedUser = username.trim().toLowerCase();
    const user = db.users.find(
      (u) =>
        u.username.toLowerCase() === normalizedUser ||
        (normalizedUser === 'admin' && u.role === 'ADMIN')
    );
    if (!user) {
      return { ok: false, error: 'Username not found.' };
    }
    if (!user.active) {
      return { ok: false, error: 'This staff account has been deactivated by Admin.' };
    }
    if (!verifyPassword(password, user.password_hash)) {
      return { ok: false, error: 'Incorrect password.' };
    }
    setCurrentUserId(user.id);
    try {
      sessionStorage.setItem(SESSION_USER_KEY, user.id);
    } catch {
      // ignore
    }
    setActiveSection('dashboard');
    return { ok: true };
  };

  const handleLogout = () => {
    setCurrentUserId(null);
    try {
      sessionStorage.removeItem(SESSION_USER_KEY);
    } catch {
      // ignore
    }
    setActiveSection('dashboard');
    setMobileMenuOpen(false);
  };

  // Navigation items (Section 23) filtered by role & permissions
  const navItems = useMemo(() => {
    if (!currentUser) return [];
    const isAdmin = currentUser.role === 'ADMIN';
    const items: Array<{
      id: NavSection;
      label: string;
      icon: React.FC<{ className?: string }>;
      visible: boolean;
      highlight?: boolean;
    }> = [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, visible: true },
      {
        id: 'new_entry',
        label: '+ New Entry',
        icon: PlusCircle,
        visible: hasPermission('new_entry'),
        highlight: true,
      },
      {
        id: 'customer_register',
        label: 'Bulk Customer Upload',
        icon: UserCheck,
        visible: hasPermission('customer_register'),
      },
      {
        id: 'records',
        label: 'Records',
        icon: FileSpreadsheet,
        visible: hasPermission('view_records'),
      },
      {
        id: 'search_consumer',
        label: 'Search Consumer',
        icon: Search,
        visible: hasPermission('search_consumer'),
      },
      {
        id: 'daily_duplication',
        label: 'Daily Duplication',
        icon: CopyCheck,
        visible: hasPermission('daily_duplication'),
      },
      {
        id: 'report_30_day',
        label: '30-Day Report',
        icon: CalendarClock,
        visible: hasPermission('report_30_day'),
      },
      {
        id: 'monthly_report',
        label: 'Monthly Report',
        icon: CalendarRange,
        visible: hasPermission('monthly_report'),
      },
      {
        id: 'export',
        label: 'Export',
        icon: Download,
        visible: hasPermission('export_reports'),
      },
      {
        id: 'download_app',
        label: 'Download App (PWA)',
        icon: Smartphone,
        visible: true,
      },
      {
        id: 'google_drive',
        label: 'Google Drive',
        icon: Cloud,
        visible: true,
      },
      {
        id: 'gemini_chat',
        label: 'Gemini AI Assistant',
        icon: Bot,
        visible: true,
      },
      {
        id: 'three_3d',
        label: '3D Cylinder Hub',
        icon: Box,
        visible: true,
      },
      {
        id: 'science_lab',
        label: 'Gas Science & Safety',
        icon: Atom,
        visible: true,
      },
      {
        id: 'delivery_men',
        label: 'Delivery Men',
        icon: Truck,
        visible: hasPermission('manage_delivery_men'),
      },
      {
        id: 'staff_management',
        label: 'Staff Management',
        icon: Users,
        visible: isAdmin,
      },
      {
        id: 'settings',
        label: 'Settings',
        icon: Settings,
        visible: isAdmin,
      },
    ];
    return items.filter((i) => i.visible);
  }, [currentUser, db.user_permissions]);

  // Ensure current section is permitted
  useEffect(() => {
    if (currentUser && navItems.length > 0) {
      if (!navItems.some((item) => item.id === activeSection)) {
        setActiveSection('dashboard');
      }
    }
  }, [currentUser, navItems, activeSection]);

  // Customer Register Handlers (Manual Upsert + Excel Bulk Import + Delete)
  const handleUpsertCustomer = (params: {
    consumer_number: string;
    customer_name: string;
    mobile: string;
    address: string;
  }): { ok: boolean; mode: 'created' | 'updated'; error?: string } => {
    const norm = normalizeConsumerNumber(params.consumer_number);
    if (!norm || !params.customer_name.trim()) {
      return { ok: false, mode: 'created', error: 'Consumer Number and Customer Name are required.' };
    }
    const ist = formatIST(new Date());
    const existing = db.customers.find((c) => normalizeConsumerNumber(c.consumer_number) === norm);
    const mode: 'created' | 'updated' = existing ? 'updated' : 'created';

    updateDatabase((prev) => {
      const prevExisting = prev.customers.find(
        (c) => normalizeConsumerNumber(c.consumer_number) === norm
      );
      let nextCustomers: CustomerRecord[];
      let recordId: string;

      if (prevExisting) {
        recordId = prevExisting.id;
        nextCustomers = prev.customers.map((c) =>
          c.id === prevExisting.id
            ? {
                ...c,
                consumer_number: norm,
                customer_name: params.customer_name.trim(),
                mobile: params.mobile.trim(),
                address: params.address.trim(),
                updated_at: ist.timestampIST,
              }
            : c
        );
      } else {
        recordId = `cust_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
        nextCustomers = [
          {
            id: recordId,
            consumer_number: norm,
            customer_name: params.customer_name.trim(),
            mobile: params.mobile.trim(),
            address: params.address.trim(),
            created_at: ist.timestampIST,
            updated_at: ist.timestampIST,
          },
          ...prev.customers,
        ];
      }

      const auditEntry: AuditLogRecord = {
        id: `aud_${Date.now()}`,
        user_id: currentUser?.id || 'usr_admin',
        action: 'UPSERT_CUSTOMER',
        record_id: recordId,
        old_value: prevExisting
          ? `${prevExisting.consumer_number} (${prevExisting.customer_name})`
          : 'New Customer',
        new_value: `${norm} (${params.customer_name.trim()})`,
        timestamp_ist: ist.timestampIST,
      };

      return {
        ...prev,
        customers: nextCustomers,
        audit_logs: [auditEntry, ...prev.audit_logs],
      };
    });

    return { ok: true, mode };
  };

  const handleBulkImportCustomers = (
    rows: Array<{
      consumer_number: string;
      customer_name: string;
      mobile?: string;
      address?: string;
    }>
  ): { added: number; updated: number } => {
    const ist = formatIST(new Date());
    let added = 0;
    let updated = 0;
    const nowMs = Date.now();

    updateDatabase((prev) => {
      const mapByConsumer = new Map<string, CustomerRecord>();
      for (let i = 0; i < prev.customers.length; i++) {
        const c = prev.customers[i];
        mapByConsumer.set(normalizeConsumerNumber(c.consumer_number), c);
      }

      let newIdCounter = 0;
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const norm = normalizeConsumerNumber(r.consumer_number);
        if (!norm || !r.customer_name.trim()) continue;
        const found = mapByConsumer.get(norm);
        if (found) {
          updated += 1;
          mapByConsumer.set(norm, {
            ...found,
            consumer_number: norm,
            customer_name: r.customer_name.trim(),
            mobile: r.mobile ? r.mobile.trim() : found.mobile,
            address: r.address ? r.address.trim() : found.address,
            updated_at: ist.timestampIST,
          });
        } else {
          added += 1;
          newIdCounter += 1;
          mapByConsumer.set(norm, {
            id: `cust_${nowMs}_${newIdCounter}`,
            consumer_number: norm,
            customer_name: r.customer_name.trim(),
            mobile: r.mobile ? r.mobile.trim() : '',
            address: r.address ? r.address.trim() : '',
            created_at: ist.timestampIST,
            updated_at: ist.timestampIST,
          });
        }
      }

      const auditEntry: AuditLogRecord = {
        id: `aud_${nowMs}`,
        user_id: currentUser?.id || 'usr_admin',
        action: 'IMPORT_CUSTOMERS',
        record_id: 'excel_batch',
        old_value: `${prev.customers.length} customers`,
        new_value: `Bulk Import (+${added} added, ${updated} updated, Total: ${mapByConsumer.size})`,
        timestamp_ist: ist.timestampIST,
      };

      return {
        ...prev,
        customers: Array.from(mapByConsumer.values()),
        audit_logs: [auditEntry, ...prev.audit_logs],
      };
    });

    return { added, updated };
  };


  const handleDeleteCustomer = (id: string) => {
    const ist = formatIST(new Date());
    updateDatabase((prev) => {
      const target = prev.customers.find((c) => c.id === id);
      if (!target) return prev;
      const auditEntry: AuditLogRecord = {
        id: `aud_${Date.now()}`,
        user_id: currentUser?.id || 'usr_admin',
        action: 'DELETE_CUSTOMER',
        record_id: id,
        old_value: `${target.consumer_number} (${target.customer_name})`,
        new_value: 'DELETED',
        timestamp_ist: ist.timestampIST,
      };
      return {
        ...prev,
        customers: prev.customers.filter((c) => c.id !== id),
        audit_logs: [auditEntry, ...prev.audit_logs],
      };
    });
  };

  // CRUD Handlers with Audit Logging (Section 19)
  const handleSaveEntry = (params: {
    consumerNumber: string;
    customerName?: string;
    deliveryManId: string;
    duplicateToday: boolean;
    duplicate30Days: boolean;
    duplicateMonth: boolean;
  }): ConsumerEntryRecord => {
    const ist = formatIST(new Date());
    const norm = normalizeConsumerNumber(params.consumerNumber);
    const existingCustomer = autoFetchCustomer(norm, db.customers);
    const resolvedCustomerName =
      existingCustomer?.customer_name || params.customerName?.trim() || '';

    const newEntry: ConsumerEntryRecord = {
      id: `ent_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      consumer_number: norm,
      customer_name: resolvedCustomerName,
      entry_date_ist: ist.dateIST,
      entry_time_ist: ist.timeIST,
      timestamp_ist: ist.timestampIST,
      iso_ist: ist.isoIST,
      delivery_man_id: params.deliveryManId,
      duplicate_today: params.duplicateToday,
      duplicate_30_days: params.duplicate30Days,
      duplicate_month: params.duplicateMonth,
      created_by: currentUser?.id || 'usr_admin',
      created_at: ist.timestampIST,
    };

    updateDatabase((prev) => {
      const alreadyRegistered = prev.customers.some(
        (c) => normalizeConsumerNumber(c.consumer_number) === norm
      );
      const nextCustomers =
        !alreadyRegistered && resolvedCustomerName
          ? [
              {
                id: `cust_${Date.now()}`,
                consumer_number: norm,
                customer_name: resolvedCustomerName,
                mobile: '',
                address: '',
                created_at: ist.timestampIST,
                updated_at: ist.timestampIST,
              },
              ...prev.customers,
            ]
          : prev.customers;

      return {
        ...prev,
        customers: nextCustomers,
        consumer_entries: [...prev.consumer_entries, newEntry],
      };
    });

    return newEntry;
  };

  const handleEditEntry = (id: string, newConsumerNumber: string, newDeliveryManId: string) => {
    if (!currentUser) return;
    const ist = formatIST(new Date());
    updateDatabase((prev) => {
      const target = prev.consumer_entries.find((e) => e.id === id);
      if (!target) return prev;

      const otherEntries = prev.consumer_entries.filter((e) => e.id !== id);
      const recheck = evaluateDuplicateStatus(
        newConsumerNumber,
        otherEntries,
        target.entry_date_ist
      );
      const matchedCust = autoFetchCustomer(recheck.normalizedConsumerNumber, prev.customers);

      const oldDmName = deliveryMenMap[target.delivery_man_id] || target.delivery_man_id;
      const newDmName = deliveryMenMap[newDeliveryManId] || newDeliveryManId;

      const auditEntry: AuditLogRecord = {
        id: `aud_${Date.now()}`,
        user_id: currentUser.id,
        action: 'EDIT_ENTRY',
        record_id: id,
        old_value: `Consumer: ${target.consumer_number}, Delivery Man: ${oldDmName}`,
        new_value: `Consumer: ${recheck.normalizedConsumerNumber}, Delivery Man: ${newDmName}`,
        timestamp_ist: ist.timestampIST,
      };

      const updatedEntries = prev.consumer_entries.map((e) =>
        e.id === id
          ? {
              ...e,
              consumer_number: recheck.normalizedConsumerNumber,
              customer_name: matchedCust?.customer_name || e.customer_name || '',
              delivery_man_id: newDeliveryManId,
              duplicate_today: recheck.isDuplicateToday,
              duplicate_30_days: recheck.isDuplicate30Days,
              duplicate_month: recheck.isDuplicateMonth,
            }
          : e
      );

      return {
        ...prev,
        consumer_entries: updatedEntries,
        audit_logs: [auditEntry, ...prev.audit_logs],
      };
    });
  };

  const handleDeleteEntry = (id: string) => {
    if (!currentUser) return;
    const ist = formatIST(new Date());
    updateDatabase((prev) => {
      const target = prev.consumer_entries.find((e) => e.id === id);
      if (!target) return prev;
      const oldDmName = deliveryMenMap[target.delivery_man_id] || target.delivery_man_id;

      const auditEntry: AuditLogRecord = {
        id: `aud_${Date.now()}`,
        user_id: currentUser.id,
        action: 'DELETE_ENTRY',
        record_id: id,
        old_value: `Consumer: ${target.consumer_number} (${target.timestamp_ist}) - ${oldDmName}`,
        new_value: 'DELETED',
        timestamp_ist: ist.timestampIST,
      };

      return {
        ...prev,
        consumer_entries: prev.consumer_entries.filter((e) => e.id !== id),
        audit_logs: [auditEntry, ...prev.audit_logs],
      };
    });
  };

  // Delivery Man Management Handlers
  const handleAddDeliveryMan = (name: string): { ok: boolean; error?: string } => {
    const exists = db.delivery_men.some((d) => d.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      return { ok: false, error: `Delivery Man "${name}" already exists.` };
    }
    const ist = formatIST(new Date());
    const newId = `dm_${Date.now()}`;
    updateDatabase((prev) => ({
      ...prev,
      delivery_men: [
        ...prev.delivery_men,
        {
          id: newId,
          name,
          active: true,
          created_at: ist.timestampIST,
          updated_at: ist.timestampIST,
        },
      ],
      audit_logs: [
        {
          id: `aud_${Date.now()}`,
          user_id: currentUser?.id || 'usr_admin',
          action: 'CREATE_DELIVERY_MAN',
          record_id: newId,
          old_value: 'None',
          new_value: `${name} (Active: true)`,
          timestamp_ist: ist.timestampIST,
        },
        ...prev.audit_logs,
      ],
    }));
    return { ok: true };
  };

  const handleEditDeliveryMan = (id: string, newName: string) => {
    const ist = formatIST(new Date());
    updateDatabase((prev) => {
      const target = prev.delivery_men.find((d) => d.id === id);
      if (!target) return prev;
      return {
        ...prev,
        delivery_men: prev.delivery_men.map((d) =>
          d.id === id ? { ...d, name: newName, updated_at: ist.timestampIST } : d
        ),
        audit_logs: [
          {
            id: `aud_${Date.now()}`,
            user_id: currentUser?.id || 'usr_admin',
            action: 'UPDATE_DELIVERY_MAN',
            record_id: id,
            old_value: target.name,
            new_value: newName,
            timestamp_ist: ist.timestampIST,
          },
          ...prev.audit_logs,
        ],
      };
    });
  };

  const handleToggleDeliveryManActive = (id: string) => {
    const ist = formatIST(new Date());
    updateDatabase((prev) => {
      const target = prev.delivery_men.find((d) => d.id === id);
      if (!target) return prev;
      const nextActive = !target.active;
      return {
        ...prev,
        delivery_men: prev.delivery_men.map((d) =>
          d.id === id ? { ...d, active: nextActive, updated_at: ist.timestampIST } : d
        ),
        audit_logs: [
          {
            id: `aud_${Date.now()}`,
            user_id: currentUser?.id || 'usr_admin',
            action: 'UPDATE_DELIVERY_MAN',
            record_id: id,
            old_value: `${target.name} (Active: ${target.active})`,
            new_value: `${target.name} (Active: ${nextActive})`,
            timestamp_ist: ist.timestampIST,
          },
          ...prev.audit_logs,
        ],
      };
    });
  };

  // Staff Management Handlers
  const handleAddStaff = (params: {
    name: string;
    username: string;
    password: string;
    permissions: PermissionKey[];
  }): { ok: boolean; error?: string } => {
    const duplicateUser = db.users.some(
      (u) => u.username.toLowerCase() === params.username.toLowerCase()
    );
    if (duplicateUser) {
      return { ok: false, error: `Username "${params.username}" is already taken.` };
    }
    const ist = formatIST(new Date());
    const userId = `usr_${Date.now()}`;
    const newUser: UserRecord = {
      id: userId,
      name: params.name,
      username: params.username,
      password_hash: hashPassword(params.password),
      role: 'STAFF',
      active: true,
      created_at: ist.timestampIST,
    };

    const newPerms = ALL_PERMISSIONS.map((p) => ({
      id: `perm_${userId}_${p.key}`,
      user_id: userId,
      permission: p.key,
      enabled: params.permissions.includes(p.key),
    }));

    updateDatabase((prev) => ({
      ...prev,
      users: [...prev.users, newUser],
      user_permissions: [...prev.user_permissions, ...newPerms],
      audit_logs: [
        {
          id: `aud_${Date.now()}`,
          user_id: currentUser?.id || 'usr_admin',
          action: 'CREATE_USER',
          record_id: userId,
          old_value: 'None',
          new_value: `${params.name} (@${params.username})`,
          timestamp_ist: ist.timestampIST,
        },
        ...prev.audit_logs,
      ],
    }));

    return { ok: true };
  };

  const handleUpdateStaffUser = (id: string, name: string, username: string) => {
    const ist = formatIST(new Date());
    updateDatabase((prev) => {
      const target = prev.users.find((u) => u.id === id);
      if (!target) return prev;
      return {
        ...prev,
        users: prev.users.map((u) => (u.id === id ? { ...u, name, username } : u)),
        audit_logs: [
          {
            id: `aud_${Date.now()}`,
            user_id: currentUser?.id || 'usr_admin',
            action: 'UPDATE_USER',
            record_id: id,
            old_value: `${target.name} (@${target.username})`,
            new_value: `${name} (@${username})`,
            timestamp_ist: ist.timestampIST,
          },
          ...prev.audit_logs,
        ],
      };
    });
  };

  const handleToggleStaffActive = (id: string) => {
    const ist = formatIST(new Date());
    updateDatabase((prev) => {
      const target = prev.users.find((u) => u.id === id);
      if (!target) return prev;
      const nextActive = !target.active;
      return {
        ...prev,
        users: prev.users.map((u) => (u.id === id ? { ...u, active: nextActive } : u)),
        audit_logs: [
          {
            id: `aud_${Date.now()}`,
            user_id: currentUser?.id || 'usr_admin',
            action: 'UPDATE_USER',
            record_id: id,
            old_value: `${target.name} (Active: ${target.active})`,
            new_value: `${target.name} (Active: ${nextActive})`,
            timestamp_ist: ist.timestampIST,
          },
          ...prev.audit_logs,
        ],
      };
    });
  };

  const handleResetStaffPassword = (id: string, newPassword: string) => {
    const ist = formatIST(new Date());
    updateDatabase((prev) => {
      const target = prev.users.find((u) => u.id === id);
      if (!target) return prev;
      return {
        ...prev,
        users: prev.users.map((u) =>
          u.id === id ? { ...u, password_hash: hashPassword(newPassword) } : u
        ),
        audit_logs: [
          {
            id: `aud_${Date.now()}`,
            user_id: currentUser?.id || 'usr_admin',
            action: 'RESET_PASSWORD',
            record_id: id,
            old_value: 'Password Hash (Hidden)',
            new_value: `Password Reset for ${target.name}`,
            timestamp_ist: ist.timestampIST,
          },
          ...prev.audit_logs,
        ],
      };
    });
  };

  const handleToggleStaffPermission = (userId: string, permission: PermissionKey) => {
    const ist = formatIST(new Date());
    updateDatabase((prev) => {
      const existing = prev.user_permissions.find(
        (p) => p.user_id === userId && p.permission === permission
      );
      const nextEnabled = existing ? !existing.enabled : true;
      const updatedPerms = existing
        ? prev.user_permissions.map((p) =>
            p.user_id === userId && p.permission === permission
              ? { ...p, enabled: nextEnabled }
              : p
          )
        : [
            ...prev.user_permissions,
            {
              id: `perm_${userId}_${permission}`,
              user_id: userId,
              permission,
              enabled: nextEnabled,
            },
          ];

      const staffUser = prev.users.find((u) => u.id === userId);
      return {
        ...prev,
        user_permissions: updatedPerms,
        audit_logs: [
          {
            id: `aud_${Date.now()}`,
            user_id: currentUser?.id || 'usr_admin',
            action: 'UPDATE_PERMISSIONS',
            record_id: userId,
            old_value: `${staffUser?.name || userId} · ${permission}: ${!nextEnabled}`,
            new_value: `${staffUser?.name || userId} · ${permission}: ${nextEnabled}`,
            timestamp_ist: ist.timestampIST,
          },
          ...prev.audit_logs,
        ],
      };
    });
  };

  const handleUpdateSettings = (settings: AgencySettings) => {
    updateDatabase((prev) => ({
      ...prev,
      settings,
    }));
  };

  const handleResetToDemoData = () => {
    const fresh = createInitialSeedDatabase();
    saveDatabase(fresh);
    setDb(fresh);
  };

  // If not logged in, render LoginView
  if (!currentUser) {
    return (
      <LoginView
        agencyName={db.settings.agencyName}
        agencyCode={db.settings.agencyCode}
        onLogin={handleLogin}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Desktop Sidebar Navigation (Section 23) */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 bg-white border-r border-slate-200 min-h-screen justify-between">
        <div>
          {/* Brand Header */}
          <div className="h-16 px-5 border-b border-slate-200 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
              <Flame className="w-4 h-4 text-amber-400" />
            </div>
            <span className="font-bold text-sm text-slate-900 truncate">
              LPG Deduplication
            </span>
          </div>

          {/* Navigation Links */}
          <nav aria-label="Main Navigation" className="p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveSection(item.id)}
                  className={`w-full min-h-[42px] px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-3 transition-colors cursor-pointer whitespace-nowrap ${
                    item.highlight
                      ? isActive
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-amber-50 text-slate-900 border border-amber-200 hover:bg-amber-100 font-bold'
                      : isActive
                      ? 'bg-slate-100 text-slate-900 font-bold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      item.highlight && isActive ? 'text-amber-400' : ''
                    }`}
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* PWA Download Banner in Sidebar */}
        <div className="px-4 py-2 border-t border-slate-100">
          <PWAInstallButton
            variant="sidebar"
            onOpenModal={() => setDownloadModalOpen(true)}
          />
        </div>

        {/* User Profile & Logout Footer */}
        <div className="p-4 border-t border-slate-200 space-y-3">
          <div className="text-xs">
            <div className="font-bold text-slate-900 truncate">{currentUser.name}</div>
            <div className="text-slate-500 font-mono">
              Role: {currentUser.role} · @{currentUser.username}
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar (Strict 3-Zone Contract on Desktop + Compact Header on Mobile) */}
        <header className="h-14 sm:h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30">
          {/* Zone 1: Brand / Active Section Title */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              aria-label="Open Navigation Menu"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden min-h-[40px] min-w-[40px] -ml-2 flex items-center justify-center text-slate-700 hover:text-slate-900 cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="font-bold text-sm sm:text-base text-slate-900 truncate whitespace-nowrap">
              {db.settings.agencyName}
            </span>
          </div>

          {/* Zone 2: Live IST Clock & User Role Info */}
          <div className="hidden md:flex items-center gap-4 text-xs text-slate-600 font-mono tabular-nums whitespace-nowrap shrink-0">
            <span>IST: {currentIST.timestampIST}</span>
            <span aria-hidden="true">·</span>
            <span className="font-sans font-medium text-slate-700">
              {currentUser.name} ({currentUser.role})
            </span>
          </div>

          {/* Zone 3: Drive Cloud Status & Single Primary Action */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Download / Install App PWA Button */}
            <PWAInstallButton
              onOpenModal={() => setDownloadModalOpen(true)}
            />

            {/* Google Drive Live Status Button */}
            <button
              type="button"
              onClick={() => setActiveSection('google_drive')}
              className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition border cursor-pointer ${
                autoSyncState.status === 'syncing'
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : googleUser
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
              title={
                googleUser
                  ? `Google Drive connected to ${googleUser.email}. Auto-sync active.`
                  : `Connect Cloud Drive of ${DESIGNATED_DRIVE_EMAIL}`
              }
            >
              <Cloud
                className={`w-3.5 h-3.5 shrink-0 ${
                  autoSyncState.status === 'syncing'
                    ? 'animate-pulse text-blue-600'
                    : googleUser
                    ? 'text-emerald-600'
                    : 'text-slate-400'
                }`}
              />
              <span className="hidden sm:inline">
                {autoSyncState.status === 'syncing'
                  ? 'Drive: Syncing...'
                  : googleUser
                  ? 'Drive: Synced'
                  : 'Drive: zaifeshu'}
              </span>
              {googleUser && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              )}
            </button>

            {hasPermission('new_entry') && activeSection !== 'new_entry' ? (
              <button
                type="button"
                onClick={() => setActiveSection('new_entry')}
                className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <PlusCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>+ New Entry</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleLogout}
                className="min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            )}
          </div>
        </header>

        {/* Mobile Drawer Navigation */}
        {mobileMenuOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Mobile Navigation Drawer"
            className="fixed inset-0 z-50 lg:hidden bg-slate-900/60 backdrop-blur-xs flex"
          >
            <div className="w-72 max-w-[85vw] bg-white h-full flex flex-col justify-between p-4 shadow-xl">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <span className="font-bold text-sm text-slate-900">LPG Deduplication Menu</span>
                  <button
                    type="button"
                    aria-label="Close Navigation Menu"
                    onClick={() => setMobileMenuOpen(false)}
                    className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-500 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="mt-3 space-y-1">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeSection === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setActiveSection(item.id);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-3 cursor-pointer ${
                          isActive
                            ? 'bg-slate-900 text-white font-bold'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 space-y-2">
                <div className="text-xs text-slate-600">
                  Signed in as <strong>{currentUser.name}</strong> ({currentUser.role})
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Active View Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-20 lg:pb-8 max-w-7xl w-full mx-auto">
          {activeSection === 'dashboard' && (
            <DashboardView
              currentUser={currentUser}
              hasPermission={hasPermission}
              onNavigate={setActiveSection}
              entries={db.consumer_entries}
              customers={db.customers}
              deliveryMen={db.delivery_men}
              users={db.users}
              todayIST={currentIST.dateIST}
              currentTimestampIST={currentIST.timestampIST}
              deliveryMenMap={deliveryMenMap}
              usersMap={usersMap}
            />
          )}

          {activeSection === 'new_entry' && hasPermission('new_entry') && (
            <NewEntryView
              entries={db.consumer_entries}
              customers={db.customers}
              activeDeliveryMen={activeDeliveryMen}
              deliveryMenMap={deliveryMenMap}
              usersMap={usersMap}
              selectedDeliveryManId={selectedDeliveryManId}
              onSelectDeliveryMan={handleSelectDeliveryMan}
              todayIST={currentIST.dateIST}
              currentTimestampIST={currentIST.timestampIST}
              onOpenCustomerRegister={
                hasPermission('customer_register')
                  ? () => setActiveSection('customer_register')
                  : undefined
              }
              onSaveEntry={handleSaveEntry}
            />
          )}

          {activeSection === 'customer_register' && hasPermission('customer_register') && (
            <CustomerRegisterView
              customers={db.customers}
              isAdmin={currentUser.role === 'ADMIN'}
              onUpsertCustomer={handleUpsertCustomer}
              onBulkImportCustomers={handleBulkImportCustomers}
              onDeleteCustomer={handleDeleteCustomer}
              onOpenGoogleDrive={() => setActiveSection('google_drive')}
            />
          )}

          {activeSection === 'daily_duplication' && hasPermission('daily_duplication') && (
            <DailyDuplicationView
              entries={db.consumer_entries}
              todayIST={currentIST.dateIST}
              deliveryMenMap={deliveryMenMap}
              usersMap={usersMap}
              agencyName={db.settings.agencyName}
              canExport={hasPermission('export_reports')}
            />
          )}

          {activeSection === 'report_30_day' && hasPermission('report_30_day') && (
            <ThirtyDayReportView
              entries={db.consumer_entries}
              todayIST={currentIST.dateIST}
              deliveryMenMap={deliveryMenMap}
            />
          )}

          {activeSection === 'monthly_report' && hasPermission('monthly_report') && (
            <MonthlyReportView
              entries={db.consumer_entries}
              deliveryMen={db.delivery_men}
              todayIST={currentIST.dateIST}
              deliveryMenMap={deliveryMenMap}
              usersMap={usersMap}
              agencyName={db.settings.agencyName}
              canExport={hasPermission('export_reports')}
            />
          )}

          {activeSection === 'records' && hasPermission('view_records') && (
            <RecordsView
              entries={db.consumer_entries}
              customers={db.customers}
              deliveryMen={db.delivery_men}
              todayIST={currentIST.dateIST}
              deliveryMenMap={deliveryMenMap}
              usersMap={usersMap}
              isAdmin={currentUser.role === 'ADMIN'}
              onEditEntry={handleEditEntry}
              onDeleteEntry={handleDeleteEntry}
            />
          )}

          {activeSection === 'search_consumer' && hasPermission('search_consumer') && (
            <SearchConsumerView
              entries={db.consumer_entries}
              customers={db.customers}
              todayIST={currentIST.dateIST}
              deliveryMenMap={deliveryMenMap}
              usersMap={usersMap}
            />
          )}

          {activeSection === 'export' && hasPermission('export_reports') && (
            <ExportView
              entries={db.consumer_entries}
              deliveryMen={db.delivery_men}
              todayIST={currentIST.dateIST}
              deliveryMenMap={deliveryMenMap}
              usersMap={usersMap}
              agencyName={db.settings.agencyName}
            />
          )}

          {activeSection === 'google_drive' && (
            <GoogleDriveView
              db={db}
              currentUser={currentUser}
              onBulkImportCustomers={handleBulkImportCustomers}
              onRestoreDatabase={(newDb) => {
                setDb(newDb);
                saveDatabase(newDb);
              }}
              deliveryMenMap={deliveryMenMap}
              usersMap={usersMap}
            />
          )}

          {activeSection === 'gemini_chat' && (
            <GeminiChatView
              db={db}
              deliveryMenMap={deliveryMenMap}
              usersMap={usersMap}
            />
          )}

          {activeSection === 'three_3d' && (
            <LpgCylinder3DView />
          )}

          {activeSection === 'science_lab' && (
            <ScienceSafetyView />
          )}

          {activeSection === 'delivery_men' && hasPermission('manage_delivery_men') && (
            <DeliveryMenView
              deliveryMen={db.delivery_men}
              entries={db.consumer_entries}
              todayIST={currentIST.dateIST}
              onAddDeliveryMan={handleAddDeliveryMan}
              onEditDeliveryMan={handleEditDeliveryMan}
              onToggleDeliveryManActive={handleToggleDeliveryManActive}
            />
          )}

          {activeSection === 'staff_management' && currentUser.role === 'ADMIN' && (
            <StaffManagementView
              users={db.users}
              userPermissions={db.user_permissions}
              onAddStaff={handleAddStaff}
              onUpdateStaffUser={handleUpdateStaffUser}
              onToggleStaffActive={handleToggleStaffActive}
              onResetStaffPassword={handleResetStaffPassword}
              onToggleStaffPermission={handleToggleStaffPermission}
            />
          )}

          {activeSection === 'settings' && currentUser.role === 'ADMIN' && (
            <SettingsView
              db={db}
              usersMap={usersMap}
              onUpdateSettings={handleUpdateSettings}
              onResetToDemoData={handleResetToDemoData}
            />
          )}
        </main>

        {/* Mobile Bottom Thumb Navigation Bar (<= 15% total sticky viewport budget) */}
        <nav
          aria-label="Mobile Quick Navigation"
          className="lg:hidden fixed bottom-0 left-0 right-0 z-30 h-14 bg-white/95 backdrop-blur-md border-t border-slate-200 grid grid-cols-4 items-center px-2"
        >
          <button
            type="button"
            onClick={() => setActiveSection('dashboard')}
            className={`min-h-[44px] flex flex-col items-center justify-center text-[11px] font-semibold cursor-pointer ${
              activeSection === 'dashboard' ? 'text-slate-900 font-bold' : 'text-slate-500'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span className="mt-0.5">Dashboard</span>
          </button>

          {hasPermission('new_entry') && (
            <button
              type="button"
              onClick={() => setActiveSection('new_entry')}
              className={`min-h-[44px] flex flex-col items-center justify-center text-[11px] font-bold cursor-pointer ${
                activeSection === 'new_entry' ? 'text-amber-600' : 'text-slate-900'
              }`}
            >
              <PlusCircle className="w-4 h-4 text-amber-500" />
              <span className="mt-0.5">+ New Entry</span>
            </button>
          )}

          {hasPermission('customer_register') && (
            <button
              type="button"
              onClick={() => setActiveSection('customer_register')}
              className={`min-h-[44px] flex flex-col items-center justify-center text-[11px] font-semibold cursor-pointer ${
                activeSection === 'customer_register' ? 'text-emerald-700 font-bold' : 'text-slate-500'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span className="mt-0.5">Bulk Upload</span>
            </button>
          )}

          {hasPermission('daily_duplication') && (
            <button
              type="button"
              onClick={() => setActiveSection('daily_duplication')}
              className={`min-h-[44px] flex flex-col items-center justify-center text-[11px] font-semibold cursor-pointer ${
                activeSection === 'daily_duplication' ? 'text-red-600 font-bold' : 'text-slate-500'
              }`}
            >
              <CopyCheck className="w-4 h-4" />
              <span className="mt-0.5">Daily Dup</span>
            </button>
          )}
        </nav>
      </div>
    </div>
  );
}
