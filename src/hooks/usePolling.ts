import { useEffect, useRef } from "react";

/**
 * Polling yang otomatis berhenti saat tab browser tidak terlihat
 * (diminimalkan / pindah tab), lalu langsung menyegarkan data begitu
 * tab dibuka kembali. Menghemat beban server secara signifikan.
 */
export function usePolling(
  callback: () => void | Promise<void>,
  intervalMs: number,
  enabled: boolean = true,
) {
  const cbRef = useRef(callback);
  cbRef.current = callback;

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setInterval> | null = null;


    const run = () => {
      void cbRef.current();
    };

    const start = () => {
      if (timer !== null) return;
      timer = setInterval(run, intervalMs);
    };

    const stop = () => {
      if (timer === null) return;
      clearInterval(timer);
      timer = null;
    };

    const onVisibility = () => {
      if (typeof document !== "undefined" && document.hidden) {
        stop();
      } else {
        run();
        start();
      }
    };

    run();
    if (typeof document === "undefined" || !document.hidden) start();
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibility);
    }

    return () => {
      stop();
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibility);
      }
    };
  }, [intervalMs, enabled]);
}
