import { clsx } from 'clsx';

// Utility for merging class names
export function cn(...inputs) {
  return clsx(inputs);
}

// Format date to Indonesian locale
export function formatDate(date, options = {}) {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options,
  });
}

// Format datetime to Indonesian locale
export function formatDateTime(date) {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleString('id-ID', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Format time only
export function formatTime(date) {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Calculate days difference
export function daysDifference(date1, date2 = new Date()) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2 - d1);
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

// Debounce function
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Throttle function
export function throttle(func, limit) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// Extract phone number from text
export function extractPhoneNumber(text) {
  if (!text) return '';
  const match = text.match(/No Telp:\s*([0-9\+\-\s]+)/i);
  if (match && match[1]) {
    let phone = match[1].replace(/[^0-9]/g, '');
    if (phone.startsWith('0')) {
      phone = '62' + phone.substring(1);
    }
    return phone;
  }
  return '';
}

// Format phone number for WhatsApp
export function formatWhatsAppNumber(phone) {
  if (!phone) return '';
  let cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.substring(1);
  }
  return cleaned;
}

// Generate WhatsApp URL
export function generateWhatsAppUrl(phone, message = '') {
  const formattedPhone = formatWhatsAppNumber(phone);
  if (!formattedPhone) return null;
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${formattedPhone}${message ? `?text=${encodedMessage}` : ''}`;
}

// Truncate text
export function truncate(text, length = 100) {
  if (!text) return '';
  if (text.length <= length) return text;
  return text.substring(0, length) + '...';
}

// Generate initials from name
export function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

// Sleep utility for testing
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Safe JSON parse
export function safeJsonParse(json, fallback = null) {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

// Generate random ID
export function generateId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Check if value is empty
export function isEmpty(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

// Capitalize first letter
export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// Format number with thousand separator
export function formatNumber(num) {
  if (num === null || num === undefined) return '0';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// Get status color class
export function getStatusColor(status) {
  const statusMap = {
    Pending: 'warning',
    Selesai: 'success',
    Cancel: 'danger',
    Kosong: 'danger',
    'Proses Pengadaan': 'warning',
    Tersedia: 'success',
  };
  return statusMap[status] || 'gray';
}

// Get category color class
export function getCategoryColor(category) {
  const categoryMap = {
    Offline: 'purple',
    User: 'primary',
    Lelang: 'warning',
  };
  return categoryMap[category] || 'gray';
}
