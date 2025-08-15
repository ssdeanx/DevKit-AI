import React, { useState, useCallback } from 'react';
import { agentService } from '../services/agent.service';
import { Agent, AgentConfig } from '../agents/types';
import { ThinkingConfig, GenerationConfig, Tool } from '@google/genai';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Label } from '../components/ui/Label';
import { Slider } from '../components/ui/Slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/Select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/Tabs';
import { useSettings, AgentThoughtsStyle, WorkflowVisualType } from '../context/SettingsContext';
import WorkflowVisual from '../components/WorkflowVisual';
import { Textarea } from '../components/ui/Textarea';
import { Switch } from '../components/ui/Switch'; 
import { cn } from '../lib/utils';
import { cacheService } from '../services/cache.service';
import { Button } from '../components/ui/Button';


const SettingsSlider: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}> = ({ label, value, min, max, step, onChange }) => (
    <div className="space-y-2">
        <div className="flex justify-between items-center">
            <Label>{label}</Label>
            <span className="text-sm font-mono px-2 py-0.5 bg-muted rounded">{value.toFixed(step < 1 ? 2 : 0)}</span>
        </div>
        <Slider
            value={[value]}
            onValueChange={(v) => onChange(v[0])}
            min={min}
            max={max}
            step={step}
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
                    <SettingsSlider
                        label="Thinking Budget"
                        min={0} max={24576} step={128}
                        value={agent.config.config?.thinkingConfig?.thinkingBudget ?? 8192}
                        onChange={(v) => handleThinkingConfigChange('thinkingBudget', v)}
                    />
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

  const handleConfigChange = useCallback((agentId: string, newConfig: Partial<AgentConfig>) => {
    agentService.updateAgentConfig(agentId, newConfig);
    setAgents(agentService.getAgents());
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-y-auto">
      <header className="p-6 border-b sticky top-0 bg-background/95 backdrop-blur z-10">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Fine-tune general settings and parameters for each AI agent.</p>
      </header>

      <div className="p-6">
        <Tabs defaultValue="general">
          <TabsList className="flex-wrap h-auto justify-start">
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
                        <Select value={settings.agentThoughtsStyle} onValueChange={(v) => setSettings({ ...settings, agentThoughtsStyle: v as AgentThoughtsStyle })}>
                            <SelectTrigger className="w-full md:w-1/2">
                                <SelectValue placeholder="Select style"/>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="default">Default Card</SelectItem>
                                <SelectItem value="terminal">Terminal</SelectItem>
                                <SelectItem value="blueprint">Blueprint</SelectItem>
                                <SelectItem value="handwritten">Handwritten Notes</SelectItem>
                                <SelectItem value="code-comment">Code Comment</SelectItem>
                                <SelectItem value="matrix">Matrix</SelectItem>
                                <SelectItem value="scroll">Ancient Scroll</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-4">
                        <Label>Workflow Visualizer</Label>
                        <Select value={settings.workflowVisual} onValueChange={(v) => setSettings({ ...settings, workflowVisual: v as WorkflowVisualType })}>
                            <SelectTrigger className="w-full md:w-1/2">
                                <SelectValue placeholder="Select visual"/>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="simple">Simple Flow</SelectItem>
                                <SelectItem value="detailed">Detailed Flow</SelectItem>
                            </SelectContent>
                        </Select>
                        <div className="p-4 border rounded-lg bg-secondary/50 mt-4">
                            <WorkflowVisual style={settings.workflowVisual} />
                        </div>
                    </div>
                    <div className="border-t pt-6">
                        <h3 className="text-lg font-medium text-foreground mb-2">Generation Cache</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            Cache expensive generation results (like code graphs or documentation) in your browser's local storage to reduce token usage and speed up repeated requests.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <Switch
                                    id="cache-toggle"
                                    checked={settings.isCacheEnabled}
                                    onCheckedChange={(checked) => setSettings({ ...settings, isCacheEnabled: checked })}
                                />
                                <Label htmlFor="cache-toggle">Enable Cache</Label>
                            </div>
                            <Button
                                variant="outline"
                                onClick={async () => await cacheService.clear()}
                            >
                                Clear Cache Now
                            </Button>
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