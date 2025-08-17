import React from 'react';
import { SparklesIcon, BrainIcon } from './icons';
import { useSettings } from '../context/SettingsContext';
import { cn } from '../lib/utils';

interface GenerationInProgressProps {
    agentName?: string;
    thoughts?: string;
}

const GenerationInProgress: React.FC<GenerationInProgressProps> = ({ agentName, thoughts }) => {
    const { settings } = useSettings();
    const hasThoughts = thoughts && thoughts.trim().length > 0;
    
    return (
        <div className="flex flex-col items-center justify-center h-full text-center p-4 animate-in fade-in">
            <SparklesIcon className="w-12 h-12 text-primary animate-pulse" />
            <h3 className="text-xl font-semibold mt-4">Generating...</h3>
            {agentName && <p className="text-muted-foreground mt-1">The <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-semibold">{agentName}</code> is at work.</p>}

            {hasThoughts && (
                <div className={cn(
                    "mt-6 w-full max-w-lg text-left p-4 rounded-lg border",
                    settings.agentThoughtsStyle === 'default' && 'bg-background/50',
                    settings.agentThoughtsStyle === 'terminal' && 'thoughts-terminal',
                    settings.agentThoughtsStyle === 'blueprint' && 'thoughts-blueprint',
                    settings.agentThoughtsStyle === 'handwritten' && 'thoughts-handwritten',
                    settings.agentThoughtsStyle === 'code-comment' && 'bg-transparent',
                    settings.agentThoughtsStyle === 'matrix' && 'thoughts-matrix',
                    settings.agentThoughtsStyle === 'scroll' && 'thoughts-scroll',
                    settings.agentThoughtsStyle === 'notebook' && 'thoughts-notebook',
                    settings.agentThoughtsStyle === 'gradient-glow' && 'thoughts-gradient-glow',
                    settings.agentThoughtsStyle === 'scientific-journal' && 'thoughts-scientific-journal',
                    settings.agentThoughtsStyle === 'redacted' && 'thoughts-redacted'
                )}>
                    <h4 className="text-xs font-semibold mb-2 flex items-center gap-2">
                        <BrainIcon className="w-4 h-4" />
                        AGENT THOUGHTS
                    </h4>
                    <p className={cn(
                        "text-xs whitespace-pre-wrap font-mono max-h-48 overflow-y-auto custom-scrollbar",
                        settings.agentThoughtsStyle === 'code-comment' && 'thoughts-code-comment-content',
                    )}>
                        {thoughts}
                        <span className="animate-blink">▋</span>
                    </p>
                </div>
            )}
        </div>
    );
};

export default GenerationInProgress;