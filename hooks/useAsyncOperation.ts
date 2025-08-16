
import { useState, useCallback, useContext } from 'react';
import { useToast } from '../context/ToastContext';

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
    successMessage?: string;
    errorMessage?: string;
}

export function useAsyncOperation<T, P extends any[]>(
  asyncFunction: (...params: P) => Promise<T>,
  options: AsyncOperationOptions<T> = {}
): AsyncOperation<T, P> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const execute = useCallback(async (...params: P) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await asyncFunction(...params);
      setData(result);
      if (options.onSuccess) {
        options.onSuccess(result);
      }
      if (options.successMessage) {
        toast({ title: 'Success', description: options.successMessage });
      }
      return result;
    } catch (e: any) {
      const errorMessage = e.message || options.errorMessage || 'An unexpected error occurred.';
      setError(errorMessage);
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
       if (options.onError) {
        options.onError(e);
      }
      return undefined;
    } finally {
      setIsLoading(false);
    }
  }, [asyncFunction, options, toast]);

  const reset = useCallback(() => {
    setData(null);
    setIsLoading(false);
    setError(null);
  }, []);

  return { data, isLoading, error, execute, setError, reset };
}