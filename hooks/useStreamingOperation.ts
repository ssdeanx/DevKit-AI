

import { useState, useCallback } from 'react';
import { useToast } from '../context/ToastContext';
import { Agent, AgentExecuteStream } from '../agents/types';

interface StreamingOperation<P extends any[]> {
  thoughts: string;
  content: string;
  isLoading: boolean;
  error: string | null;
  agentName: string;
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
  const [agentName, setAgentName] = useState('');
  const { toast } = useToast();

  const execute = useCallback(async (...params: P) => {
    setIsLoading(true);
    setError(null);
    setThoughts('');
    setContent('');
    setAgentName('');
    let operationSucceeded = false;

    try {
      const { agent, stream } = await executeFunction(...params);
      setAgentName(agent.name);
      
      for await (const chunk of stream) {
        if (chunk.type === 'thought') {
          setThoughts(prev => prev + chunk.content);
        } else if (chunk.type === 'content') {
          setContent(prev => prev + chunk.content);
        }
      }
      operationSucceeded = true;

    } catch (e: any) {
      const errorMessage = e.message || 'An unexpected error occurred during the streaming operation.';
      setError(errorMessage);
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
    } finally {
      setIsLoading(false);
       if (operationSucceeded) {
          toast({ title: "Generation Complete", description: `${agentName || 'Agent'} finished successfully.` });
      }
    }
  }, [executeFunction, toast, agentName]);

  const reset = useCallback(() => {
    setThoughts('');
    setContent('');
    setIsLoading(false);
    setError(null);
    setAgentName('');
  }, []);

  return { thoughts, content, isLoading, error, agentName, execute, reset };
}