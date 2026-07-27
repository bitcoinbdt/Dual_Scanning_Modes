'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';

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
  const maxAttempts = 3; // Stop after 3 failed attempts

  useEffect(() => {
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
      console.log('[SSE] Max connection attempts reached. Event bus disabled.');
      return;
    }

    cleanup();

    console.log('[SSE] Attempting to connect... (Attempt', attemptCountRef.current + 1, ')');
    
    try {
      const es = new EventSource(`${BACKEND_URL}/api/stream/events`);
      eventSourceRef.current = es;
      attemptCountRef.current++;

      es.onopen = () => {
        console.log('[SSE] Connected to EventBus');
        setIsConnected(true);
        backoffRef.current = 1000;
        attemptCountRef.current = 0; // Reset on successful connection
      };

      es.onmessage = (event) => {
        try {
          const data: EventPayload = JSON.parse(event.data);
          
          if (data.type === 'PING') {
            return;
          }

          console.log('[SSE] Received Event:', data);
          handleEvent(data);
          
        } catch (e) {
          console.error('[SSE] Failed to parse event', e);
        }
      };

      es.onerror = (error) => {
        console.warn('[SSE] Connection Error (backend may not be running)', error);
        setIsConnected(false);
        es.close();

        // Only retry if we haven't exceeded max attempts
        if (attemptCountRef.current < maxAttempts) {
          const nextBackoff = Math.min(backoffRef.current * 2, 30000);
          backoffRef.current = nextBackoff;

          console.log(`[SSE] Will retry in ${nextBackoff}ms... (${attemptCountRef.current}/${maxAttempts})`);
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, nextBackoff);
        } else {
          console.log('[SSE] Event bus connection disabled. App will continue without real-time events.');
        }
      };
    } catch (error) {
      console.warn('[SSE] Failed to create EventSource:', error);
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
