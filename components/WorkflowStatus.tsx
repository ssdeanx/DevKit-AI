import React, { useState } from 'react';
import { WorkflowStep } from '../App';
import { BotIcon, CheckCircleIcon, ChevronDownIcon, LoaderIcon, WorkflowIcon } from './icons';
import { cn } from '../lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/Card';
import MarkdownRenderer from './MarkdownRenderer';

interface WorkflowStatusProps {
    plan: WorkflowStep[];
}

const WorkflowStatus: React.FC<WorkflowStatusProps> = ({ plan }) => {
    const [expandedStep, setExpandedStep] = useState<number | null>(null);

    if (!plan || plan.length === 0) {
        return null;
    }

    const toggleExpand = (stepNumber: number) => {
        setExpandedStep(prev => prev === stepNumber ? null : stepNumber);
    };

    const getStatusIcon = (status: WorkflowStep['status']) => {
        switch (status) {
            case 'completed':
                return <CheckCircleIcon className="w-5 h-5 text-green-400" />;
            case 'in-progress':
                return <LoaderIcon className="w-5 h-5 text-primary animate-spin" />;
            case 'pending':
            default:
                return <BotIcon className="w-5 h-5 text-muted-foreground" />;
        }
    };

    return (
        <Card className="mb-4 bg-secondary/50 animate-in">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <WorkflowIcon className="w-5 h-5" />
                    Executing Plan
                </CardTitle>
                <CardDescription>The AI is executing a multi-step plan to address your request.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="workflow-timeline">
                    {plan.map((step, index) => {
                        const isCompleted = step.status === 'completed';
                        const isInProgress = step.status === 'in-progress';
                        const isExpanded = expandedStep === step.step;

                        return (
                            <div key={step.step} className="timeline-item animate-in">
                                {index > 0 && plan[index-1].status === 'completed' && <div className="timeline-connector" style={{height: 'calc(100% + 2rem)'}} />}
                                <div className={cn(
                                    "timeline-icon border-border",
                                    isInProgress && "border-primary glowing",
                                    isCompleted && "border-green-500"
                                )}>
                                    {getStatusIcon(step.status)}
                                </div>
                                <div className="ml-4">
                                    <div 
                                        className={cn("flex justify-between items-start", isCompleted && step.output && "cursor-pointer group")}
                                        onClick={() => isCompleted && step.output && toggleExpand(step.step)}
                                    >
                                        <div className="flex-1">
                                            <p className={cn(
                                                "font-semibold text-sm",
                                                isInProgress && "text-primary",
                                                isCompleted && "text-green-400"
                                            )}>
                                                Step {step.step}: {step.agent}
                                            </p>
                                            <p className="text-muted-foreground text-sm">{step.task}</p>
                                        </div>
                                        {isCompleted && step.output && (
                                            <ChevronDownIcon className={cn("w-4 h-4 text-muted-foreground mt-1 ml-2 transition-transform group-hover:text-foreground", isExpanded && "rotate-180")} />
                                        )}
                                    </div>
                                    {isCompleted && step.output && (
                                        <div className={cn("timeline-output", isExpanded && "expanded")}>
                                            <div className="mt-2 p-3 bg-background/50 border rounded-md">
                                                <MarkdownRenderer content={step.output} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
};

export default WorkflowStatus;