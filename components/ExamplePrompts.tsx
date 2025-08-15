import React from 'react';
import { Button } from './ui/Button';

interface ExamplePromptsProps {
    prompts: string[];
    onSelectPrompt: (prompt: string) => void;
    title?: string;
}

const ExamplePrompts: React.FC<ExamplePromptsProps> = ({ prompts, onSelectPrompt, title = "Or try an example:" }) => (
    <div className="mb-4 animate-in">
        <h4 className="text-sm font-semibold text-muted-foreground mb-2">{title}</h4>
        <div className="flex flex-wrap gap-2">
            {prompts.map((prompt, index) => (
                <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    className="text-xs h-auto py-1.5 px-3 bg-background/50 backdrop-blur-sm"
                    onClick={() => onSelectPrompt(prompt)}
                >
                    {prompt}
                </Button>
            ))}
        </div>
    </div>
);

export default ExamplePrompts;
