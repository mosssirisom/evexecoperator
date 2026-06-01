import React, { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, AlertTriangle, X, Info } from "lucide-react";

const ToastContext = createContext(null);

export function useToast() {
  return useContext(ToastContext);
}

const ICONS = {
  success: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
  error: <AlertTriangle className="h-4 w-4 text-red-400" />,
  info: <Info className="h-4 w-4 text-blue-400" />,
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback(({ message, type = "info", duration = 3500 }) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), duration);
  }, []);

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0B132B]/95 px-4 py-3 shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom-2 duration-200"
          >
            {ICONS[t.type]}
            <span className="text-sm text-white">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              className="ml-2 text-slate-500 hover:text-slate-300 transition"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
