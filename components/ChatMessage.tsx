import React from 'react';
import { Message } from '../views/ChatView';
import { useSettings } from '../context/SettingsContext';
import { cn } from '../lib/utils';
import { Card, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { UserIcon, ToolIcon, SparklesIcon, BrainIcon, ThumbsUpIcon, ThumbsDownIcon } from './icons';
import MarkdownRenderer from './MarkdownRenderer';
import { GroundingChunk } from '@google/genai';

interface ChatMessageProps {
    message: Message;
    isLastMessage: boolean;
    isLoading: boolean;
    onFeedback: (messageId: string, rating: 'positive' | 'negative') => void;
}

const SourceList: React.FC<{ sources: GroundingChunk[] }> = ({ sources }) => (
    <div className="mt-4 pt-2 border-t border-border/50">
        <h4 className="text-xs font-semibold text-muted-foreground mb-2">Sources:</h4>
        <div className="flex flex-wrap gap-2">
            {sources.map((source, index) => {
                if ('web' in source && source.web?.uri) {
                    const title = source.web.title || new URL(source.web.uri).hostname.replace('www.', '');
                    return (
                        <a
                            key={index}
                            href={source.web.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs bg-background hover:bg-accent text-accent-foreground py-1 px-2 rounded-full transition-colors border max-w-[200px] truncate"
                            title={source.web.title || source.web.uri}
                        >
                            {index + 1}. {title}
                        </a>
                    );
                }
                return null;
            })}
        </div>
    </div>
);


const ChatMessage: React.FC<ChatMessageProps> = React.memo(({ message, isLastMessage, isLoading, onFeedback }) => {
    const isUser = message.author === 'user';
    const { settings } = useSettings();
    const isAiLoading = message.author === 'ai' && isLastMessage && isLoading;
    const needsCursor = (settings.agentThoughtsStyle === 'terminal' || settings.agentThoughtsStyle === 'matrix') && isAiLoading;

    return (
      <div className={cn("flex items-end gap-3 animate-in w-full", isUser ? "justify-end" : "justify-start")}>
        {!isUser && (
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary flex items-center justify-center border">
             {message.isFunctionCallMessage ? <ToolIcon className="w-5 h-5 text-secondary-foreground" /> : <SparklesIcon className="w-5 h-5 text-primary" />}
          </div>
        )}
        <div className="flex flex-col gap-2 w-full items-start" style={{ alignItems: isUser ? 'flex-end' : 'flex-start' }}>
            {!isUser && message.thoughts && (
              <Card className={cn(
                  "bg-muted/50 animate-in w-full max-w-[80%]",
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
                        needsCursor && message.thoughts && 'typing-cursor'
                    )} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {message.thoughts}
                    </div>
                </CardContent>
              </Card>
            )}
            <div className={cn(
                "group chat-bubble",
                isUser ? "chat-bubble-user" : "chat-bubble-ai",
                message.isFunctionCallMessage && "border border-primary/50 bg-primary/10"
            )}>
                <div className={cn("text-base", message.isFunctionCallMessage && "text-primary/90 italic")}>
                    <MarkdownRenderer content={message.content} />
                    {message.sources && message.sources.length > 0 && <SourceList sources={message.sources} />}
                </div>
                {!isUser && message.content && !message.isFunctionCallMessage && (
                    <div className="mt-2 pt-2 border-t border-border/20 flex justify-between items-center">
                        <span className="text-xs font-mono text-muted-foreground">{message.agentName || 'AI'}</span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="sm" onClick={() => onFeedback(message.id, 'positive')} disabled={message.feedback === 'positive'} className={cn("h-auto p-1", message.feedback === 'positive' ? 'text-green-500' : 'text-muted-foreground hover:text-foreground')} data-tooltip="Good response">
                                <ThumbsUpIcon className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => onFeedback(message.id, 'negative')} disabled={message.feedback === 'negative'} className={cn("h-auto p-1", message.feedback === 'negative' ? 'text-red-500' : 'text-muted-foreground hover:text-foreground')} data-tooltip="Bad response">
                                <ThumbsDownIcon className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
        {isUser && (
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary flex items-center justify-center border">
            <UserIcon className="w-5 h-5 text-secondary-foreground" />
          </div>
        )}
      </div>
    );
});

export default ChatMessage;