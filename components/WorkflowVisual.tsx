import React from 'react';
import { WorkflowVisualType } from '../context/SettingsContext';

interface WorkflowVisualProps {
    style: WorkflowVisualType;
}

const SimpleFlow: React.FC = () => (
    <svg width="100%" height="150" viewBox="0 0 800 150" fill="none" xmlns="http://www.w3.org/2000/svg">
        <style>
            {`
            #simple-flow > * { animation: fade-in 0.5s ease-out forwards; }
            #simple-flow-node-1 { animation-delay: 0s; }
            #simple-flow-arrow-1 { animation-delay: 0.2s; }
            #simple-flow-node-2 { animation-delay: 0.4s; }
            #simple-flow-arrow-2 { animation-delay: 0.6s; }
            #simple-flow-node-3 { animation-delay: 0.8s; }
            #simple-flow-arrow-3 { animation-delay: 1.0s; }
            #simple-flow-node-4 { animation-delay: 1.2s; }
            `}
        </style>
        <g id="simple-flow">
            <g id="simple-flow-node-1" className="opacity-0">
                <rect x="50" y="50" width="150" height="50" rx="8" fill="hsl(var(--secondary))" stroke="hsl(var(--border))" />
                <text x="125" y="80" textAnchor="middle" fill="hsl(var(--foreground))" fontSize="14">User Input</text>
            </g>
            <path id="simple-flow-arrow-1" className="opacity-0 workflow-arrow workflow-arrow-animated" d="M200 75 L 240 75" stroke="hsl(var(--muted-foreground))" strokeWidth="2" markerEnd="url(#arrow)" />
            
            <g id="simple-flow-node-2" className="opacity-0">
                <rect x="240" y="50" width="150" height="50" rx="8" fill="hsl(var(--secondary))" stroke="hsl(var(--border))" />
                <text x="315" y="80" textAnchor="middle" fill="hsl(var(--foreground))" fontSize="14">Supervisor</text>
            </g>
            <path id="simple-flow-arrow-2" className="opacity-0 workflow-arrow workflow-arrow-animated" d="M390 75 L 430 75" stroke="hsl(var(--muted-foreground))" strokeWidth="2" markerEnd="url(#arrow)" />

            <g id="simple-flow-node-3" className="opacity-0">
                <rect x="430" y="50" width="150" height="50" rx="8" fill="hsl(var(--secondary))" stroke="hsl(var(--border))" />
                <text x="505" y="80" textAnchor="middle" fill="hsl(var(--foreground))" fontSize="14">Agent</text>
            </g>
            <path id="simple-flow-arrow-3" className="opacity-0 workflow-arrow workflow-arrow-animated" d="M580 75 L 620 75" stroke="hsl(var(--muted-foreground))" strokeWidth="2" markerEnd="url(#arrow)" />
            
            <g id="simple-flow-node-4" className="opacity-0">
                <rect x="620" y="50" width="150" height="50" rx="8" fill="hsl(var(--secondary))" stroke="hsl(var(--border))" />
                <text x="695" y="80" textAnchor="middle" fill="hsl(var(--foreground))" fontSize="14">AI Response</text>
            </g>
        </g>
        <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--muted-foreground))" />
            </marker>
        </defs>
    </svg>
);


const DetailedFlow: React.FC = () => (
    <svg width="100%" height="250" viewBox="0 0 800 250" fill="none" xmlns="http://www.w3.org/2000/svg">
        <style>
            {`
             #detailed-flow > * { animation: fade-in 0.5s ease-out forwards; }
             #detailed-supervisor-box { animation-delay: 0s; }
             #detailed-node-1 { animation-delay: 0.2s; }
             #detailed-arrow-1 { animation-delay: 0.4s; }
             #detailed-node-2 { animation-delay: 0.6s; }
             #detailed-arrow-2 { animation-delay: 0.8s; }
             #detailed-node-3 { animation-delay: 1.0s; }
             #detailed-arrow-3 { animation-delay: 1.2s; }
             #detailed-node-4 { animation-delay: 1.4s; }
            `}
        </style>
         <g id="detailed-flow">
            {/* Supervisor */}
            <g id="detailed-supervisor-box" className="opacity-0">
                <rect x="200" y="25" width="400" height="200" rx="15" stroke="hsl(var(--border))" strokeDasharray="5 5" />
                <text x="400" y="20" textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="12">Supervisor Manages Workflow</text>
            </g>
            {/* Input */}
            <g id="detailed-node-1" className="opacity-0">
                <rect x="25" y="100" width="125" height="50" rx="8" fill="hsl(var(--secondary))" />
                <text x="87.5" y="130" textAnchor="middle" fill="hsl(var(--foreground))" fontSize="14">User Input</text>
            </g>
            <path id="detailed-arrow-1" className="opacity-0 workflow-arrow workflow-arrow-animated" d="M150 125 L 250 125" stroke="hsl(var(--muted-foreground))" strokeWidth="2" markerEnd="url(#arrow-detailed)" />

            {/* Orchestrator */}
            <g id="detailed-node-2" className="opacity-0">
                <rect x="250" y="100" width="125" height="50" rx="8" fill="hsl(var(--secondary))" />
                <text x="312.5" y="130" textAnchor="middle" fill="hsl(var(--foreground))" fontSize="14">Orchestrator</text>
                <text x="312.5" y="165" textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="12">(Selects Agent)</text>
            </g>
            <path id="detailed-arrow-2" className="opacity-0 workflow-arrow workflow-arrow-animated" d="M375 125 L 425 125" stroke="hsl(var(--muted-foreground))" strokeWidth="2" markerEnd="url(#arrow-detailed)" />

            {/* Agents */}
            <g id="detailed-node-3" className="opacity-0">
                <rect x="425" y="50" width="125" height="150" rx="8" fill="hsl(var(--secondary))" />
                <text x="487.5" y="70" textAnchor="middle" fill="hsl(var(--foreground))" fontSize="14">Agents</text>
                <text x="487.5" y="100" textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="12">ChatAgent</text>
                <text x="487.5" y="125" textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="12">ReadmeAgent</text>
                <text x="487.5" y="150" textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="12">etc...</text>
            </g>
            <path id="detailed-arrow-3" className="opacity-0 workflow-arrow workflow-arrow-animated" d="M550 125 L 625 125" stroke="hsl(var(--muted-foreground))" strokeWidth="2" markerEnd="url(#arrow-detailed)" />

             {/* Output */}
            <g id="detailed-node-4" className="opacity-0">
                <rect x="625" y="100" width="125" height="50" rx="8" fill="hsl(var(--secondary))" />
                <text x="687.5" y="130" textAnchor="middle" fill="hsl(var(--foreground))" fontSize="14">AI Response</text>
            </g>
        </g>
        <defs>
            <marker id="arrow-detailed" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--muted-foreground))" />
            </marker>
        </defs>
    </svg>
);

const WorkflowVisual: React.FC<WorkflowVisualProps> = ({ style }) => {
    // By using a key, we force React to re-mount the component when the style changes,
    // which restarts the CSS animations for a better user experience.
    if (style === 'detailed') {
        return <DetailedFlow key="detailed" />;
    }
    return <SimpleFlow key="simple" />;
};

export default WorkflowVisual;