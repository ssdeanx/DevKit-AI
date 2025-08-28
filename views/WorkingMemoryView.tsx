
import React, { useState, useEffect } from 'react';
import { WorkflowIcon, BrainIcon } from '../components/icons';
import ViewHeader from '../components/ViewHeader';
import { workingMemoryService, WorkingMemoryState } from '../services/working-memory.service';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import EmptyState from '../components/EmptyState';
import { AnimatePresence, motion } from 'framer-motion';
import { WorkflowStep } from '../App';

const PlanDisplay: React.FC<{ plan: WorkflowStep[] | null }> = ({ plan }) => {
    if (!plan) return null;
    return (
        <div className="space-y-2">
            {plan.map(step => (
                <div key={step.step} className="p-2 bg-secondary/50 rounded-md">
                    <p className="font-semibold text-sm">Step {step.step}: {step.agent}</p>
                    <p className="text-xs text-muted-foreground">{step.task}</p>
                </div>
            ))}
        </div>
    );
};

const WorkingMemoryView: React.FC = () => {
    const [state, setState] = useState<WorkingMemoryState>(workingMemoryService.getState());

    useEffect(() => {
        const handleStateChange = (newState: WorkingMemoryState) => {
            setState(newState);
        };
        workingMemoryService.subscribe(handleStateChange);
        return () => workingMemoryService.unsubscribe(handleStateChange);
    }, []);

    const hasContent = state.currentTask || state.currentPlan || state.observations.length > 0 || state.internalMonologue;

    return (
        <div className="flex flex-col h-full">
            <ViewHeader
                icon={<WorkflowIcon className="w-6 h-6" />}
                title="Working Memory"
                description="A live view of the AI's short-term scratchpad for the current task."
            >
                <Button onClick={() => workingMemoryService.clear()} variant="outline" size="sm" disabled={!hasContent}>
                    Clear Scratchpad
                </Button>
            </ViewHeader>

            <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
                {!hasContent ? (
                     <EmptyState
                        icon={<BrainIcon className="w-10 h-10" />}
                        title="Scratchpad is Empty"
                        description="Start a task in the Chat view to see the AI's live working memory here."
                    />
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Current Task & Plan</CardTitle>
                                <CardDescription>The high-level objective and execution plan.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {state.currentTask && (
                                    <div>
                                        <h4 className="font-semibold mb-1">Task</h4>
                                        <p className="p-2 bg-secondary/50 rounded-md text-sm">{state.currentTask}</p>
                                    </div>
                                )}
                                 {state.currentPlan && (
                                    <div>
                                        <h4 className="font-semibold mb-1">Plan</h4>
                                        <PlanDisplay plan={state.currentPlan} />
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                        <div className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Internal Monologue</CardTitle>
                                    <CardDescription>The AI's stream of consciousness and internal thoughts.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                     <pre className="text-sm whitespace-pre-wrap font-mono bg-secondary/50 p-3 rounded-md max-h-48 overflow-y-auto custom-scrollbar">
                                        {state.internalMonologue || "No thoughts yet..."}
                                    </pre>
                                </CardContent>
                            </Card>
                             <Card>
                                <CardHeader>
                                    <CardTitle>Observations</CardTitle>
                                    <CardDescription>Facts and results gathered during the task.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <AnimatePresence>
                                        <ul className="space-y-2">
                                            {state.observations.map((obs, index) => (
                                                 <motion.li 
                                                    key={index}
                                                    layout
                                                    initial={{ opacity: 0, y: -10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className="p-2 bg-secondary/50 rounded-md text-sm"
                                                 >
                                                    {obs}
                                                </motion.li>
                                            ))}
                                        </ul>
                                    </AnimatePresence>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WorkingMemoryView;
