
import React, { FormEvent } from 'react';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { SendIcon } from './icons';

interface ChatInputProps {
    inputValue: string;
    setInputValue: (value: string) => void;
    isLoading: boolean;
    onSubmit: (prompt: string) => void;
}

const ChatInput: React.FC<ChatInputProps> = ({ inputValue, setInputValue, isLoading, onSubmit }) => {
    
    const handleFormSubmit = (e: FormEvent) => {
        e.preventDefault();
        onSubmit(inputValue);
        setInputValue('');
    };

    return (
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
    );
};

export default ChatInput;
