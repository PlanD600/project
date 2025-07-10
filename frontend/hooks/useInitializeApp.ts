import { useState, useCallback } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { useDataStore } from '../stores/useDataStore';

export function useInitializeApp() {
  const { checkAuthStatus, isAuthenticated } = useAuthStore();
  const { bootstrapApp } = useDataStore();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const initialize = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await checkAuthStatus();
      if (localStorage.getItem('token')) {
        await bootstrapApp();
      }
      setReady(true);
    } catch (err) {
      setError((err as Error).message || 'Initialization failed');
    } finally {
      setIsLoading(false);
    }
  }, [checkAuthStatus, bootstrapApp]);

  return { isLoading, error, ready, initialize, isAuthenticated };
} 