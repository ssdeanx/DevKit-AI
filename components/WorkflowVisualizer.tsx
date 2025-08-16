import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WorkflowStep } from '../App';
import { BotIcon, CheckCircleIcon, LoaderIcon, WorkflowIcon } from './icons';
import { cn } from '../lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/Card';

interface WorkflowVisualizerProps {
    plan: WorkflowStep[];
}

const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            staggerChildren: 0.1,
        },
    },
};

const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 },
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

const WorkflowVisualizer: React.FC<WorkflowVisualizerProps> = ({ plan }) => {
    if (!plan || plan.length === 0) {
        return null;
    }

    return (
        <Card className="mb-4 bg-secondary/50 animate-in glass-effect">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <WorkflowIcon className="w-5 h-5" />
                    Executing Plan
                </CardTitle>
                <CardDescription>The AI is executing a multi-step plan to address your request.</CardDescription>
            </CardHeader>
            <CardContent>
                <motion.div
                    className="flex flex-col items-center"
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                >
                    <AnimatePresence>
                        {plan.map((step, index) => {
                             const isCompleted = step.status === 'completed';
                             const isInProgress = step.status === 'in-progress';
                             const prevCompleted = index > 0 && plan[index-1].status === 'completed';

                            return (
                                <React.Fragment key={step.step}>
                                    {index > 0 && (
                                        <motion.div
                                            className="h-8 w-0.5"
                                            initial={{ scaleY: 0, backgroundColor: 'hsl(var(--border))' }}
                                            animate={{ 
                                                scaleY: 1, 
                                                backgroundColor: prevCompleted ? 'hsl(var(--success))' : 'hsl(var(--border))' 
                                            }}
                                            transition={{ duration: 0.5, ease: "easeIn" }}
                                            style={{ originY: 0 }}
                                        />
                                    )}
                                    <motion.div
                                        className={cn(
                                            "workflow-node w-full max-w-md",
                                            step.status
                                        )}
                                        variants={itemVariants}
                                        layout
                                    >
                                        <div className={cn(
                                            "p-2 rounded-full mr-3 border-2",
                                            isInProgress && "border-primary/50 bg-primary/10",
                                            isCompleted && "border-green-500/50 bg-green-500/10",
                                            "border-border bg-background"
                                        )}>
                                            {getStatusIcon(step.status)}
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-semibold text-sm">
                                                {step.agent}
                                            </p>
                                            <p className="text-muted-foreground text-sm">{step.task}</p>
                                        </div>
                                    </motion.div>
                                </React.Fragment>
                            );
                        })}
                    </AnimatePresence>
                </motion.div>
            </CardContent>
        </Card>
    );
};

export default WorkflowVisualizer;