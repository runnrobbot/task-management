// Application constants

export const APP_NAME = 'Task Management System';
export const APP_VERSION = '2.0.0';

// Task statuses
export const TASK_STATUS = {
  PENDING: 'Pending',
  SELESAI: 'Selesai',
  CANCEL: 'Cancel',
};

export const TASK_STATUS_OPTIONS = [
  { value: TASK_STATUS.PENDING, label: 'Pending', color: 'warning' },
  { value: TASK_STATUS.SELESAI, label: 'Selesai', color: 'success' },
  { value: TASK_STATUS.CANCEL, label: 'Cancel', color: 'danger' },
];

// Task categories
export const TASK_CATEGORY = {
  OFFLINE: 'Offline',
  USER: 'User',
  LELANG: 'Lelang',
};

export const TASK_CATEGORY_OPTIONS = [
  { value: TASK_CATEGORY.OFFLINE, label: 'Offline', color: 'purple' },
  { value: TASK_CATEGORY.USER, label: 'User', color: 'primary' },
  { value: TASK_CATEGORY.LELANG, label: 'Lelang', color: 'warning' },
];

// User roles
export const USER_ROLE = {
  ADMIN: 'admin',
  USER: 'user',
};

export const USER_ROLE_OPTIONS = [
  { value: USER_ROLE.ADMIN, label: 'Administrator' },
  { value: USER_ROLE.USER, label: 'User Biasa' },
];

// Pagination
export const DEFAULT_PAGE_SIZE = 20;
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

// Debounce delay for search (ms)
export const SEARCH_DEBOUNCE_DELAY = 300;

// Reminder severity thresholds (days)
export const REMINDER_THRESHOLDS = {
  NORMAL: 1,
  WARNING: 1,
  URGENT: 2,
};

// Query keys for React Query
export const QUERY_KEYS = {
  TASKS: 'tasks',
  CATATAN: 'catatan',
  USERS: 'users',
  EMPLOYEES: 'employees',
  DIVISIONS: 'divisions',
  NOTIFICATIONS: 'notifications',
  STATS: 'stats',
  REMINDERS: 'reminders',
  EMPLOYEE_STATS: 'employee_stats',
  BARANG_KOSONG: 'barang_kosong',
  CUSTOMERS: 'customers',
};

// Barang Kosong Status
export const BARANG_STATUS = {
  KOSONG: 'Kosong',
  TERSEDIA: 'Tersedia',
  PROSES: 'Proses Pengadaan',
};

export const BARANG_STATUS_OPTIONS = [
  { value: BARANG_STATUS.KOSONG, label: 'Kosong', color: 'danger' },
  { value: BARANG_STATUS.PROSES, label: 'Proses Pengadaan', color: 'warning' },
  { value: BARANG_STATUS.TERSEDIA, label: 'Tersedia', color: 'success' },
];
