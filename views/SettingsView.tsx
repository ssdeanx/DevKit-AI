

import React, { useState, useCallback } from 'react';
import { agentService } from '../services/agent.service';
import { Agent, AgentConfig } from '../agents/types';
import { ThinkingConfig, GenerationConfig, Tool } from '@google/genai';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Label } from '../components/ui/Label';
import { Slider } from '../components/ui/Slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/Tabs';
import { useSettings, AgentThoughtsStyle, WorkflowVisualType } from '../context/SettingsContext';
import { Textarea } from '../components/ui/Textarea';
import { Switch } from '../components/ui/Switch'; 
import { cn } from '../lib/utils';
import { cacheService } from '../services/cache.service';
import { Button } from '../components/ui/Button';
import ViewHeader from '../components/ViewHeader';
import { SettingsIcon, CheckCircleIcon, WorkflowIcon, BotIcon } from '../components/icons';
import { agentMemoryService } from '../services/agent-memory.service';
import { useToast } from '../context/ToastContext';


const SettingsSlider: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  displayValue?: string;
}> = ({ label, value, min, max, step, onChange, disabled, displayValue }) => (
    <div className={cn("space-y-2 transition-opacity", disabled && "opacity-50")}>
        <div className="flex justify-between items-center">
            <Label>{label}</Label>
            <span className="text-sm font-mono px-2 py-0.5 bg-muted rounded">
                {displayValue ?? value.toFixed(step < 1 ? 2 : 0)}
            </span>
        </div>
        <Slider
            value={[value]}
            onValueChange={(v) => onChange(v[0])}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
        />
    </div>
);

const AgentSettings: React.FC<{ agent: Agent, onConfigChange: (agentId: string, newConfig: Partial<AgentConfig>) => void }> = ({ agent, onConfigChange }) => {
    
    const handleGenerationConfigChange = (param: keyof GenerationConfig, value: any) => {
        onConfigChange(agent.id, { config: { [param]: value } });
    };

    const handleThinkingConfigChange = (thinkingParam: keyof ThinkingConfig, value: any) => {
        const newThinkingConfig = { ...agent.config.config?.thinkingConfig, [thinkingParam]: value };
        onConfigChange(agent.id, { config: { thinkingConfig: newThinkingConfig } as any });
    };

    const handleDynamicThinkingToggle = (checked: boolean) => {
        const newThinkingConfig = {
            ...agent.config.config?.thinkingConfig,
            thinkingBudget: checked ? -1 : 8192, // Use -1 for dynamic, or a default value
        };
        onConfigChange(agent.id, { config: { thinkingConfig: newThinkingConfig } as any });
    };

    const handleToolToggle = (toolName: 'googleSearch' | 'codeExecution', enabled: boolean) => {
        const currentTools = agent.config.config?.tools || [];
        let newTools;
    
        if (enabled) {
            if (!currentTools.some(t => toolName in t)) {
                // Add the tool, preserving other tools like function declarations
                const newTool = toolName === 'googleSearch' 
                    ? { googleSearch: {} } 
                    : { codeExecution: {} };
                newTools = [...currentTools, newTool];
                onConfigChange(agent.id, { config: { tools: newTools as any } });
            }
        } else {
            // Remove the tool, preserving others
            newTools = currentTools.filter(t => !(toolName in t));
            if (newTools.length < currentTools.length) {
                onConfigChange(agent.id, { config: { tools: newTools as any } });
            }
        }
    };
    
    const isToolEnabled = (toolName: 'googleSearch' | 'codeExecution') => {
        return agent.config.config?.tools?.some(t => toolName in t) || false;
    };
    
    const handleSchemaChange = (schemaString: string) => {
        try {
            const schema = schemaString ? JSON.parse(schemaString) : undefined;
            onConfigChange(agent.id, {
                config: {
                    responseSchema: schema,
                    responseMimeType: schema ? "application/json" : "text/plain"
                }
            });
        } catch (e) {
            console.error("Invalid JSON Schema:", e);
        }
    };

    const thinkingBudget = agent.config.config?.thinkingConfig?.thinkingBudget ?? -1;
    const isDynamicThinking = thinkingBudget === -1;

    return (
        <Card>
            <CardHeader>
                <CardTitle>{agent.name}</CardTitle>
                <CardDescription>{agent.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                {/* Generation Parameters */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-8">
                    <SettingsSlider
                        label="Temperature"
                        min={0} max={1} step={0.01}
                        value={agent.config.config?.temperature ?? 0.7}
                        onChange={(v) => handleGenerationConfigChange('temperature', v)}
                    />
                    <SettingsSlider
                        label="Top-P"
                        min={0} max={1} step={0.01}
                        value={agent.config.config?.topP ?? 0.9}
                        onChange={(v) => handleGenerationConfigChange('topP', v)}
                    />
                    <SettingsSlider
                        label="Top-K"
                        min={1} max={100} step={1}
                        value={agent.config.config?.topK ?? 40}
                        onChange={(v) => handleGenerationConfigChange('topK', v)}
                    />
                     <SettingsSlider
                        label="Max Output Tokens"
                        min={1} max={65536} step={128}
                        value={agent.config.config?.maxOutputTokens ?? 8192}
                        onChange={(v) => handleGenerationConfigChange('maxOutputTokens', v)}
                    />
                </div>
                {/* Thinking Configuration */}
                <div className="border-t pt-6">
                    <h3 className="text-lg font-medium text-foreground mb-2">Thinking Configuration</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                        `thinkingBudget` controls tokens for internal reasoning (higher can improve quality for complex tasks), while `maxOutputTokens` limits the final response length.
                    </p>
                    
                     <div className="flex items-center space-x-2">
                        <Switch
                            id={`dynamic-thinking-${agent.id}`}
                            checked={isDynamicThinking}
                            onCheckedChange={handleDynamicThinkingToggle}
                        />
                        <div className="flex flex-col">
                            <Label htmlFor={`dynamic-thinking-${agent.id}`} className="cursor-pointer">Enable Dynamic Thinking</Label>
                             <p className="text-xs text-muted-foreground">Sets budget to -1 to automatically choose necessary tokens.</p>
                        </div>
                    </div>

                    <div className="mt-4">
                        <SettingsSlider
                            label="Thinking Budget"
                            min={0} max={24576} step={128}
                            value={isDynamicThinking ? 0 : thinkingBudget}
                            onChange={(v) => handleThinkingConfigChange('thinkingBudget', v)}
                            disabled={isDynamicThinking}
                            displayValue={isDynamicThinking ? 'Auto' : undefined}
                        />
                    </div>
                     <div className="flex items-center space-x-2 pt-4">
                        <Switch
                            id={`thinking-thoughts-${agent.id}`}
                            checked={agent.config.config?.thinkingConfig?.includeThoughts === true}
                            onCheckedChange={(checked) => handleThinkingConfigChange('includeThoughts', checked)}
                        />
                        <Label htmlFor={`thinking-thoughts-${agent.id}`}>Include Thought Process</Label>
                    </div>
                </div>

                {/* Tools Configuration */}
                <div className="border-t pt-6">
                     <h3 className="text-lg font-medium text-foreground mb-4">Tools</h3>
                     <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Label htmlFor={`tool-search-${agent.id}`} className="flex flex-col space-y-1">
                                <span>Google Search Grounding</span>
                                <span className="font-normal text-xs text-muted-foreground">Allows agent to search the web for up-to-date info.</span>
                            </Label>
                            <Switch
                                id={`tool-search-${agent.id}`}
                                checked={isToolEnabled('googleSearch')}
                                onCheckedChange={(checked) => handleToolToggle('googleSearch', checked)}
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <Label htmlFor={`tool-code-${agent.id}`} className="flex flex-col space-y-1">
                                <span>Code Execution</span>
                                 <span className="font-normal text-xs text-muted-foreground">Allows agent to write and run Python code.</span>
                            </Label>
                             <Switch
                                id={`tool-code-${agent.id}`}
                                checked={isToolEnabled('codeExecution')}
                                onCheckedChange={(checked) => handleToolToggle('codeExecution', checked)}
                            />
                        </div>
                         <div className="flex items-center justify-between opacity-50">
                            <Label htmlFor={`tool-cache-${agent.id}`} className="flex flex-col space-y-1">
                                <span>Context Caching</span>
                                 <span className="font-normal text-xs text-muted-foreground">Caches large contexts to reduce cost (Coming soon for JS SDK).</span>
                            </Label>
                             <Switch id={`tool-cache-${agent.id}`} disabled checked={false} onCheckedChange={() => {}} />
                        </div>
                        <div className="space-y-2 pt-2">
                             <Label htmlFor={`tool-schema-${agent.id}`} className="flex flex-col space-y-1">
                                <span>Structured Output (JSON Schema)</span>
                                 <span className="font-normal text-xs text-muted-foreground">Force the agent to output JSON matching this schema.</span>
                            </Label>
                             <Textarea
                                id={`tool-schema-${agent.id}`}
                                placeholder='{ "type": "OBJECT", "properties": { "movie_title": { "type": "STRING" } } }'
                                className="font-mono text-xs"
                                defaultValue={JSON.stringify(agent.config.config?.responseSchema, null, 2) || ''}
                                onBlur={(e) => handleSchemaChange(e.target.value)}
                             />
                        </div>
                     </div>
                </div>
            </CardContent>
        </Card>
    );
};


const SettingsView: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>(() => agentService.getAgents());
  const { settings, setSettings } = useSettings();
  const { toast } = useToast();

  const handleConfigChange = useCallback((agentId: string, newConfig: Partial<AgentConfig>) => {
    agentService.updateAgentConfig(agentId, newConfig);
    setAgents(agentService.getAgents());
  }, []);
  
  const thoughtStyles: { id: AgentThoughtsStyle; label: string; }[] = [
    { id: 'default', label: 'Default Card' },
    { id: 'terminal', label: 'Terminal' },
    { id: 'blueprint', label: 'Blueprint' },
    { id: 'handwritten', label: 'Handwritten' },
    { id: 'code-comment', label: 'Code Comment' },
    { id: 'matrix', label: 'Matrix' },
    { id: 'scroll', label: 'Scroll' },
    { id: 'notebook', label: 'Notebook' },
    { id: 'gradient-glow', label: 'Gradient Glow' },
    { id: 'scientific-journal', label: 'Scientific' },
    { id: 'redacted', label: 'Redacted' },
  ];
  
  const workflowStyles: { id: WorkflowVisualType; label: string; preview: React.ReactNode }[] = [
    { id: 'simple-list', label: 'Simple List', preview: <div className="text-xs space-y-1"><p className="flex items-center"><CheckCircleIcon className="w-3 h-3 mr-1 text-success"/>Agent 1</p><p className="flex items-center"><BotIcon className="w-3 h-3 mr-1"/>Agent 2</p></div> },
    { id: 'detailed-card', label: 'Detailed Card', preview: <div className="text-xs p-1 rounded-md bg-secondary border"><p className="font-bold">Agent 1</p><p className="opacity-70">Task...</p></div> },
    { id: 'timeline', label: 'Timeline', preview: <div className="text-xs relative"><div className="absolute left-1 top-1 h-full w-0.5 bg-border"></div><div className="relative pl-3"><div className="absolute -left-0.5 top-0.5 w-2 h-2 rounded-full bg-success"></div>Agent 1</div><div className="relative pl-3 mt-1"><div className="absolute -left-0.5 top-0.5 w-2 h-2 rounded-full bg-primary"></div>Agent 2</div></div> },
    { id: 'metro-grid', label: 'Metro Grid', preview: <div className="grid grid-cols-2 gap-1 w-full h-full">{Array(4).fill(0).map((_,i) => <div key={i} className={cn("rounded-sm", i === 0 ? "bg-success/50" : i === 1 ? "bg-primary/50" : "bg-border")}></div>)}</div> },
    { id: 'stepped-process', label: 'Stepped Process', preview: <div className="flex items-center w-full"><div className="w-3 h-3 rounded-full bg-success"></div><div className="flex-1 h-0.5 bg-border mx-1"></div><div className="w-3 h-3 rounded-full bg-primary"></div><div className="flex-1 h-0.5 bg-border mx-1"></div><div className="w-3 h-3 rounded-full bg-border"></div></div> },
    { id: 'minimalist-log', label: 'Minimalist Log', preview: <div className="text-left font-mono text-[10px] leading-tight"><p><span className="text-green-500">[OK]</span> Agent 1</p><p><span className="text-blue-500">[RUN]</span> Agent 2</p><p><span className="opacity-50">[...]</span> Agent 3</p></div> },
  ];

  const handleClearCache = async () => {
      await cacheService.clear();
      toast({ title: "Success", description: "Generation cache has been cleared." });
  };

  const handleClearMemories = async () => {
      await agentMemoryService.clearAllMemories(true); // Pass true to bypass confirm
      toast({ title: "Success", description: "All agent memories have been cleared.", variant: 'destructive' });
  };


  return (
    <div className="flex flex-col h-full">
      <ViewHeader
        icon={<SettingsIcon className="w-6 h-6" />}
        title="Settings"
        description="Fine-tune general settings and parameters for each AI agent."
      />

      <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
        <Tabs defaultValue="general">
          <TabsList className="flex-wrap h-auto justify-start sticky top-0 bg-background/80 backdrop-blur-sm z-10">
            <TabsTrigger value="general">General</TabsTrigger>
            {agents.map(agent => (
                <TabsTrigger key={agent.id} value={agent.id}>{agent.name}</TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="general" className="mt-6">
             <Card>
                <CardHeader>
                    <CardTitle>General Settings</CardTitle>
                    <CardDescription>Customize the look and feel of the application.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                    <div className="space-y-4">
                        <Label>Agent Thoughts Visual Style</Label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {thoughtStyles.map(style => (
                                <div
                                    key={style.id}
                                    onClick={() => setSettings({ ...settings, agentThoughtsStyle: style.id })}
                                    className={cn(
                                        "p-2 rounded-lg border-2 cursor-pointer transition-all card-interactive",
                                        settings.agentThoughtsStyle === style.id ? 'border-primary shadow-lg scale-105' : 'border-border hover:border-primary/50'
                                    )}
                                >
                                    <div className={cn('p-2 rounded-md h-20 flex items-center justify-center text-xs overflow-hidden',
                                        style.id === 'default' && 'bg-muted/50',
                                        style.id === 'terminal' && 'thoughts-terminal',
                                        style.id === 'blueprint' && 'thoughts-blueprint',
                                        style.id === 'handwritten' && 'thoughts-handwritten',
                                        style.id === 'code-comment' && 'thoughts-code-comment',
                                        style.id === 'matrix' && 'thoughts-matrix',
                                        style.id === 'scroll' && 'thoughts-scroll',
                                        style.id === 'notebook' && 'thoughts-notebook',
                                        style.id === 'gradient-glow' && 'thoughts-gradient-glow',
                                        style.id === 'scientific-journal' && 'thoughts-scientific-journal',
                                        style.id === 'redacted' && 'thoughts-redacted',
                                     )}>
                                        <p className={cn(
                                            'break-all',
                                            style.id === 'code-comment' && 'thoughts-code-comment-content',
                                        )}>
                                            {style.id === 'redacted' ? 'TOP SECRET <span class="redacted-text">AGENT</span> THOUGHTS' : 'Agent thoughts...'}
                                        </p>
                                     </div>
                                     <p className="text-center text-sm font-medium mt-2">{style.label}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    <div className="border-t pt-6 space-y-4">
                        <Label>Workflow Visual Style</Label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {workflowStyles.map(style => (
                                <div
                                    key={style.id}
                                    onClick={() => setSettings({ ...settings, workflowVisual: style.id })}
                                    className={cn(
                                        "p-2 rounded-lg border-2 cursor-pointer transition-all card-interactive",
                                        settings.workflowVisual === style.id ? 'border-primary shadow-lg scale-105' : 'border-border hover:border-primary/50'
                                    )}
                                >
                                    <div className="p-2 rounded-md h-20 flex items-center justify-center overflow-hidden bg-muted/50">
                                       {style.preview}
                                    </div>
                                    <p className="text-center text-sm font-medium mt-2">{style.label}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="border-t pt-6">
                        <h3 className="text-lg font-medium text-foreground mb-2">Data Management</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            Control data stored in your browser's local storage. Caching improves performance, while agent memories help the AI learn from feedback.
                        </p>
                        <div className="space-y-4">
                             <div className="flex items-center justify-between">
                                <Label htmlFor="cache-toggle" className="flex flex-col space-y-1">
                                    <span>Enable Generation Cache</span>
                                    <span className="font-normal text-xs text-muted-foreground">Cache results from README, Code Graph, etc.</span>
                                </Label>
                                <Switch
                                    id="cache-toggle"
                                    checked={settings.isCacheEnabled}
                                    onCheckedChange={(checked) => setSettings({ ...settings, isCacheEnabled: checked })}
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                 <Label className="flex flex-col space-y-1">
                                    <span>Clear Generation Cache</span>
                                    <span className="font-normal text-xs text-muted-foreground">Removes all cached generation results.</span>
                                </Label>
                                <Button
                                    variant="outline"
                                    onClick={handleClearCache}
                                >
                                    Clear Now
                                </Button>
                            </div>
                            <div className="flex items-center justify-between">
                                 <Label className="flex flex-col space-y-1">
                                    <span>Clear All Agent Memories</span>
                                    <span className="font-normal text-xs text-muted-foreground">Resets all learned feedback for every agent.</span>
                                </Label>
                                <Button
                                    variant="destructive"
                                    onClick={() => {
                                        if (window.confirm("Are you sure you want to clear all learned memories for every agent? This action cannot be undone.")) {
                                            handleClearMemories();
                                        }
                                    }}
                                >
                                    Clear Memories
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
          </TabsContent>

          {agents.map((agent) => (
             <TabsContent key={agent.id} value={agent.id} className="mt-6">
                 <AgentSettings 
                    agent={agent}
                    onConfigChange={handleConfigChange}
                />
             </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
};

export default SettingsView;