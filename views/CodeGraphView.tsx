import React, { useState, useContext, useCallback, useEffect, useMemo } from 'react';
import ReactFlow, {
  Controls,
  Background,
  MiniMap,
  BackgroundVariant,
  Panel,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  NodeProps,
} from 'reactflow';
import type { Node, Edge } from 'reactflow';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  Simulation,
  SimulationNodeDatum,
} from 'd3-force';
import { GithubContext } from '../context/GithubContext';
import { supervisor } from '../services/supervisor';
import { CodeGraphAgent } from '../agents/CodeGraphAgent';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { CodeGraphIcon, LoaderIcon, BrainIcon, VercelTriangleIcon, BracketsIcon, ServerIcon, DocumentIcon, SettingsIcon, SearchIcon } from '../components/icons';
import { cacheService } from '../services/cache.service';
import { useSettings } from '../context/SettingsContext';
import EmptyState from '../components/EmptyState';
import ViewHeader from '../components/ViewHeader';
import { useStreamingOperation } from '../hooks/useStreamingOperation';
import { Button } from '../components/ui/Button';
import GenerationInProgress from '../components/GenerationInProgress';
import { cn } from '../lib/utils';
import { Input } from '../components/ui/Input';

const getNodeColor = (type?: string) => {
    switch (type) {
        case 'entry': return 'hsl(var(--dv-pink))';
        case 'view': return 'hsl(var(--dv-purple))';
        case 'component': return 'hsl(var(--dv-blue))';
        case 'service': return 'hsl(var(--dv-teal))';
        case 'hook': return 'hsl(var(--dv-teal))';
        case 'context': return 'hsl(var(--dv-teal))';
        case 'config': return 'hsl(var(--dv-orange))';
        case 'group': return 'hsl(var(--secondary))';
        default: return 'hsl(var(--muted-foreground))';
    }
};

const getNodeIcon = (type?: string) => {
    const className = "w-4 h-4 mr-2";
    switch (type) {
        case 'entry': return <VercelTriangleIcon className={className} />;
        case 'view': return <VercelTriangleIcon className={className} />;
        case 'component': return <BracketsIcon className={className} />;
        case 'service': return <ServerIcon className={className} />;
        case 'hook': return <ServerIcon className={className} />;
        case 'context': return <ServerIcon className={className} />;
        case 'config': return <SettingsIcon className={className} />;
        default: return <DocumentIcon className={className} />;
    }
}

const CustomNode: React.FC<NodeProps> = React.memo(({ data }) => (
    <div className="flex items-center justify-center w-full h-full p-2">
        {getNodeIcon(data.type)}
        <span className="truncate">{data.label}</span>
    </div>
));
CustomNode.displayName = 'CustomNode';


const nodeTypes = {
  custom: CustomNode,
};

type SimulationNode = Node & SimulationNodeDatum;

const Graph: React.FC<{ rawNodes: Node[], rawEdges: Edge[] }> = ({ rawNodes, rawEdges }) => {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const { fitView } = useReactFlow();
    const [highlightedNode, setHighlightedNode] = useState<string | null>(null);

    const onNodeMouseEnter = useCallback((_: any, node: Node) => setHighlightedNode(node.id), []);
    const onNodeMouseLeave = useCallback(() => setHighlightedNode(null), []);

    useEffect(() => {
        if (rawNodes.length === 0) return;

        const degreeMap = new Map<string, number>();
        rawEdges.forEach(edge => {
            degreeMap.set(edge.source, (degreeMap.get(edge.source) || 0) + 1);
            degreeMap.set(edge.target, (degreeMap.get(edge.target) || 0) + 1);
        });

        const initialNodes = rawNodes.map(node => {
            const isGroup = node.data.type === 'group';
            return {
                ...node,
                type: isGroup ? 'default' : 'custom',
                position: { x: Math.random() * 800, y: Math.random() * 600 },
                style: {
                    border: `2px solid ${getNodeColor(node.data.type)}`,
                    backgroundColor: isGroup ? 'hsl(var(--secondary) / 0.5)' : 'hsl(var(--card))',
                    color: 'hsl(var(--card-foreground))',
                    width: isGroup ? 300 : Math.max(150, node.data.label.length * 8 + 40),
                    height: isGroup ? 200 : 40,
                    fontSize: '12px',
                    borderRadius: '8px',
                },
            };
        });

        const initialEdges = rawEdges.map(edge => ({
            ...edge,
            animated: true,
            style: { 
                strokeWidth: 1 + Math.min(degreeMap.get(edge.source) || 0, degreeMap.get(edge.target) || 0) / 5,
                stroke: 'hsl(var(--border))',
            },
        }));
        
        const nodesForSimulation = initialNodes.map(n => ({ ...n })) as SimulationNode[];

        const simulation: Simulation<SimulationNode, Edge> = forceSimulation(nodesForSimulation)
            .force('link', forceLink<SimulationNode, Edge>(initialEdges).id((d) => d.id).distance(120))
            .force('charge', forceManyBody().strength(-300))
            .force('center', forceCenter(window.innerWidth / 4, window.innerHeight / 4))
            .on('end', () => {
                const finalNodes = initialNodes.map(n => {
                    const simNode = nodesForSimulation.find(sn => sn.id === n.id);
                    return simNode ? { ...n, position: { x: simNode.x ?? 0, y: simNode.y ?? 0 } } : n;
                });
                setNodes(finalNodes);
                setEdges(initialEdges);
                setTimeout(() => fitView({ padding: 0.1, duration: 800 }), 100);
            });
            
    }, [rawNodes, rawEdges, setNodes, setEdges, fitView]);
    
    const memoizedNodes = useMemo(() => {
        if (!highlightedNode) return nodes.map(n => ({...n, className: ''}));

        const neighborEdges = rawEdges.filter(edge => edge.source === highlightedNode || edge.target === highlightedNode);
        const neighborNodeIds = new Set(neighborEdges.flatMap(edge => [edge.source, edge.target]));
        neighborNodeIds.add(highlightedNode);

        return nodes.map(n => ({ ...n, className: neighborNodeIds.has(n.id) ? '' : 'dimmed' }));
    }, [nodes, highlightedNode, rawEdges]);

    const memoizedEdges = useMemo(() => {
        if (!highlightedNode) return edges.map(e => ({...e, className: ''}));

        const neighborEdges = rawEdges.filter(edge => edge.source === highlightedNode || edge.target === highlightedNode);
        
        return edges.map(e => ({ ...e, className: neighborEdges.some(ne => ne.id === e.id) ? '' : 'dimmed' }));
    }, [edges, highlightedNode, rawEdges]);


    return (
        <ReactFlow
            nodes={memoizedNodes}
            edges={memoizedEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeMouseEnter={onNodeMouseEnter}
            onNodeMouseLeave={onNodeMouseLeave}
            fitView
            className="bg-transparent"
            proOptions={{ hideAttribution: true }}
            nodeTypes={nodeTypes}
        >
            <Background variant={BackgroundVariant.Dots} gap={24} size={1} />
            <Controls />
            <MiniMap nodeColor={n => getNodeColor(n.data.type)} nodeStrokeWidth={3} zoomable pannable />
            <Panel position="top-right" className="p-0 m-2">
                <Card className="glass-effect w-64">
                    <CardContent className="p-3 text-center text-sm text-muted-foreground">
                       <p>Hover over a node to highlight its dependencies.</p>
                    </CardContent>
                </Card>
            </Panel>
        </ReactFlow>
    );
};


const CodeGraphView: React.FC = () => {
  const { fileTree, repoUrl, apiKey } = useContext(GithubContext);
  const { settings } = useSettings();
  const [graphData, setGraphData] = useState<{ nodes: Node[], edges: Edge[] } | null>(null);

  const generateGraphOperation = useStreamingOperation(async () => {
    if (!fileTree) {
      throw new Error("A GitHub repository must be loaded first.");
    }
    setGraphData(null); // Clear previous graph
    
    const cacheKey = `code-graph-v5::${repoUrl}`;
    if (settings.isCacheEnabled) {
      const cached = await cacheService.get<string>(cacheKey);
      if (cached) {
        console.log("CodeGraphView: Using cached version.");
        const stream = async function*() {
            yield { type: 'content' as const, content: cached, agentName: CodeGraphAgent.name };
        }();
        return { agent: CodeGraphAgent, stream };
      }
    }

    const prompt = "Generate a code graph for the current project structure.";
    // FIX: Pass repoUrl to satisfy FullGitContext type
    return supervisor.handleRequest(prompt, { repoUrl, fileTree, stagedFiles:[], apiKey }, { setActiveView: () => {} }, CodeGraphAgent.id);
  });

  useEffect(() => {
    if (generateGraphOperation.content) {
      try {
        const parsed = JSON.parse(generateGraphOperation.content);
        setGraphData(parsed);
        if (settings.isCacheEnabled && repoUrl) {
          const cacheKey = `code-graph-v5::${repoUrl}`;
          cacheService.set(cacheKey, generateGraphOperation.content, 10 * 60 * 1000); // 10 min cache
        }
      } catch (e) {
        console.error("Failed to parse graph JSON:", e);
      }
    }
  }, [generateGraphOperation.content, settings.isCacheEnabled, repoUrl]);


  useEffect(() => {
      if (repoUrl && fileTree) {
        generateGraphOperation.execute();
      }
  }, [repoUrl, fileTree, generateGraphOperation]);

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
        <ViewHeader
            icon={<CodeGraphIcon className="w-6 h-6" />}
            title="Code Graph"
            description="Visualize your repository's architecture with a dynamic, force-directed graph."
        >
          {repoUrl && <Button onClick={generateGraphOperation.execute} disabled={generateGraphOperation.isLoading} variant="outline">Regenerate</Button>}
        </ViewHeader>
        <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 relative">
                {generateGraphOperation.isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-10">
                        <GenerationInProgress agentName={generateGraphOperation.agentName} thoughts={generateGraphOperation.thoughts} />
                    </div>
                )}

                {!repoUrl && !generateGraphOperation.isLoading && (
                     <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                        <EmptyState
                            icon={<CodeGraphIcon className="w-12 h-12 text-foreground" />}
                            title="Load a Repository"
                            description="Go to the 'GitHub Inspector' tab to load a repository first."
                        />
                    </div>
                )}
                
                {graphData && !generateGraphOperation.isLoading && (
                     <ReactFlowProvider>
                        <Graph rawNodes={graphData.nodes} rawEdges={graphData.edges} />
                    </ReactFlowProvider>
                )}
            </div>
        </div>
    </div>
  );
};

export default CodeGraphView;