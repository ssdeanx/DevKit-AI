
import { useState, useCallback } from 'react';
import { useToast } from '../context/ToastContext';
import { Agent, AgentExecuteStream } from '../agents/types';

interface StreamingOperation<P extends any[]> {
  thoughts: string;
  content: string;
  isLoading: boolean;
  error: string | null;
  execute: (...params: P) => Promise<void>;
  reset: () => void;
}

export function useStreamingOperation<P extends any[]>(
  executeFunction: (...params: P) => Promise<{ agent: Agent, stream: AgentExecuteStream }>
): StreamingOperation<P> {
  const [thoughts, setThoughts] = useState('');
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const execute = useCallback(async (...params: P) => {
    setIsLoading(true);
    setError(null);
    setThoughts('');
    setContent('');

    try {
      const { stream } = await executeFunction(...params);
      
      for await (const chunk of stream) {
        if (chunk.type === 'thought') {
          setThoughts(prev => prev + chunk.content);
        } else if (chunk.type === 'content') {
          setContent(prev => prev + chunk.content);
        }
      }

    } catch (e: any) {
      const errorMessage = e.message || 'An unexpected error occurred during the streaming operation.';
      setError(errorMessage);
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [executeFunction, toast]);

  const reset = useCallback(() => {
    setThoughts('');
    setContent('');
    setIsLoading(false);
    setError(null);
  }, []);

  return { thoughts, content, isLoading, error, execute, reset };
}
