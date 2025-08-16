
import React, { useState, useEffect, useLayoutEffect, useContext } from 'react';
import { supervisor } from '../services/supervisor';
import { SparklesIcon, ChatIcon } from '../components/icons';
import { GithubContext } from '../context/GithubContext';
import { historyService } from '../services/history.service';
import { ViewName, WorkflowStep } from '../App';
import { FunctionCall, GroundingChunk } from '@google/genai';
import WorkflowVisualizer from '../components/WorkflowVisualizer';
import ExamplePrompts from '../components/ExamplePrompts';
import ViewHeader from '../components/ViewHeader';
import ChatMessage from '../components/ChatMessage';
import ChatInput from '../components/ChatInput';
import FeedbackModal from '../components/FeedbackModal';
import { shortTermMemoryService } from '../services/short-term-memory.service';
import { Button } from '../components/ui/Button';

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
  isFunctionCallMessage?: boolean;
  sources?: GroundingChunk[];
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

const ChatView: React.FC<{ setActiveView: (view: ViewName) => void; }> = ({ setActiveView }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [workflowPlan, setWorkflowPlan] = useState<WorkflowStep[] | null>(null);
  const [feedbackModal, setFeedbackModal] = useState<FeedbackModalState>({ isOpen: false, messageId: null, feedbackText: '' });
  const { repoUrl, fileTree, stagedFiles } = useContext(GithubContext);

  // Load persistent history on initial mount only
  useEffect(() => {
    setMessages(historyService.getHistory().map(entry => ({...entry, feedback: null})));
  }, []);

  const scrollToBottom = () => {
    const container = document.querySelector('#main-scroll-container');
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
  };

  useLayoutEffect(scrollToBottom, [messages, workflowPlan]);

  const executeAiTurn = async (prompt: string, retryContext?: RetryContext) => {
    setIsLoading(true);
    setWorkflowPlan(null);
    let finalAgentName = '';
    let finalAiMessage: Message | null = null;

    try {
        const { agent, stream } = await supervisor.handleRequest(prompt, { fileTree, stagedFiles }, { setActiveView }, undefined, retryContext);
        finalAgentName = agent.name;
      
        const aiMessageId = `ai-${Date.now()}`;
        
        const initialAiMessage: Message = { 
            id: aiMessageId, 
            author: 'ai', 
            content: '',
            thoughts: '',
            agentName: agent.name, 
            feedback: null,
            isFunctionCallMessage: false
        };
        setMessages(prev => [...prev, initialAiMessage]);

        let finalContent = '';
        let finalThoughts = '';
        let finalFunctionCall: FunctionCall | undefined = undefined;
        let finalSources: GroundingChunk[] | undefined = undefined;
        let isFunctionCallMessage = false;

        for await (const chunk of stream) {
            if (chunk.type === 'thought') {
                finalThoughts += chunk.content;
            } else if (chunk.type === 'content') {
                finalContent += chunk.content;
            } else if (chunk.type === 'functionCall') {
                finalFunctionCall = chunk.functionCall;
                finalContent = `Executing tool: \`${chunk.functionCall.name}\` with arguments: \`${JSON.stringify(chunk.functionCall.args)}\``;
                isFunctionCallMessage = true;
            } else if (chunk.type === 'workflowUpdate' && chunk.plan) {
                setWorkflowPlan(chunk.plan);
            } else if (chunk.type === 'metadata' && chunk.metadata.groundingMetadata) {
                finalSources = chunk.metadata.groundingMetadata.groundingChunks;
            }
            
            setMessages(prev =>
                prev.map(msg =>
                    msg.id === aiMessageId ? { ...msg, content: finalContent, thoughts: finalThoughts, functionCall: finalFunctionCall, isFunctionCallMessage, agentName: chunk.agentName || agent.name, sources: finalSources } : msg
                )
            );
        }

        finalAiMessage = {
            id: aiMessageId, author: 'ai', content: finalContent, thoughts: finalThoughts, agentName: agent.name, feedback: null, isFunctionCallMessage, sources: finalSources
        };

        historyService.addEntry(finalAiMessage);

    } catch (error) {
        console.error("ChatView: Error during AI turn:", error);
        const errorMessage: Message = {
            id: `err-${Date.now()}`,
            author: 'ai',
            content: 'Sorry, I encountered an error. Please try again.',
            agentName: 'System',
            feedback: null
        };
        setMessages(prev => [...prev, errorMessage]);
    } finally {
        setIsLoading(false);
        if (finalAiMessage) {
            shortTermMemoryService.addEntry(finalAiMessage);
            // After the turn is complete, trigger memory consolidation
            supervisor.commitSessionToLongTermMemory(finalAgentName);
        }
        if (workflowPlan) {
            setTimeout(() => setWorkflowPlan(null), 3000);
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
  
  const handleFeedback = (messageId: string, rating: 'positive' | 'negative') => {
      setMessages(prev => prev.map(msg => 
          msg.id === messageId ? {...msg, feedback: rating} : msg
      ));

      const message = messages.find(msg => msg.id === messageId);
      if (!message) return;

      if (rating === 'negative') {
          setFeedbackModal({ isOpen: true, messageId, feedbackText: '' });
      } else {
          supervisor.recordFeedback(messageId, 'positive', null, message.agentName);
      }
  };

  const handleFeedbackSubmit = async () => {
    if (!feedbackModal.messageId || !feedbackModal.feedbackText.trim()) return;

    const message = messages.find(msg => msg.id === feedbackModal.messageId);
    if (!message) return;

    supervisor.recordFeedback(feedbackModal.messageId, 'negative', feedbackModal.feedbackText, message.agentName);
    
    const messageIndex = messages.findIndex(msg => msg.id === feedbackModal.messageId);
    if (messageIndex > 0) {
        const userMessage = messages[messageIndex - 1];
        if (userMessage.author === 'user') {
            await executeAiTurn(userMessage.content, { originalPrompt: userMessage.content, feedback: feedbackModal.feedbackText });
        }
    }
    setFeedbackModal({ isOpen: false, messageId: null, feedbackText: '' });
  };

  const handleNewChat = () => {
      setMessages([]);
      shortTermMemoryService.clear();
      setIsLoading(false);
      setWorkflowPlan(null);
  };

  const examplePrompts = [
    "Create a sequence diagram for a user login flow using Mermaid.js.",
    "Who won the 2024 Le Mans?",
    "Research the top 3 frontend frameworks, then write a comparison table in markdown.",
    "Navigate to the settings and change ChatAgent's temperature to 0.8"
  ];

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
        <div id="main-scroll-container" className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            {workflowPlan && <WorkflowVisualizer plan={workflowPlan} />}
            {messages.map((msg, index) => (
              <ChatMessage 
                key={msg.id} 
                message={msg} 
                isLastMessage={index === messages.length - 1} 
                isLoading={isLoading}
                onFeedback={handleFeedback}
              />
            ))}
            {isLoading && messages[messages.length - 1]?.author === 'user' && (
                <div className="flex items-end gap-3 animate-in">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary flex items-center justify-center border">
                      <SparklesIcon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="chat-bubble chat-bubble-ai flex items-center gap-2">
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse-dot" style={{animationDelay: '0s'}}></div>
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse-dot" style={{animationDelay: '0.2s'}}></div>
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse-dot" style={{animationDelay: '0.4s'}}></div>
                  </div>
                </div>
            )}
             {messages.length === 0 && !isLoading && (
                <div className="pt-10">
                    <ExamplePrompts prompts={examplePrompts} onSelectPrompt={setInputValue} />
                </div>
             )}
        </div>

      <ChatInput 
        inputValue={inputValue}
        setInputValue={setInputValue}
        isLoading={isLoading}
        onSubmit={handleFormSubmit}
      />
      
      <FeedbackModal 
        state={feedbackModal}
        setState={setFeedbackModal}
        onSubmit={handleFeedbackSubmit}
      />
    </div>
  );
};

export default ChatView;
