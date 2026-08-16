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
        <button
          type="button"
          onClick={() => this.setState({ error: null })}
          className="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Coba lagi
        </button>
      </div>
    );
  }
}

export default PanelErrorBoundary;
