

import React, { useState, useEffect, useLayoutEffect, useContext, useRef, useCallback } from 'react';
import { supervisor } from '../services/supervisor';
import { SparklesIcon, ChatIcon, CodeGraphIcon, DocumentIcon, GithubIcon } from '../components/icons';
import { GithubContext } from '../context/GithubContext';
import { historyService } from '../services/history.service';
import { ViewName, WorkflowStep } from '../App';
import { FunctionCall, GroundingChunk, UsageMetadata } from '@google/genai';
import WorkflowVisualizer from '../components/WorkflowVisualizer';
import ViewHeader from '../components/ViewHeader';
import ChatMessage from '../components/ChatMessage';
import ChatInput from '../components/ChatInput';
import FeedbackModal from '../components/FeedbackModal';
import { shortTermMemoryService } from '../services/short-term-memory.service';
import { Button } from '../components/ui/Button';
import RepoStatusIndicator from '../components/RepoStatusIndicator';
import FunctionCallMessage from '../components/FunctionCallMessage';
import { motion } from 'framer-motion';
import { useToast } from '../context/ToastContext';

export type MessageAuthor = 'user' | 'ai';
export type Feedback = 'positive' | 'negative' | null;

export interface Message {
  id: string;
  author: MessageAuthor;
  content: string;
  thoughts?: string;
  agentName?: string;
  feedback: Feedback;
  functionCall?: FunctionCall;
  sources?: GroundingChunk[];
  runId?: string; // New field to track the specific agent execution
}

interface RetryContext {
    originalPrompt: string;
    feedback: string;
}

export interface FeedbackModalState {
    isOpen: boolean;
    messageId: string | null;
    feedbackText: string;
}

const useAutoScroll = (dependencies: any[]): React.RefObject<HTMLDivElement> => {
    const scrollRef = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        const container = scrollRef.current;
        if (container) {
            const isScrolledToBottom = container.scrollHeight - container.clientHeight <= container.scrollTop + 100;
            if (isScrolledToBottom) {
                 container.scrollTop = container.scrollHeight;
            }
        }
    }, dependencies);
    return scrollRef;
};

const BentoPromptExamples: React.FC<{ onSelectPrompt: (prompt: string) => void }> = ({ onSelectPrompt }) => {
    const examples = [
        {
            title: "Analyze Repository",
            description: "Identify potential refactoring opportunities in the staged files.",
            icon: <GithubIcon className="w-16 h-16" />,
            prompt: "Analyze the staged files and identify potential refactoring opportunities.",
        },
        {
            title: "Generate README",
            description: "Create a professional README.md for the loaded project.",
            icon: <DocumentIcon className="w-16 h-16" />,
            prompt: "Generate a professional README for this project based on the staged files.",
        },
        {
            title: "Visualize Code",
            description: "Generate a dependency graph of the current repository.",
            icon: <CodeGraphIcon className="w-16 h-16" />,
            prompt: "Generate a code graph for this repository.",
        }
    ];

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.1, delayChildren: 0.2 },
        },
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: { y: 0, opacity: 1 },
    };

    return (
        <motion.div
            className="bento-grid"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
        >
            {examples.map((item) => (
                <motion.div
                    key={item.title}
                    className="bento-item"
                    variants={itemVariants}
                    onClick={() => onSelectPrompt(item.prompt)}
                >
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                    <div className="bento-icon">{item.icon}</div>
                </motion.div>
            ))}
        </motion.div>
    );
};

const ChatView: React.FC<{ setActiveView: (view: ViewName) => void; }> = ({ setActiveView }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [workflowPlan, setWorkflowPlan] = useState<WorkflowStep[] | null>(null);
  const [feedbackModal, setFeedbackModal] = useState<FeedbackModalState>({ isOpen: false, messageId: null, feedbackText: '' });
  const { repoUrl, fileTree, stagedFiles, apiKey } = useContext(GithubContext);
  const scrollRef = useAutoScroll([messages, workflowPlan]);
  const { toast } = useToast();

  useEffect(() => {
    const history = historyService.getHistory();
    setMessages(history.filter(entry => !entry.functionCall).map(entry => ({...entry, feedback: null})));
  }, []);

  const executeAiTurn = async (prompt: string, retryContext?: RetryContext) => {
    setIsLoading(true);
    setWorkflowPlan(null);
    let finalAgentName = '';
    let finalAiMessage: Message | null = null;
    let currentRunId: string | undefined = undefined;

    try {
        const { agent, stream } = await supervisor.handleRequest(prompt, { fileTree, stagedFiles, apiKey }, { setActiveView }, undefined, retryContext);
        finalAgentName = agent.name;
      
        const aiMessageId = `ai-${Date.now()}`;
        
        const initialAiMessage: Message = { 
            id: aiMessageId, 
            author: 'ai', 
            content: '',
            thoughts: '',
            agentName: agent.name, 
            feedback: null
        };
        setMessages(prev => [...prev, initialAiMessage]);

        let finalContent = '';
        let finalThoughts = '';
        let finalFunctionCall: FunctionCall | undefined = undefined;
        let finalSources: GroundingChunk[] | undefined = undefined;
        let finishReason = '';

        for await (const chunk of stream) {
            if (chunk.type === 'runStart' && chunk.runId) {
                currentRunId = chunk.runId;
            } else if (chunk.type === 'thought') {
                finalThoughts += chunk.content;
            } else if (chunk.type === 'content') {
                finalContent += chunk.content;
            } else if (chunk.type === 'functionCall') {
                finalFunctionCall = chunk.functionCall;
            } else if (chunk.type === 'workflowUpdate' && chunk.plan) {
                setWorkflowPlan(chunk.plan);
            } else if (chunk.type === 'metadata' && chunk.metadata.groundingMetadata) {
                finalSources = chunk.metadata.groundingMetadata.groundingChunks;
            } else if (chunk.type === 'usageMetadata' && workflowPlan) {
                 // This chunk type is now handled by the supervisor for workflows
                 // No action needed here as the plan passed to setWorkflowPlan will contain the usage data
            }
            
            setMessages(prev =>
                prev.map(msg =>
                    msg.id === aiMessageId ? { ...msg, content: finalContent, thoughts: finalThoughts, functionCall: finalFunctionCall, agentName: chunk.agentName || agent.name, sources: finalSources, runId: currentRunId } : msg
                )
            );
        }

        finalAiMessage = {
            id: aiMessageId, author: 'ai', content: finalContent, thoughts: finalThoughts, agentName: agent.name, feedback: null, functionCall: finalFunctionCall, sources: finalSources, runId: currentRunId
        };

        historyService.addEntry(finalAiMessage);

    } catch (error) {
        console.error("ChatView: Error during AI turn:", error);
        let content = error instanceof Error ? error.message : 'Sorry, I encountered an error. Please try again.';
        
        // Specific error handling for token limits
        if (error instanceof Error && (error.message.includes('token') || error.message.includes('finishReason: MAX_TOKENS'))) {
            content = `The response was cut short because it reached the token limit. You can increase the "Max Output Tokens" for the **${finalAgentName || 'current agent'}** in the **Settings** view to allow for longer responses.`;
        }
        
        const errorMessage: Message = {
            id: `err-${Date.now()}`,
            author: 'ai',
            content: content,
            agentName: 'System',
            feedback: null
        };
        setMessages(prev => [...prev, errorMessage]);
    } finally {
        setIsLoading(false);
        if (finalAiMessage) {
            shortTermMemoryService.addEntry(finalAiMessage);
            supervisor.commitSessionToLongTermMemory(finalAgentName);
        }
        if (workflowPlan) {
            setTimeout(() => setWorkflowPlan(null), 5000);
        }
    }
  };

  const handleFormSubmit = async (prompt: string) => {
    if (!prompt.trim() || isLoading) return;

    const userMessage: Message = { 
      id: `user-${Date.now()}`,
      author: 'user', 
      content: prompt,
      feedback: null
    };
    setMessages(prev => [...prev, userMessage]);
    historyService.addEntry(userMessage);
    shortTermMemoryService.addEntry(userMessage);
    
    await executeAiTurn(prompt);
  };
  
  const handleFeedback = useCallback((messageId: string, rating: 'positive' | 'negative') => {
      setMessages(prev => prev.map(msg => 
          msg.id === messageId ? {...msg, feedback: rating} : msg
      ));

      const message = messages.find(msg => msg.id === messageId);
      if (!message || !message.runId) return;

      if (rating === 'negative') {
          setFeedbackModal({ isOpen: true, messageId, feedbackText: '' });
      } else {
          supervisor.recordFeedbackForRun(message.runId, 'positive', null);
          toast({ title: "Feedback Received", description: "Thank you! Your feedback helps the AI improve." });
      }
  }, [messages, toast]);

  const handleFeedbackSubmit = useCallback(async () => {
    if (!feedbackModal.messageId || !feedbackModal.feedbackText.trim()) return;

    const message = messages.find(msg => msg.id === feedbackModal.messageId);
    if (!message || !message.runId) return;

    supervisor.recordFeedbackForRun(message.runId, 'negative', feedbackModal.feedbackText);
    
    const messageIndex = messages.findIndex(msg => msg.id === feedbackModal.messageId);
    if (messageIndex > 0) {
        const userMessage = messages[messageIndex - 1];
        if (userMessage.author === 'user') {
            toast({ title: "Retrying with Feedback", description: "The AI will now attempt to answer again using your feedback." });
            await executeAiTurn(userMessage.content, { originalPrompt: userMessage.content, feedback: feedbackModal.feedbackText });
        }
    }
    setFeedbackModal({ isOpen: false, messageId: null, feedbackText: '' });
  }, [feedbackModal, messages, toast]);

  const handleNewChat = useCallback(() => {
      setMessages([]);
      shortTermMemoryService.clear();
      setIsLoading(false);
      setWorkflowPlan(null);
      toast({ title: "New Chat Started", description: "Your conversation history has been cleared." });
  }, [toast]);

  const getSubheaderText = () => {
    let contextParts = [];
    if (repoUrl) {
      const repoName = repoUrl.split('/').slice(-2).join('/');
      contextParts.push(`Inspecting: ${repoName}`);
    }
    if (stagedFiles.length > 0) {
      contextParts.push(`${stagedFiles.length} file(s) staged.`);
    }
    
    if (contextParts.length === 0) {
        return "Interact with specialized AI agents. Load a repo for context-aware chat.";
    }
    
    return contextParts.join(' | ');
  };

  return (
    <div className="flex flex-col h-full">
       <ViewHeader
        icon={<ChatIcon className="w-6 h-6" />}
        title="Chat"
        description={getSubheaderText()}
       >
        <Button onClick={handleNewChat} variant="outline" size="sm">New Chat</Button>
       </ViewHeader>
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            {workflowPlan && <WorkflowVisualizer plan={workflowPlan} />}
            {messages.map((msg, index) => (
                msg.functionCall ? (
                    <FunctionCallMessage key={msg.id} agentName={msg.agentName} functionCall={msg.functionCall} />
                ) : (
                    <ChatMessage 
                        key={msg.id} 
                        message={msg} 
                        isLastMessage={index === messages.length - 1} 
                        isLoading={isLoading}
                        onFeedback={handleFeedback}
                    />
                )
            ))}
             {messages.length === 0 && !isLoading && (
                <div className="pt-10">
                    <BentoPromptExamples onSelectPrompt={setInputValue} />
                </div>
             )}
        </div>
      
      <div className="p-4 border-t border-border/50">
          <div className="pl-4 mb-2">
            <RepoStatusIndicator />
          </div>
          <div className="chat-input-glow">
            <ChatInput 
              inputValue={inputValue}
              setInputValue={setInputValue}
              isLoading={isLoading}
              onSubmit={handleFormSubmit}
            />
          </div>
      </div>
      
      <FeedbackModal 
        state={feedbackModal}
        setState={setFeedbackModal}
        onSubmit={handleFeedbackSubmit}
      />
    </div>
  );
};

export default ChatView;