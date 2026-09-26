"use client";

import React, { createContext, useContext, useState, useCallback, useRef } from "react";

export type ToastType = "success" | "warning" | "error" | "info";

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  duration: number; // in milliseconds
  createdAt: number;
  isExiting?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface ToastOptions {
  id?: string;
  title?: string;
  message: string;
  type?: ToastType;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface ToastContextValue {
  toasts: ToastItem[];
  showToast: (options: ToastOptions) => string;
  success: (message: string, title?: string, options?: Partial<ToastOptions>) => string;
  warning: (message: string, title?: string, options?: Partial<ToastOptions>) => string;
  error: (message: string, title?: string, options?: Partial<ToastOptions>) => string;
  info: (message: string, title?: string, options?: Partial<ToastOptions>) => string;
  removeToast: (id: string) => void;
  clearAll: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_TITLES: Record<ToastType, string> = {
  success: "Thao tác thành công",
  warning: "Lỗi xác thực / Cảnh báo",
  error: "Lỗi hệ thống",
  info: "Thông báo hệ thống",
};

const DEFAULT_DURATIONS: Record<ToastType, number> = {
  success: 4500,
  warning: 6500, // Longer for validation errors so user can read buffer details
  error: 7000,
  info: 4500,
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const removeToast = useCallback((id: string) => {
    // Clear any pending dismissal timeout
    const timeout = timeoutsRef.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutsRef.current.delete(id);
    }

    // Trigger smooth exit animation first
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isExiting: true } : t))
    );

    // Completely remove after exit animation finishes (300ms)
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 300);
  }, []);

  const clearAll = useCallback(() => {
    timeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
    timeoutsRef.current.clear();
    setToasts([]);
  }, []);

  const showToast = useCallback(
    (options: ToastOptions): string => {
      const id = options.id || `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const type = options.type || "info";
      const title = options.title || DEFAULT_TITLES[type];
      const duration = options.duration ?? DEFAULT_DURATIONS[type];

      const newToast: ToastItem = {
        id,
        type,
        title,
        message: options.message,
        duration,
        createdAt: Date.now(),
        isExiting: false,
        action: options.action,
      };

      setToasts((prev) => {
        // Prevent exact duplicates within a short window
        const filtered = prev.filter((t) => !(t.message === newToast.message && t.type === newToast.type));
        // Keep maximum 5 toasts at a time to prevent screen clutter
        return [...filtered.slice(-4), newToast];
      });

      return id;
    },
    []
  );

  const success = useCallback(
    (message: string, title?: string, options?: Partial<ToastOptions>) => {
      return showToast({ ...options, message, title, type: "success" });
    },
    [showToast]
  );

  const warning = useCallback(
    (message: string, title?: string, options?: Partial<ToastOptions>) => {
      return showToast({ ...options, message, title, type: "warning" });
    },
    [showToast]
  );

  const error = useCallback(
    (message: string, title?: string, options?: Partial<ToastOptions>) => {
      return showToast({ ...options, message, title, type: "error" });
    },
    [showToast]
  );

  const info = useCallback(
    (message: string, title?: string, options?: Partial<ToastOptions>) => {
      return showToast({ ...options, message, title, type: "info" });
    },
    [showToast]
  );

  return (
    <ToastContext.Provider
      value={{
        toasts,
        showToast,
        success,
        warning,
        error,
        info,
        removeToast,
        clearAll,
      }}
    >
      {children}
    </ToastContext.Provider>
  );
};

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
