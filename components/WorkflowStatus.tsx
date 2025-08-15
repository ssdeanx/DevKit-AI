
import React from 'react';
import { WorkflowStep } from '../App';
import { BotIcon, CheckCircleIcon, LoaderIcon } from './icons';
import { cn } from '../lib/utils';

interface WorkflowStatusProps {
    plan: WorkflowStep[];
}

const WorkflowStatus: React.FC<WorkflowStatusProps> = ({ plan }) => {
    if (!plan || plan.length === 0) {
        return null;
    }

    const getStatusIcon = (status: WorkflowStep['status']) => {
        switch (status) {
            case 'completed':
                return <CheckCircleIcon className="w-4 h-4 text-green-400" />;
            case 'in-progress':
                return <LoaderIcon className="w-4 h-4 text-blue-400 animate-spin" />;
            case 'pending':
                return <BotIcon className="w-4 h-4 text-muted-foreground" />;
            default:
                return null;
        }
    };

    return (
        <div className="p-4 mb-4 border rounded-lg bg-secondary/50 animate-in">
            <h3 className="text-sm font-semibold text-foreground mb-3">Executing Plan:</h3>
            <div className="flex items-center space-x-2 overflow-x-auto pb-2">
                {plan.map((step, index) => (
                    <React.Fragment key={step.step}>
                        <div className={cn(
                            "flex-shrink-0 flex flex-col items-center text-center p-3 rounded-lg border transition-all duration-300",
                            step.status === 'in-progress' && 'bg-primary/10 border-primary/50 scale-105',
                            step.status === 'completed' && 'bg-green-500/10 border-green-500/30 opacity-80',
                            step.status === 'pending' && 'bg-muted/50 border-border',
                        )}>
                            <div className="flex items-center gap-2 mb-1">
                                {getStatusIcon(step.status)}
                                <span className="text-sm font-medium text-foreground">{step.agent}</span>
                            </div>
                            <p className="text-xs text-muted-foreground max-w-[150px] truncate" title={step.task}>{step.task}</p>
                        </div>
                        {index < plan.length - 1 && (
                            <div className="w-6 h-px bg-border flex-shrink-0"></div>
                        )}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
};

export default WorkflowStatus;
