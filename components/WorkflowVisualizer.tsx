import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WorkflowStep } from '../App';
import { BotIcon, CheckCircleIcon, LoaderIcon, WorkflowIcon } from './icons';
import { cn } from '../lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/Card';
import { useSettings } from '../context/SettingsContext';

interface WorkflowVisualizerProps {
    plan: WorkflowStep[];
}

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

const StepOutput: React.FC<{ output?: string }> = ({ output }) => (
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
);

const SimpleListVisualizer: React.FC<{ plan: WorkflowStep[], expandedStep: number | null, onToggle: (step: number) => void }> = ({ plan, expandedStep, onToggle }) => (
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
                            <p className="font-semibold text-sm">{step.agent}</p>
                            <p className="text-muted-foreground text-xs">{step.task}</p>
                        </div>
                    </div>
                     {expandedStep === step.step && <StepOutput output={step.output} />}
                </motion.div>
            )
        })}
    </div>
);

const DetailedCardVisualizer: React.FC<{ plan: WorkflowStep[], expandedStep: number | null, onToggle: (step: number) => void }> = ({ plan, expandedStep, onToggle }) => (
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
                            <CardTitle className="text-sm font-medium">{step.agent}</CardTitle>
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
);

const TimelineVisualizer: React.FC<{ plan: WorkflowStep[], expandedStep: number | null, onToggle: (step: number) => void }> = ({ plan, expandedStep, onToggle }) => (
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
                        <p className="font-semibold text-sm">{step.agent}</p>
                        <p className="text-muted-foreground text-xs">{step.task}</p>
                        {expandedStep === step.step && <StepOutput output={step.output} />}
                    </div>
                </motion.div>
            )
        })}
    </div>
);

const MetroGridVisualizer: React.FC<{ plan: WorkflowStep[], expandedStep: number | null, onToggle: (step: number) => void }> = ({ plan, expandedStep, onToggle }) => (
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
                            <p className="font-semibold text-sm mt-2">{step.agent}</p>
                            <p className="text-muted-foreground text-xs mt-1 h-10">{step.task}</p>
                            {expandedStep === step.step && <StepOutput output={step.output} />}
                        </CardContent>
                    </Card>
                </motion.div>
            );
        })}
    </div>
);

const SteppedProcessVisualizer: React.FC<{ plan: WorkflowStep[], expandedStep: number | null, onToggle: (step: number) => void }> = ({ plan, expandedStep, onToggle }) => (
    <div className="workflow-stepper">
        {plan.map((step, index) => {
             const isClickable = step.status === 'completed' && !!step.output;
            return (
                <React.Fragment key={step.step}>
                    <motion.div className="flex flex-col items-center" layout>
                         <div className={cn("workflow-stepper-status", step.status)}>
                            {step.status === 'completed' ? <CheckCircleIcon className="w-4 h-4" /> : <span className="font-bold text-xs">{step.step}</span>}
                        </div>
                        <div 
                            className={cn("mt-2 text-center", isClickable && "cursor-pointer hover:underline")}
                            onClick={() => isClickable && onToggle(step.step)}
                        >
                            <p className="font-semibold text-sm">{step.agent}</p>
                             {expandedStep === step.step && <StepOutput output={step.output} />}
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
            );
        })}
    </div>
);

const MinimalistLogVisualizer: React.FC<{ plan: WorkflowStep[], expandedStep: number | null, onToggle: (step: number) => void }> = ({ plan, expandedStep, onToggle }) => (
    <div className="workflow-log">
        {plan.map((step) => {
             const isClickable = step.status === 'completed' && !!step.output;
             const statusText = { pending: '[...]', 'in-progress': '[RUN]', completed: '[OK ]'}[step.status];
            return (
                <motion.div key={step.step} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div 
                        className={cn("workflow-log-line", isClickable && "cursor-pointer hover:bg-white/10")}
                        onClick={() => isClickable && onToggle(step.step)}
                    >
                        <span className={cn('mr-2 font-bold', `status-${step.status}`)}>{statusText}</span>
                        <span>{step.agent}: {step.task}</span>
                        {step.status === 'in-progress' && <span className="animate-blink">▋</span>}
                    </div>
                    {expandedStep === step.step && <StepOutput output={step.output} />}
                </motion.div>
            );
        })}
    </div>
);


const WorkflowVisualizer: React.FC<WorkflowVisualizerProps> = ({ plan }) => {
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
};

export default WorkflowVisualizer;