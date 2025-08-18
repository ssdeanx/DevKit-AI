

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WorkflowStep } from '../App';
import { BotIcon, CheckCircleIcon, LoaderIcon, WorkflowIcon } from './icons';
import { cn } from '../lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/Card';
import { useSettings } from '../context/SettingsContext';
import { TokenUsage } from '../agents/types';

interface WorkflowVisualizerProps {
    plan: WorkflowStep[];
}

const TokenUsageDisplay: React.FC<{ usage: TokenUsage }> = React.memo(({ usage }) => {
    const tooltipText = `Input: ${usage.promptTokenCount ?? 'N/A'}\nOutput: ${usage.candidatesTokenCount ?? 'N/A'}${usage.thoughtsTokenCount ? `\nThoughts: ${usage.thoughtsTokenCount}` : ''}\nTotal: ${usage.totalTokenCount ?? 'N/A'}`;
    
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="text-xs text-muted-foreground ml-2 font-mono px-1.5 py-0.5 bg-background/50 rounded" 
            data-tooltip={tooltipText}
        >
            {usage.totalTokenCount ?? '?'} tokens
        </motion.div>
    );
});
TokenUsageDisplay.displayName = 'TokenUsageDisplay';


const AnimatedCheckmark: React.FC = () => (
    <motion.svg
        xmlns="http://www.w3.org/2000/svg"
        className="w-5 h-5 text-success"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <motion.path
            d="M22 11.08V12a10 10 0 1 1-5.93-9.14"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
        />
        <motion.path
            d="M22 4 12 14.01 9 11.01"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.3, ease: "easeOut" }}
        />
    </motion.svg>
);


const getStatusIcon = (status: WorkflowStep['status']) => {
    switch (status) {
        case 'completed':
            return <AnimatedCheckmark />;
        case 'in-progress':
            return <LoaderIcon className="w-5 h-5 text-primary animate-spin" title="In Progress" />;
        case 'pending':
        default:
            return <BotIcon className="w-5 h-5 text-muted-foreground" title="Pending" />;
    }
};

const StepOutput: React.FC<{ output?: string }> = React.memo(({ output }) => (
     <AnimatePresence>
        {output && (
            <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
            >
                <div className="workflow-output-preview">
                    <p className="font-semibold mb-1">Output:</p>
                    <pre className="whitespace-pre-wrap font-mono text-muted-foreground max-h-24 overflow-y-auto custom-scrollbar">
                        {output.length > 300 ? `${output.substring(0, 300)}...` : output}
                    </pre>
                </div>
            </motion.div>
        )}
    </AnimatePresence>
));
StepOutput.displayName = 'StepOutput';

const SimpleListVisualizer: React.FC<{ plan: WorkflowStep[], expandedStep: number | null, onToggle: (step: number) => void }> = React.memo(({ plan, expandedStep, onToggle }) => (
    <div className="space-y-1">
        {plan.map((step) => {
            const isClickable = step.status === 'completed' && !!step.output;
            return (
                <motion.div
                    key={step.step}
                    layout
                >
                    <div
                        className={cn("workflow-step", step.status, isClickable && "workflow-step-clickable")}
                        onClick={() => isClickable && onToggle(step.step)}
                    >
                        <div className="mr-3 mt-1">{getStatusIcon(step.status)}</div>
                        <div className="flex-1">
                            <div className="flex items-center">
                                <p className="font-semibold text-sm">{step.agent}</p>
                                {step.usage && <TokenUsageDisplay usage={step.usage} />}
                            </div>
                            <p className="text-muted-foreground text-xs">{step.task}</p>
                        </div>
                    </div>
                     {expandedStep === step.step && <StepOutput output={step.output} />}
                </motion.div>
            )
        })}
    </div>
));
SimpleListVisualizer.displayName = 'SimpleListVisualizer';

const DetailedCardVisualizer: React.FC<{ plan: WorkflowStep[], expandedStep: number | null, onToggle: (step: number) => void }> = React.memo(({ plan, expandedStep, onToggle }) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {plan.map((step) => {
            const isClickable = step.status === 'completed' && !!step.output;
            return (
                 <motion.div
                    key={step.step}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    layout
                >
                    <Card
                        className={cn("h-full transition-all", step.status === 'in-progress' && 'border-primary shadow-lg', isClickable && "workflow-step-clickable")}
                        onClick={() => isClickable && onToggle(step.step)}
                    >
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <div className="flex items-center">
                                <CardTitle className="text-sm font-medium">{step.agent}</CardTitle>
                                {step.usage && <TokenUsageDisplay usage={step.usage} />}
                            </div>
                            {getStatusIcon(step.status)}
                        </CardHeader>
                        <CardContent>
                            <p className="text-xs text-muted-foreground">{step.task}</p>
                            {expandedStep === step.step && <StepOutput output={step.output} />}
                        </CardContent>
                    </Card>
                </motion.div>
            )
        })}
    </div>
));
DetailedCardVisualizer.displayName = 'DetailedCardVisualizer';


const TimelineVisualizer: React.FC<{ plan: WorkflowStep[], expandedStep: number | null, onToggle: (step: number) => void }> = React.memo(({ plan, expandedStep, onToggle }) => (
    <div className="relative">
        {plan.map((step) => {
            const isClickable = step.status === 'completed' && !!step.output;
            return (
                <motion.div
                    key={step.step}
                    className="workflow-timeline-item"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    layout
                >
                    <div className={cn("workflow-timeline-status", step.status)}>
                        {getStatusIcon(step.status)}
                    </div>
                    <div
                        className={cn("pb-8 pl-4", isClickable && "workflow-step-clickable rounded-r-lg")}
                        onClick={() => isClickable && onToggle(step.step)}
                    >
                        <div className="flex items-center">
                            <p className="font-semibold text-sm">{step.agent}</p>
                            {step.usage && <TokenUsageDisplay usage={step.usage} />}
                        </div>
                        <p className="text-muted-foreground text-xs">{step.task}</p>
                        {expandedStep === step.step && <StepOutput output={step.output} />}
                    </div>
                </motion.div>
            )
        })}
    </div>
));
TimelineVisualizer.displayName = 'TimelineVisualizer';

const MetroGridVisualizer: React.FC<{ plan: WorkflowStep[], expandedStep: number | null, onToggle: (step: number) => void }> = React.memo(({ plan, expandedStep, onToggle }) => (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {plan.map((step) => {
            const isClickable = step.status === 'completed' && !!step.output;
            return (
                <motion.div
                    key={step.step}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                >
                    <Card 
                        className={cn("h-full transition-all duration-300", isClickable && "cursor-pointer hover:bg-primary/5", step.status === 'in-progress' && 'animate-glow border-primary/50')}
                        onClick={() => isClickable && onToggle(step.step)}
                    >
                        <CardContent className="p-4">
                             <div className="flex items-start justify-between">
                                <span className="text-xs font-bold text-primary">0{step.step}</span>
                                {getStatusIcon(step.status)}
                            </div>
                            <div className="flex items-center mt-2">
                                <p className="font-semibold text-sm truncate">{step.agent}</p>
                                {step.usage && <TokenUsageDisplay usage={step.usage} />}
                            </div>
                            <p className="text-muted-foreground text-xs mt-1 h-10">{step.task}</p>
                            {expandedStep === step.step && <StepOutput output={step.output} />}
                        </CardContent>
                    </Card>
                </motion.div>
            );
        })}
    </div>
));
MetroGridVisualizer.displayName = 'MetroGridVisualizer';

const SteppedProcessVisualizer: React.FC<{ plan: WorkflowStep[], expandedStep: number | null, onToggle: (step: number) => void }> = React.memo(({ plan, expandedStep, onToggle }) => (
    <div>
        <div className="workflow-stepper">
            {plan.map((step, index) => (
                <React.Fragment key={step.step}>
                    <motion.div className="flex flex-col items-center flex-shrink-0" layout>
                         <div className={cn("workflow-stepper-status", step.status)}>
                            {step.status === 'completed' ? <CheckCircleIcon className="w-4 h-4" /> : <span className="font-bold text-xs">{step.step}</span>}
                        </div>
                    </motion.div>
                    {index < plan.length - 1 && (
                        <div className={cn("workflow-stepper-connector", step.status)}>
                            <motion.div 
                                className="workflow-stepper-connector-fill"
                                initial={{ width: '0%' }}
                                animate={{ width: step.status === 'completed' ? '100%' : '0%' }}
                                transition={{ duration: 0.5, ease: 'easeInOut' }}
                            />
                        </div>
                    )}
                </React.Fragment>
            ))}
        </div>
        <div className="flex mt-2">
             {plan.map((step) => {
                const isClickable = step.status === 'completed' && !!step.output;
                return (
                     <div key={step.step} className="flex-1 text-center px-1">
                        <div 
                            className={cn(isClickable && "cursor-pointer hover:underline")}
                            onClick={() => isClickable && onToggle(step.step)}
                        >
                            <div className="flex items-center justify-center">
                               <p className="font-semibold text-sm truncate">{step.agent}</p>
                               {step.usage && <TokenUsageDisplay usage={step.usage} />}
                            </div>
                             {expandedStep === step.step && <StepOutput output={step.output} />}
                        </div>
                    </div>
                )
             })}
        </div>
    </div>
));
SteppedProcessVisualizer.displayName = 'SteppedProcessVisualizer';

const MinimalistLogVisualizer: React.FC<{ plan: WorkflowStep[], expandedStep: number | null, onToggle: (step: number) => void }> = React.memo(({ plan, expandedStep, onToggle }) => (
    <div className="workflow-log">
        {plan.map((step) => {
             const isClickable = step.status === 'completed' && !!step.output;
             const statusText = { pending: '[...]', 'in-progress': '[RUN]', completed: '[OK ]'}[step.status];
            return (
                <motion.div key={step.step} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div 
                        className={cn("workflow-log-line py-0.5", isClickable && "cursor-pointer hover:bg-white/10 rounded-sm -mx-1 px-1")}
                        onClick={() => isClickable && onToggle(step.step)}
                    >
                        <div className="truncate min-w-0">
                            <span className={cn('mr-2 font-bold', `status-${step.status}`)}>{statusText}</span>
                            <span>{step.agent}: {step.task}</span>
                        </div>
                        <div className="flex items-center flex-shrink-0">
                            {step.usage && <TokenUsageDisplay usage={step.usage} />}
                            {step.status === 'in-progress' && <span className="animate-blink ml-1">▋</span>}
                        </div>
                    </div>
                    {expandedStep === step.step && <StepOutput output={step.output} />}
                </motion.div>
            );
        })}
    </div>
));
MinimalistLogVisualizer.displayName = 'MinimalistLogVisualizer';

const NeuralNetworkVisualizer: React.FC<{ plan: WorkflowStep[] }> = React.memo(({ plan }) => {
    const nodeSize = 80;
    const radius = 200;
    const center = { x: 300, y: 200 };

    const nodes = plan.map((step, i) => {
        const angle = (i / plan.length) * 2 * Math.PI;
        return {
            ...step,
            x: center.x + radius * Math.cos(angle) - nodeSize / 2,
            y: center.y + radius * Math.sin(angle) - nodeSize / 2,
        };
    });

    const edges = nodes.slice(1).map((node, i) => ({
        source: nodes[i],
        target: node,
    }));
    
    return (
        <div className="relative w-full h-[450px]">
            <svg width="100%" height="100%" className="absolute inset-0">
                <defs>
                    <filter id="glow">
                        <feGaussianBlur stdDeviation="3.5" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>
                {edges.map((edge, i) => {
                    const pathD = `M${edge.source.x + nodeSize/2},${edge.source.y + nodeSize/2} L${edge.target.x + nodeSize/2},${edge.target.y + nodeSize/2}`;
                    const inProgress = edge.target.status === 'in-progress';
                    return (
                        <g key={`edge-${i}`}>
                            <path d={pathD} stroke="hsl(var(--border))" strokeWidth="1" />
                            {inProgress && (
                                <circle r="3" fill="hsl(var(--primary))" className="particle" style={{ '--path': `path('${pathD}')`, '--duration': '2s' } as React.CSSProperties} />
                            )}
                        </g>
                    );
                })}
            </svg>
            {nodes.map((node) => (
                <motion.div
                    key={node.step}
                    className={cn("absolute rounded-full flex flex-col items-center justify-center text-center p-2 nn-node transition-all", node.status)}
                    style={{
                        width: nodeSize,
                        height: nodeSize,
                        backgroundColor: node.status === 'completed' ? 'hsl(var(--success)/0.1)' : 'hsl(var(--card))',
                        borderColor: node.status === 'in-progress' ? 'hsl(var(--primary))' : node.status === 'completed' ? 'hsl(var(--success))' : 'hsl(var(--border))'
                    }}
                    initial={{ x: center.x, y: center.y, opacity: 0 }}
                    animate={{ x: node.x, y: node.y, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 50 }}
                >
                    <p className="text-xs font-bold truncate">{node.agent}</p>
                    <p className="text-[10px] text-muted-foreground line-clamp-2">{node.task}</p>
                    {node.usage && <TokenUsageDisplay usage={node.usage} />}
                </motion.div>
            ))}
        </div>
    );
});
NeuralNetworkVisualizer.displayName = 'NeuralNetworkVisualizer';

const CircuitBoardVisualizer: React.FC<{ plan: WorkflowStep[], expandedStep: number | null, onToggle: (step: number) => void }> = React.memo(({ plan, expandedStep, onToggle }) => {
    return (
        <div className="circuit-board-container">
            {plan.map((step, index) => {
                const isClickable = step.status === 'completed' && !!step.output;
                const nextStepInProgress = plan[index + 1]?.status === 'in-progress';
                return (
                    <React.Fragment key={step.step}>
                        <motion.div
                            layout
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.1 }}
                            className={cn("circuit-chip", step.status, isClickable && "cursor-pointer")}
                            onClick={() => isClickable && onToggle(step.step)}
                        >
                            <div className="flex items-start justify-between">
                                <span className="text-xs font-mono font-bold text-muted-foreground">{`0${step.step}`}</span>
                                {getStatusIcon(step.status)}
                            </div>
                            <div className="mt-auto">
                                <div className="flex items-center">
                                    <p className="font-semibold text-sm truncate">{step.agent}</p>
                                </div>
                                <p className="text-muted-foreground text-xs h-8 line-clamp-2">{step.task}</p>
                                {step.usage && <TokenUsageDisplay usage={step.usage} />}
                                 {expandedStep === step.step && <StepOutput output={step.output} />}
                            </div>
                        </motion.div>
                        {index < plan.length - 1 && (
                            <div className="circuit-trace-container">
                                <div className={cn("circuit-trace", step.status === 'completed' && 'completed')}>
                                    <motion.div 
                                        className="circuit-trace-fill"
                                        initial={{ width: '0%' }}
                                        animate={{ width: step.status === 'completed' ? '100%' : '0%' }}
                                        transition={{ duration: 0.5, ease: 'linear' }}
                                    />
                                    {nextStepInProgress && <div className="circuit-trace-pulse" />}
                                </div>
                            </div>
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
});
CircuitBoardVisualizer.displayName = 'CircuitBoardVisualizer';

const GitBranchVisualizer: React.FC<{ plan: WorkflowStep[] }> = React.memo(({ plan }) => {
    return (
        <div className="relative h-full py-10">
            <div className="git-branch-line" />
            <div className="space-y-8">
                {plan.map((step, i) => (
                    <motion.div 
                        key={step.step} 
                        className="relative pl-16"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                    >
                        <div className="git-commit-node" style={{ top: `0` }}>
                            <div className={cn("w-full h-full rounded-full", step.status === 'completed' ? 'bg-success' : step.status === 'in-progress' ? 'bg-primary animate-pulse' : 'bg-secondary')} />
                        </div>
                        <Card className={cn(step.status === 'in-progress' && 'border-primary')}>
                            <CardContent className="p-3">
                                <div className="flex items-center justify-between">
                                    <p className="font-mono text-sm font-semibold">{step.agent}</p>
                                    {step.usage && <TokenUsageDisplay usage={step.usage} />}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">{step.task}</p>
                            </CardContent>
                        </Card>
                    </motion.div>
                ))}
            </div>
        </div>
    );
});
GitBranchVisualizer.displayName = 'GitBranchVisualizer';

const WorkflowVisualizer: React.FC<WorkflowVisualizerProps> = React.memo(({ plan }) => {
    const { settings } = useSettings();
    const [startTime] = useState(Date.now());
    const [elapsedTime, setElapsedTime] = useState(0);
    const [expandedStep, setExpandedStep] = useState<number | null>(null);

    useEffect(() => {
        const isFinished = plan.every(p => p.status === 'completed');
        if (isFinished) return;

        const interval = setInterval(() => {
            setElapsedTime((Date.now() - startTime) / 1000);
        }, 100);
        return () => clearInterval(interval);
    }, [startTime, plan]);

    const handleToggleStep = (stepNumber: number) => {
        setExpandedStep(prev => prev === stepNumber ? null : stepNumber);
    };

    const renderVisualizer = () => {
        const props = { plan, expandedStep, onToggle: handleToggleStep };
        switch(settings.workflowVisual) {
            case 'detailed-card': return <DetailedCardVisualizer {...props} />;
            case 'timeline': return <TimelineVisualizer {...props} />;
            case 'metro-grid': return <MetroGridVisualizer {...props} />;
            case 'stepped-process': return <SteppedProcessVisualizer {...props} />;
            case 'minimalist-log': return <MinimalistLogVisualizer {...props} />;
            case 'neural-network': return <NeuralNetworkVisualizer plan={plan} />;
            case 'circuit-board': return <CircuitBoardVisualizer {...props} />;
            case 'git-branch': return <GitBranchVisualizer plan={plan} />;
            case 'simple-list':
            default:
                return <SimpleListVisualizer {...props} />;
        }
    };

    if (!plan || plan.length === 0) {
        return null;
    }

    return (
        <Card className="mb-4 bg-secondary/50 animate-in glass-effect">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <WorkflowIcon className="w-5 h-5" />
                        <CardTitle>Executing Plan</CardTitle>
                    </div>
                    <div className="text-sm font-mono font-semibold px-2 py-1 bg-background/50 rounded-md">
                        {elapsedTime.toFixed(1)}s
                    </div>
                </div>
                <CardDescription>The AI is executing a multi-step plan. Completed steps can be clicked to view output.</CardDescription>
            </CardHeader>
            <CardContent>
                {renderVisualizer()}
            </CardContent>
        </Card>
    );
});
WorkflowVisualizer.displayName = 'WorkflowVisualizer';


export default WorkflowVisualizer;