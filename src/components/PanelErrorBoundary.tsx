import React from "react";
import { reportLovableError } from "@/lib/lovable-error-reporting";

type Props = { children: React.ReactNode; label?: string };
type State = { error: Error | null };

/**
 * Pembatas error lokal: bila satu panel gagal render (mis. di browser tablet
 * tertentu), hanya panel itu yang menampilkan pesan — halaman tidak ikut
 * jatuh ke layar "This page didn't load".
 */
export class PanelErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(error);
    try {
      reportLovableError(error, { boundary: this.props.label ?? "panel_error_boundary" });
    } catch {
      /* abaikan */
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="rounded-xl border-2 border-destructive/40 bg-destructive/5 p-6 text-center">
        <p className="font-semibold text-foreground">Panel ini gagal ditampilkan</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Data Anda tetap tersimpan. Coba tampilkan ulang panel ini.
        </p>
        <p className="mx-auto mt-3 max-w-xl break-words rounded-md bg-background/70 p-2 text-left font-mono text-[11px] text-destructive">
          {this.state.error.message || String(this.state.error)}
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Coba lagi
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground"
          >
            Muat ulang halaman
          </button>
        </div>
      </div>
    );
  }
}

export default PanelErrorBoundary;
