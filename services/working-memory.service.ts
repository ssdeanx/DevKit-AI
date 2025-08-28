
import { WorkflowStep } from '../App';

interface WorkingMemoryState {
    currentTask: string | null;
    currentPlan: WorkflowStep[] | null;
    observations: string[];
    internalMonologue: string;
    result: string | null;
}

type WorkingMemoryListener = (state: WorkingMemoryState) => void;

class WorkingMemoryService {
    private state: WorkingMemoryState = this.getInitialState();
    private listeners: WorkingMemoryListener[] = [];

    private getInitialState(): WorkingMemoryState {
        return {
            currentTask: null,
            currentPlan: null,
            observations: [],
            internalMonologue: '',
            result: null,
        };
    }

    private notifyListeners() {
        this.listeners.forEach(listener => listener(this.state));
    }

    subscribe(listener: WorkingMemoryListener) {
        this.listeners.push(listener);
        // Immediately notify the new subscriber with the current state
        listener(this.state);
    }

    unsubscribe(listener: WorkingMemoryListener) {
        this.listeners = this.listeners.filter(l => l !== listener);
    }

    getState(): WorkingMemoryState {
        return { ...this.state };
    }

    setTask(task: string) {
        this.state.currentTask = task;
        this.notifyListeners();
    }
    
    setPlan(plan: WorkflowStep[]) {
        this.state.currentPlan = plan;
        this.notifyListeners();
    }

    addObservation(observation: string) {
        this.state.observations.push(observation);
        this.notifyListeners();
    }
    
    appendInternalMonologue(thought: string) {
        this.state.internalMonologue += thought;
        this.notifyListeners();
    }
    
    setResult(result: string) {
        this.state.result = result;
        this.notifyListeners();
    }

    clear() {
        this.state = this.getInitialState();
        console.log("Working memory cleared.");
        this.notifyListeners();
    }

    getFormattedScratchpad(): string {
        let scratchpad = "<WORKING_MEMORY_SCRATCHPAD>\n";
        if (this.state.currentTask) {
            scratchpad += `  <CURRENT_TASK>${this.state.currentTask}</CURRENT_TASK>\n`;
        }
        if (this.state.internalMonologue) {
            scratchpad += `  <INTERNAL_MONOLOGUE>${this.state.internalMonologue}</INTERNAL_MONOLOGUE>\n`;
        }
        if (this.state.observations.length > 0) {
            scratchpad += "  <OBSERVATIONS>\n";
            this.state.observations.forEach(obs => {
                scratchpad += `    - ${obs}\n`;
            });
            scratchpad += "  </OBSERVATIONS>\n";
        }
        scratchpad += "</WORKING_MEMORY_SCRATCHPAD>";
        return scratchpad;
    }
}

export const workingMemoryService = new WorkingMemoryService();
export type { WorkingMemoryState };
