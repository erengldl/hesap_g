"use client";

import React from "react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-8">
          <div className="rounded-xl border border-danger/20 bg-danger/5 p-8 max-w-lg text-center">
            <p className="text-sm font-extrabold text-danger uppercase tracking-[0.2em] mb-2">
              Sayfa Yükleme Hatası
            </p>
            <p className="text-xs text-muted mb-4">
              Bu sayfa yüklenirken bir hata oluştu. Lütfen sayfayı yenileyin veya başka bir sayfaya geçin.
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-container px-4 py-2 text-xs font-extrabold uppercase tracking-[0.2em] text-foreground transition-colors duration-200 hover:bg-card"
            >
              Yeniden Dene
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
