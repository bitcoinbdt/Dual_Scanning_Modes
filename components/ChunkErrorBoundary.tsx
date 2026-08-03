'use client';

import React from 'react';

interface State {
  hasError: boolean;
  isChunkError: boolean;
}

/**
 * ChunkErrorBoundary
 * Catches ChunkLoadErrors (stale browser cache after a new deploy) and
 * automatically reloads the page once so users always get the latest chunks.
 */
export class ChunkErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  private reloaded = false;

  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, isChunkError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    const isChunkError =
      error.name === 'ChunkLoadError' ||
      error.message?.includes('Loading chunk') ||
      error.message?.includes('Failed to fetch dynamically imported module');

    return { hasError: true, isChunkError };
  }

  componentDidCatch(error: Error) {
    const isChunkError =
      error.name === 'ChunkLoadError' ||
      error.message?.includes('Loading chunk') ||
      error.message?.includes('Failed to fetch dynamically imported module');

    if (isChunkError && !this.reloaded) {
      this.reloaded = true;
      // Hard reload bypasses cache and fetches the latest deployment
      window.location.reload();
    }
  }

  render() {
    if (this.state.hasError && !this.state.isChunkError) {
      return (
        <div className="min-h-screen bg-grid flex items-center justify-center">
          <div className="glass-strong rounded-2xl p-8 max-w-md text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold gradient-text mb-2">Something went wrong</h2>
            <p className="text-muted-themed text-sm mb-6">
              An unexpected error occurred. Please refresh the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="gradient-primary text-white font-bold px-6 py-2 rounded-xl hover:opacity-90 transition"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    if (this.state.hasError && this.state.isChunkError) {
      return (
        <div className="min-h-screen bg-grid flex items-center justify-center">
          <div className="glass-strong rounded-2xl p-8 max-w-md text-center">
            <div className="text-4xl mb-4">🔄</div>
            <h2 className="text-xl font-bold gradient-text mb-2">Updating…</h2>
            <p className="text-muted-themed text-sm">
              A new version is available. Reloading automatically…
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
