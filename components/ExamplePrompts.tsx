import React from 'react';
import { Button } from './ui/Button';
import { LightbulbIcon } from './icons';

interface ExamplePromptsProps {
    prompts: string[];
    onSelectPrompt: (prompt: string) => void;
    title?: string;
}

const ExamplePrompts: React.FC<ExamplePromptsProps> = React.memo(({ prompts, onSelectPrompt, title = "Or try an example:" }) => (
    <div className="mb-4 animate-in">
        <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <LightbulbIcon className="w-4 h-4"/>
            {title}
        </h4>
        <div className="flex flex-wrap gap-2">
            {prompts.map((prompt, index) => (
                <button
                    key={index}
                    className="text-sm border rounded-full py-1.5 px-4 bg-secondary/50 hover:bg-secondary transition-colors card-interactive"
                    onClick={() => onSelectPrompt(prompt)}
                >
                    {prompt}
                </button>
            ))}
        </div>
    </div>
));

export default ExamplePrompts;