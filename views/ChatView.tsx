import React, { useState, useEffect, useRef, FormEvent, useContext } from 'react';
import { supervisor } from '../services/supervisor';
import { UserIcon, BotIcon, ThumbsUpIcon, ThumbsDownIcon, BrainIcon, ToolIcon } from '../components/icons';
import { GithubContext } from '../context/GithubContext';
import { historyService } from '../services/history.service';
import { Card, CardContent, CardFooter } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { cn } from '../lib/utils';
import { useSettings } from '../context/SettingsContext';
import { ViewName, WorkflowStep } from '../App';
import { FunctionCall, GroundingChunk } from '@google/genai';
import WorkflowStatus from '../components/WorkflowStatus';
import ExamplePrompts from '../components/ExamplePrompts';
import MarkdownRenderer from '../components/MarkdownRenderer';

type MessageAuthor = 'user' | 'ai';
type Feedback = 'positive' | 'negative' | null;

interface Message {
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

const useTypewriter = (text: string, speed = 20) => {
    const [displayText, setDisplayText] = useState('');
  
    useEffect(() => {
        setDisplayText(''); 
        if (!text) return;
        
        let i = 0;
        const intervalId = setInterval(() => {
            if (i < text.length) {
                setDisplayText(prev => prev + text.charAt(i));
                i++;
            } else {
                clearInterval(intervalId);
            }
        }, speed);

        return () => clearInterval(intervalId);
    }, [text, speed]);
  
    return displayText;
};

const ChatView: React.FC<{ setActiveView: (view: ViewName) => void; }> = ({ setActiveView }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeAgentName, setActiveAgentName] = useState<string | null>(null);
  const [workflowPlan, setWorkflowPlan] = useState<WorkflowStep[] | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { repoUrl, fileTree } = useContext(GithubContext);

  useEffect(() => {
    setMessages(historyService.getHistory().map(entry => ({...entry, feedback: null})));
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages, workflowPlan]);

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = { 
      id: `user-${Date.now()}`,
      author: 'user', 
      content: inputValue,
      feedback: null
    };
    setMessages(prev => [...prev, userMessage]);
    historyService.addEntry({id: userMessage.id, author: 'user', content: inputValue});
    
    console.log(`ChatView: Sending message to supervisor: "${inputValue}"`);
    setInputValue('');
    setIsLoading(true);
    setWorkflowPlan(null);

    try {
      const { agent, stream } = await supervisor.handleRequest(inputValue, fileTree, { setActiveView });
      setActiveAgentName(agent.name);
      
      const aiMessageId = `ai-${Date.now()}`;
      let finalContent = '';
      let finalThoughts = '';
      let finalFunctionCall: FunctionCall | undefined = undefined;
      let finalSources: GroundingChunk[] | undefined = undefined;
      let isFunctionCallMessage = false;
      
      setMessages(prev => [...prev, { 
        id: aiMessageId, 
        author: 'ai', 
        content: '',
        thoughts: '',
        agentName: agent.name, 
        feedback: null,
        isFunctionCallMessage: false
      }]);

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
      historyService.addEntry({id: aiMessageId, author: 'ai', content: finalContent, thoughts: finalThoughts, agentName: agent.name});

    } catch (error) {
      console.error("ChatView: Error sending message:", error);
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
      setActiveAgentName(null);
      // Keep the workflow plan visible after completion
      if (workflowPlan) {
        setWorkflowPlan(plan => plan ? plan.map(step => ({...step, status: 'completed'})) : null);
      }
    }
  };
  
  const handleFeedback = (messageId: string, rating: 'positive' | 'negative') => {
      setMessages(prev => prev.map(msg => 
          msg.id === messageId ? {...msg, feedback: rating} : msg
      ));

      const message = messages.find(msg => msg.id === messageId);
      if (!message) return;

      if (rating === 'negative') {
          const reason = window.prompt("What went wrong? (Optional)");
          supervisor.recordFeedback(messageId, 'negative', reason, message.agentName);
      } else {
          supervisor.recordFeedback(messageId, 'positive', null, message.agentName);
      }
  };

  const ChatMessage: React.FC<{ message: Message }> = ({ message }) => {
    const isUser = message.author === 'user';
    const [showThoughts, setShowThoughts] = useState(false);
    const { settings } = useSettings();
    const animatedThoughts = useTypewriter(showThoughts ? message.thoughts || '' : '', 10);
    const needsCursor = settings.agentThoughtsStyle === 'terminal' || settings.agentThoughtsStyle === 'matrix';

    return (
      <div className={cn("flex items-start gap-4 animate-in", isUser ? "justify-end" : "")}>
        {!isUser && (
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
             {message.isFunctionCallMessage ? <ToolIcon className="w-6 h-6 text-secondary-foreground" /> : <BotIcon className="w-6 h-6 text-secondary-foreground" />}
          </div>
        )}
        <div className="flex flex-col gap-2 w-full max-w-[80%]">
            <Card className={cn(
                "group",
                isUser ? "bg-primary text-primary-foreground" : "bg-secondary",
                message.isFunctionCallMessage && "border-primary/50 bg-primary/10"
            )}>
                <CardContent className={cn("p-3 text-sm", message.isFunctionCallMessage && "text-primary/90 italic")}>
                    <MarkdownRenderer content={message.content} />
                    {message.sources && message.sources.length > 0 && (
                        <div className="mt-4 pt-2 border-t border-border/50">
                            <h4 className="text-xs font-semibold text-muted-foreground mb-2">Sources:</h4>
                            <div className="flex flex-wrap gap-2">
                                {message.sources.map((source, index) => (
                                    'web' in source && source.web && <a
                                        key={index}
                                        href={source.web.uri}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs bg-background hover:bg-accent text-accent-foreground py-1 px-2 rounded-full transition-colors"
                                    >
                                        {index + 1}. {source.web.title || new URL(source.web.uri).hostname}
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
                {!isUser && message.content && !message.isFunctionCallMessage && (
                    <CardFooter className="p-2 border-t justify-between items-center">
                        <span className="text-xs font-mono text-muted-foreground bg-background px-2 py-1 rounded">{message.agentName || 'AI Assistant'}</span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {message.thoughts && (
                              <Button variant="ghost" size="sm" onClick={() => setShowThoughts(!showThoughts)} className="h-auto p-1 text-muted-foreground hover:text-foreground">
                                <BrainIcon className="w-4 h-4"/>
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => handleFeedback(message.id, 'positive')} disabled={message.feedback === 'positive'} className={cn("h-auto p-1", message.feedback === 'positive' ? 'text-green-400' : 'text-muted-foreground hover:text-foreground')}>
                                <ThumbsUpIcon className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleFeedback(message.id, 'negative')} disabled={message.feedback === 'negative'} className={cn("h-auto p-1", message.feedback === 'negative' ? 'text-red-400' : 'text-muted-foreground hover:text-foreground')}>
                                <ThumbsDownIcon className="w-4 h-4" />
                            </Button>
                        </div>
                    </CardFooter>
                )}
            </Card>
            {showThoughts && message.thoughts && (
              <Card className={cn(
                  "bg-muted animate-in",
                  settings.agentThoughtsStyle === 'terminal' && 'thoughts-terminal',
                  settings.agentThoughtsStyle === 'blueprint' && 'thoughts-blueprint',
                  settings.agentThoughtsStyle === 'handwritten' && 'thoughts-handwritten',
                  settings.agentThoughtsStyle === 'code-comment' && 'thoughts-code-comment',
                  settings.agentThoughtsStyle === 'matrix' && 'thoughts-matrix',
                  settings.agentThoughtsStyle === 'scroll' && 'thoughts-scroll',
              )}>
                <CardContent className="p-3">
                    <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-2"><BrainIcon className="w-4 h-4" /> AGENT THOUGHTS</h4>
                    <div className={cn(
                        "text-xs min-h-[20px]",
                        settings.agentThoughtsStyle === 'default' && 'text-muted-foreground',
                        settings.agentThoughtsStyle === 'terminal' && 'text-[#C9D1D9]',
                        settings.agentThoughtsStyle === 'matrix' && 'text-green-400',
                        settings.agentThoughtsStyle === 'handwritten' && 'text-[#4A4A4A]',
                        settings.agentThoughtsStyle === 'code-comment' && 'thoughts-code-comment-content text-[#6A9955]',
                        settings.agentThoughtsStyle === 'scroll' && 'text-[#5C4033]',
                        needsCursor && 'typing-cursor'
                    )} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {animatedThoughts}
                    </div>
                </CardContent>
              </Card>
            )}
        </div>
        {isUser && (
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
            <UserIcon className="w-6 h-6 text-secondary-foreground" />
          </div>
        )}
      </div>
    );
  };

  const examplePrompts = [
    "Create a sequence diagram for a user login flow using Mermaid.js.",
    "Who won the 2024 Le Mans?",
    "Research the top 3 frontend frameworks, then write a comparison table in markdown.",
    "Navigate to the settings and change ChatAgent's temperature to 0.8"
  ];

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="p-6 border-b glass-effect">
        <h1 className="text-2xl font-bold text-foreground animate-text-gradient bg-gradient-to-r from-primary via-muted-foreground to-primary">Chat</h1>
        <p className="text-sm text-muted-foreground">
          {repoUrl 
            ? <>Currently inspecting: <span className="font-mono text-primary/80">{repoUrl}</span></>
            : "Interact with specialized AI agents. Load a repo for context-aware chat."
          }
        </p>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {workflowPlan && <WorkflowStatus plan={workflowPlan} />}
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
         {isLoading && (
            <div className="flex items-start gap-4 animate-in">
               <div className="flex-shrink-0 w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                  <BotIcon className="w-6 h-6 text-secondary-foreground" />
              </div>
              <div className="w-full max-w-[80%]">
                <Card className="bg-secondary">
                  <CardContent className="p-3 text-sm text-muted-foreground">
                    <span className="animate-pulse">{activeAgentName || 'AI'} is thinking...</span>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-6 bg-background border-t glass-effect">
        {messages.length === 0 && !isLoading && (
            <ExamplePrompts prompts={examplePrompts} onSelectPrompt={setInputValue} />
        )}
        <form onSubmit={handleSendMessage} className="flex items-center space-x-4">
          <Input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type your message here..."
            className="flex-1"
            disabled={isLoading}
            aria-label="Chat input"
          />
          <Button
            type="submit"
            size="lg"
            disabled={isLoading || !inputValue.trim()}
            aria-label="Send message"
          >
            Send
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ChatView;