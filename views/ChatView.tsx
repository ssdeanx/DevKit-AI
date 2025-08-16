import React, { useState, useEffect, useRef, FormEvent, useContext } from 'react';
import { supervisor } from '../services/supervisor';
import { UserIcon, BotIcon, ThumbsUpIcon, ThumbsDownIcon, BrainIcon, ToolIcon, SparklesIcon, SendIcon, ChatIcon } from '../components/icons';
import { GithubContext } from '../context/GithubContext';
import { historyService } from '../services/history.service';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { cn } from '../lib/utils';
import { useSettings } from '../context/SettingsContext';
import { ViewName, WorkflowStep } from '../App';
import { FunctionCall, GroundingChunk } from '@google/genai';
import WorkflowStatus from '../components/WorkflowStatus';
import ExamplePrompts from '../components/ExamplePrompts';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { Textarea } from '../components/ui/Textarea';
import { Label } from '../components/ui/Label';
import ViewHeader from '../components/ViewHeader';

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

interface RetryContext {
    originalPrompt: string;
    feedback: string;
}

interface FeedbackModalState {
    isOpen: boolean;
    messageId: string | null;
    feedbackText: string;
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
  const [feedbackModal, setFeedbackModal] = useState<FeedbackModalState>({ isOpen: false, messageId: null, feedbackText: '' });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { repoUrl, fileTree, stagedFiles } = useContext(GithubContext);

  useEffect(() => {
    setMessages(historyService.getHistory().map(entry => ({...entry, feedback: null})));
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages, workflowPlan]);

  const executeAiTurn = async (prompt: string, retryContext?: RetryContext) => {
    setIsLoading(true);
    setWorkflowPlan(null);
    let finalAgentName = '';

    try {
        const { agent, stream } = await supervisor.handleRequest(prompt, { fileTree, stagedFiles }, { setActiveView }, undefined, retryContext);
        setActiveAgentName(agent.name);
        finalAgentName = agent.name;
      
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
        
        await supervisor.saveKnowledgeIfApplicable(finalAgentName, finalContent);

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
        setActiveAgentName(null);
        if (workflowPlan) {
            setWorkflowPlan(plan => plan ? plan.map(step => ({...step, status: 'completed'})) : null);
        }
    }
  };


  const handleFormSubmit = async (e: FormEvent) => {
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
    
    const prompt = inputValue;
    setInputValue('');
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


  const ChatMessage: React.FC<{ message: Message }> = ({ message }) => {
    const isUser = message.author === 'user';
    const [showThoughts, setShowThoughts] = useState(false);
    const { settings } = useSettings();
    const animatedThoughts = useTypewriter(showThoughts ? message.thoughts || '' : '', 10);
    const needsCursor = settings.agentThoughtsStyle === 'terminal' || settings.agentThoughtsStyle === 'matrix';

    return (
      <div className={cn("flex items-end gap-3 animate-in w-full", isUser ? "justify-end" : "justify-start")}>
        {!isUser && (
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary flex items-center justify-center border">
             {message.isFunctionCallMessage ? <ToolIcon className="w-5 h-5 text-secondary-foreground" /> : <SparklesIcon className="w-5 h-5 text-primary" />}
          </div>
        )}
        <div className="flex flex-col gap-2 w-full items-start" style={{ alignItems: isUser ? 'flex-end' : 'flex-start' }}>
            <div className={cn(
                "group chat-bubble",
                isUser ? "chat-bubble-user" : "chat-bubble-ai",
                message.isFunctionCallMessage && "border border-primary/50 bg-primary/10"
            )}>
                <div className={cn("text-base", message.isFunctionCallMessage && "text-primary/90 italic")}>
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
                                        className="text-xs bg-background hover:bg-accent text-accent-foreground py-1 px-2 rounded-full transition-colors border"
                                    >
                                        {index + 1}. {source.web.title || new URL(source.web.uri).hostname}
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                {!isUser && message.content && !message.isFunctionCallMessage && (
                    <div className="mt-2 pt-2 border-t border-border/20 flex justify-between items-center">
                        <span className="text-xs font-mono text-muted-foreground">{message.agentName || 'AI'}</span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {message.thoughts && (
                              <Button variant="ghost" size="sm" onClick={() => setShowThoughts(!showThoughts)} className="h-auto p-1 text-muted-foreground hover:text-foreground" data-tooltip="View Thoughts">
                                <BrainIcon className="w-4 h-4"/>
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => handleFeedback(message.id, 'positive')} disabled={message.feedback === 'positive'} className={cn("h-auto p-1", message.feedback === 'positive' ? 'text-green-500' : 'text-muted-foreground hover:text-foreground')} data-tooltip="Good response">
                                <ThumbsUpIcon className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleFeedback(message.id, 'negative')} disabled={message.feedback === 'negative'} className={cn("h-auto p-1", message.feedback === 'negative' ? 'text-red-500' : 'text-muted-foreground hover:text-foreground')} data-tooltip="Bad response">
                                <ThumbsDownIcon className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>
            {showThoughts && message.thoughts && (
              <Card className={cn(
                  "bg-muted/50 animate-in w-full",
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
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary flex items-center justify-center border">
            <UserIcon className="w-5 h-5 text-secondary-foreground" />
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
    <div className="flex flex-col h-full bg-transparent">
       <ViewHeader
        icon={<ChatIcon className="w-6 h-6" />}
        title="Chat"
        description={getSubheaderText()}
       />

      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
        {workflowPlan && <WorkflowStatus plan={workflowPlan} />}
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
         {isLoading && (
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
        <div ref={messagesEndRef} />
      </div>

      <div className="p-6 bg-transparent border-t">
        {messages.length === 0 && !isLoading && (
            <ExamplePrompts prompts={examplePrompts} onSelectPrompt={setInputValue} />
        )}
        <form onSubmit={handleFormSubmit} className="relative">
          <Input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask me anything..."
            className="w-full h-12 text-base rounded-full pr-14 pl-5"
            disabled={isLoading}
            aria-label="Chat input"
          />
          <Button
            type="submit"
            size="icon"
            disabled={isLoading || !inputValue.trim()}
            aria-label="Send message"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full w-9 h-9"
            data-tooltip="Send"
          >
            <SendIcon className="w-5 h-5" />
          </Button>
        </form>
      </div>
      {feedbackModal.isOpen && (
          <div className="feedback-modal-overlay">
              <div className="feedback-modal-content">
                  <Card>
                      <CardHeader>
                          <CardTitle>Provide Feedback</CardTitle>
                          <CardDescription>Your feedback helps the AI improve. What went wrong with the response?</CardDescription>
                      </CardHeader>
                      <CardContent>
                          <div className="space-y-2">
                              <Label htmlFor="feedback-text">Feedback</Label>
                              <Textarea
                                  id="feedback-text"
                                  placeholder="e.g., The code provided had a syntax error."
                                  value={feedbackModal.feedbackText}
                                  onChange={(e) => setFeedbackModal({ ...feedbackModal, feedbackText: e.target.value })}
                                  className="min-h-[100px]"
                              />
                          </div>
                      </CardContent>
                      <CardFooter className="flex justify-end gap-2">
                           <Button variant="ghost" onClick={() => setFeedbackModal({ isOpen: false, messageId: null, feedbackText: '' })}>Cancel</Button>
                           <Button onClick={handleFeedbackSubmit} disabled={!feedbackModal.feedbackText.trim()}>Submit & Retry</Button>
                      </CardFooter>
                  </Card>
              </div>
          </div>
      )}
    </div>
  );
};

export default ChatView;