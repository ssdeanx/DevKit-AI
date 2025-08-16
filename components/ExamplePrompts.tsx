import React from 'react';
import { Button } from './ui/Button';
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
      <div className="flex flex-wrap gap-2">
        {prompts.map((prompt, index) => (
          <Button
            key={index}
            variant="outline"
            size="sm"
            onClick={() => onSelectPrompt(prompt)}
            className="text-xs h-auto py-1 px-2.5"
          >
            {prompt}
          </Button>
        ))}
      </div>
    </div>
  );
};

export default ExamplePrompts;
