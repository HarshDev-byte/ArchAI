import toast from "react-hot-toast";

/**
 * Enhanced toast utilities with consistent styling and icons
 */

export const toastSuccess = (message: string, options?: { duration?: number }) => {
  return toast.success(message, {
    duration: options?.duration ?? 4000,
    icon: "✅",
    style: {
      background: "#15181f",
      color: "#e8ecf4",
      border: "1px solid #34d399",
      borderRadius: "8px",
      fontSize: "14px",
    },
  });
};

export const toastError = (message: string, options?: { duration?: number }) => {
  return toast.error(message, {
    duration: options?.duration ?? 6000,
    icon: "❌",
    style: {
      background: "#15181f",
      color: "#e8ecf4",
      border: "1px solid #ef4444",
      borderRadius: "8px",
      fontSize: "14px",
    },
  });
};

export const toastWarning = (message: string, options?: { duration?: number }) => {
  return toast(message, {
    duration: options?.duration ?? 5000,
    icon: "⚠️",
    style: {
      background: "#15181f",
      color: "#e8ecf4",
      border: "1px solid #f59e0b",
      borderRadius: "8px",
      fontSize: "14px",
    },
  });
};

export const toastInfo = (message: string, options?: { duration?: number }) => {
  return toast(message, {
    duration: options?.duration ?? 4000,
    icon: "ℹ️",
    style: {
      background: "#15181f",
      color: "#e8ecf4",
      border: "1px solid #3b82f6",
      borderRadius: "8px",
      fontSize: "14px",
    },
  });
};

export const toastLoading = (message: string) => {
  return toast.loading(message, {
    style: {
      background: "#15181f",
      color: "#e8ecf4",
      border: "1px solid #252a3a",
      borderRadius: "8px",
      fontSize: "14px",
    },
  });
};

export const toastPromise = <T>(
  promise: Promise<T>,
  messages: {
    loading: string;
    success: string;
    error: string;
  }
) => {
  return toast.promise(promise, messages, {
    style: {
      background: "#15181f",
      color: "#e8ecf4",
      border: "1px solid #252a3a",
      borderRadius: "8px",
      fontSize: "14px",
    },
    success: {
      style: {
        border: "1px solid #34d399",
      },
    },
    error: {
      style: {
        border: "1px solid #ef4444",
      },
    },
  });
};