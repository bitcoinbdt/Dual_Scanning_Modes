'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://scanner.coinxera.com';

interface EventPayload {
  id?: string;
  type: string;
  payload: any;
  timestamp?: string;
}

export function useEventBus() {
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const backoffRef = useRef(1000);
  const attemptCountRef = useRef(0);
  const maxAttempts = 1; // Only try once, then disable
  const hasShownWarningRef = useRef(false);

  useEffect(() => {
    // Only try to connect if backend URL is not the default Render URL
    // or if we're in development mode
    const isDev = process.env.NODE_ENV === 'development';
    const isDefaultRenderUrl = BACKEND_URL.includes('dual-scanning-modes.onrender.com');
    
    // Skip connection if using the template Render URL (backend not deployed)
    if (isDefaultRenderUrl && !isDev) {
      console.log('[SSE] Backend not deployed. Event bus disabled.');
      return;
    }

    connect();

    return () => {
      cleanup();
    };
  }, []);

  const cleanup = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  };

  const connect = () => {
    // Don't retry if we've exceeded max attempts
    if (attemptCountRef.current >= maxAttempts) {
      if (!hasShownWarningRef.current) {
        console.log('[SSE] Event bus connection disabled. App will continue without real-time events.');
        hasShownWarningRef.current = true;
      }
      return;
    }

    cleanup();
    
    try {
      const es = new EventSource(`${BACKEND_URL}/api/stream/events`);
      eventSourceRef.current = es;
      attemptCountRef.current++;

      es.onopen = () => {
        console.log('[SSE] Connected to event bus');
        setIsConnected(true);
        backoffRef.current = 1000;
        attemptCountRef.current = 0; // Reset on successful connection
        hasShownWarningRef.current = false;
      };

      es.onmessage = (event) => {
        try {
          const data: EventPayload = JSON.parse(event.data);
          
          if (data.type === 'PING') {
            return;
          }

          handleEvent(data);
          
        } catch (e) {
          console.error('[SSE] Failed to parse event', e);
        }
      };

      es.onerror = () => {
        setIsConnected(false);
        es.close();

        // Don't retry - just disable silently
        if (!hasShownWarningRef.current) {
          console.log('[SSE] Event bus connection disabled. App will continue without real-time events.');
          hasShownWarningRef.current = true;
        }
        attemptCountRef.current = maxAttempts; // Stop retrying
      };
    } catch (error) {
      if (!hasShownWarningRef.current) {
        console.log('[SSE] Event bus unavailable. App will continue without real-time events.');
        hasShownWarningRef.current = true;
      }
      attemptCountRef.current = maxAttempts; // Don't retry on initialization errors
    }
  };

  const handleEvent = (event: EventPayload) => {
    switch (event.type) {
      case 'SYSTEM_ALERT':
        if (event.payload?.message) {
          toast(event.payload.message, {
            icon: '🚨',
            style: {
              borderRadius: '10px',
              background: '#1e293b',
              color: '#fff',
              border: '1px solid #3b82f6'
            },
            duration: 6000
          });
        }
        break;
      case 'VOTE_COUNT_UPDATED':
        break;
      case 'NEW_LISTING':
        toast.success(`New Coin Listed!`, {
            style: { background: '#1e293b', color: '#fff' }
        });
        break;
      default:
        break;
    }
  };

  return { isConnected };
}
