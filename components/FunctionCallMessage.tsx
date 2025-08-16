
import React from 'react';
import { FunctionCall } from '@google/genai';
import { ToolIcon } from './icons';

interface FunctionCallMessageProps {
    agentName?: string;
    functionCall: FunctionCall;
}

const FunctionCallMessage: React.FC<FunctionCallMessageProps> = ({ agentName, functionCall }) => {
    return (
        <div className="flex items-start gap-3 animate-in w-full justify-start">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary flex items-center justify-center border">
                <ToolIcon className="w-5 h-5 text-secondary-foreground" />
            </div>
            <div className="border rounded-lg p-3 max-w-[80%] bg-secondary/50">
                <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-mono text-muted-foreground">{agentName || 'AI'} is using a tool</span>
                </div>
                <div className="bg-background/50 p-2 rounded">
                    <p className="font-mono text-sm text-foreground font-semibold">{functionCall.name}</p>
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-all mt-1">
                        {JSON.stringify(functionCall.args, null, 2)}
                    </pre>
                </div>
            </div>
        </div>
    );
};

export default FunctionCallMessage;