import { useState, useCallback } from 'react';

interface AsyncOperation<T, P extends any[]> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  execute: (...params: P) => Promise<T | undefined>;
  setError: (error: string | null) => void;
  reset: () => void;
}

interface AsyncOperationOptions<T> {
    onSuccess?: (data: T) => void;
    onError?: (error: Error) => void;
}

export function useAsyncOperation<T, P extends any[]>(
  asyncFunction: (...params: P) => Promise<T>,
  options: AsyncOperationOptions<T> = {}
): AsyncOperation<T, P> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async (...params: P) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await asyncFunction(...params);
      setData(result);
      if (options.onSuccess) {
        options.onSuccess(result);
      }
      return result;
    } catch (e: any) {
      const errorMessage = e.message || 'An unexpected error occurred.';
      setError(errorMessage);
       if (options.onError) {
        options.onError(e);
      }
      // Return undefined or throw to let the caller know it failed
      return undefined;
    } finally {
      setIsLoading(false);
    }
  }, [asyncFunction, options]);

  const reset = useCallback(() => {
    setData(null);
    setIsLoading(false);
    setError(null);
  }, []);

  return { data, isLoading, error, execute, setError, reset };
}
