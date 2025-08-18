import React from 'react';
import { LightbulbIcon } from './icons';

interface ExamplePromptsProps {
  prompts: string[];
  onSelectPrompt: (prompt: string) => void;
}

const ExamplePrompts: React.FC<ExamplePromptsProps> = ({ prompts, onSelectPrompt }) => {
  if (!prompts || prompts.length === 0) {
    return null;
  }

  return (
    <div className="mb-4">
      <div className="flex items-center text-xs text-muted-foreground mb-2">
        <LightbulbIcon className="w-4 h-4 mr-2" />
        <span>Try an example:</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
        {prompts.map((prompt, index) => (
          <button
            key={index}
            onClick={() => onSelectPrompt(prompt)}
            className="text-left p-3 border rounded-lg hover:bg-accent hover:border-primary/50 focus:ring-2 focus:ring-ring focus:outline-none transition-all text-sm text-muted-foreground h-full"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ExamplePrompts;