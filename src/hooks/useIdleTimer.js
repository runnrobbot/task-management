import { useEffect, useRef, useCallback } from 'react';

/**
 * useIdleTimer
 * Auto sign-out user jika tidak ada aktivitas selama `timeoutMs` milidetik.
 * Aktivitas yang dipantau: mousemove, mousedown, keydown, touchstart, scroll, click
 *
 * @param {Function} onIdle - Callback dipanggil saat user idle
 * @param {number} timeoutMs - Durasi idle sebelum logout (default 10 menit)
 * @param {boolean} enabled - Aktifkan/nonaktifkan timer
 */
export function useIdleTimer(onIdle, timeoutMs = 10 * 60 * 1000, enabled = true) {
  const timerRef = useRef(null);
  const onIdleRef = useRef(onIdle);

  // Keep callback ref fresh tanpa perlu re-register listeners
  useEffect(() => {
    onIdleRef.current = onIdle;
  }, [onIdle]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      onIdleRef.current?.();
    }, timeoutMs);
  }, [timeoutMs]);

  useEffect(() => {
    if (!enabled) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];

    const handleActivity = () => resetTimer();

    // Pasang semua listener
    events.forEach((event) => window.addEventListener(event, handleActivity, { passive: true }));

    // Mulai timer pertama kali
    resetTimer();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((event) => window.removeEventListener(event, handleActivity));
    };
  }, [enabled, resetTimer]);
}
