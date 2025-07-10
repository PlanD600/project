// To run these tests, ensure you have @testing-library/react and @types/jest installed as dev dependencies.
import { renderHook, act } from '@testing-library/react';
import { useInitializeApp } from './useInitializeApp';

// Mock Zustand stores
jest.mock('../stores/useAuthStore', () => ({
  useAuthStore: () => ({
    checkAuthStatus: jest.fn(),
    isAuthenticated: false,
  })
}));
jest.mock('../stores/useDataStore', () => ({
  useDataStore: () => ({
    bootstrapApp: jest.fn(),
  })
}));

describe('useInitializeApp', () => {
  it('runs sequentially and sets ready when successful', async () => {
    const checkAuthStatus = jest.fn().mockResolvedValue(undefined);
    const bootstrapApp = jest.fn().mockResolvedValue(undefined);
    jest.spyOn(require('../stores/useAuthStore'), 'useAuthStore').mockReturnValue({ checkAuthStatus, isAuthenticated: true });
    jest.spyOn(require('../stores/useDataStore'), 'useDataStore').mockReturnValue({ bootstrapApp });

    const { result } = renderHook(() => useInitializeApp());
    await act(async () => {
      await result.current.initialize();
    });
    expect(checkAuthStatus).toHaveBeenCalledTimes(1);
    expect(bootstrapApp).toHaveBeenCalledTimes(1);
    expect(result.current.ready).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('sets error if checkAuthStatus fails', async () => {
    const checkAuthStatus = jest.fn().mockRejectedValue(new Error('Auth failed'));
    const bootstrapApp = jest.fn();
    jest.spyOn(require('../stores/useAuthStore'), 'useAuthStore').mockReturnValue({ checkAuthStatus, isAuthenticated: false });
    jest.spyOn(require('../stores/useDataStore'), 'useDataStore').mockReturnValue({ bootstrapApp });

    const { result } = renderHook(() => useInitializeApp());
    await act(async () => {
      await result.current.initialize();
    });
    expect(result.current.error).toBe('Auth failed');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.ready).toBe(false);
  });

  it('sets error if bootstrapApp fails', async () => {
    const checkAuthStatus = jest.fn().mockResolvedValue(undefined);
    const bootstrapApp = jest.fn().mockRejectedValue(new Error('Bootstrap failed'));
    jest.spyOn(require('../stores/useAuthStore'), 'useAuthStore').mockReturnValue({ checkAuthStatus, isAuthenticated: true });
    jest.spyOn(require('../stores/useDataStore'), 'useDataStore').mockReturnValue({ bootstrapApp });

    const { result } = renderHook(() => useInitializeApp());
    await act(async () => {
      await result.current.initialize();
    });
    expect(result.current.error).toBe('Bootstrap failed');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.ready).toBe(false);
  });
}); 