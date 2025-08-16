import React, { useState, useContext, useCallback, useEffect } from 'react';
import ReactFlow, {
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  MiniMap,
  BackgroundVariant,
  Panel,
} from 'reactflow';
import type { Node, Edge, NodeChange, EdgeChange } from 'reactflow';
import ELK from 'elkjs';
import type { ElkNode, ElkExtendedEdge } from 'elkjs';
import { GithubContext } from '../context/GithubContext';
import { supervisor } from '../services/supervisor';
import { CodeGraphAgent } from '../agents/CodeGraphAgent';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { CodeGraphIcon, CloseIcon, LoaderIcon } from '../components/icons';
import { cacheService } from '../services/cache.service';
import { useSettings } from '../context/SettingsContext';
import { useAsyncOperation } from '../hooks/useAsyncOperation';
import EmptyState from '../components/EmptyState';
import ViewHeader from '../components/ViewHeader';

const getNodeColor = (type?: string) => {
    switch (type) {
        case 'entry': return 'hsl(var(--primary))';
        case 'view': return 'hsl(var(--ring))';
        case 'component': return 'hsl(var(--success))';
        case 'service': return 'hsl(var(--purple))';
        case 'config': return 'hsl(var(--warning))';
        case 'group': return 'hsl(var(--border))';
        default: return 'hsl(var(--muted-foreground))';
    }
};

const elk = new ELK();

const getLayoutedElements = async (nodes: Node[], edges: Edge[]): Promise<{ nodes: Node[], edges: Edge[] }> => {
    const elkNodes: ElkNode[] = nodes.map(node => ({
        id: node.id,
        width: node.width ?? 150,
        height: node.height ?? 40,
    }));

    const elkEdges: ElkExtendedEdge[] = edges.map(edge => ({
        id: edge.id,
        sources: [edge.source],
        targets: [edge.target],
    }));

    const graph: ElkNode = {
        id: 'root',
        layoutOptions: { 
            'elk.algorithm': 'layered',
            'elk.direction': 'RIGHT',
            'elk.spacing.nodeNode': '80' 
        },
        children: elkNodes,
        edges: elkEdges,
    };

    const layoutedGraph = await elk.layout(graph);
    
    const newNodes: Node[] = layoutedGraph.children?.map(elkNode => {
        const originalNode = nodes.find(n => n.id === elkNode.id);
        return {
            ...originalNode!,
            position: { x: elkNode.x!, y: elkNode.y! },
        };
    }) || [];
    
    const newEdges: Edge[] = layoutedGraph.edges?.map(elkEdge => {
        const originalEdge = edges.find(e => e.id === elkEdge.id);
        if (!originalEdge) return null;
        
        return {
            ...originalEdge,
            id: elkEdge.id,
            source: elkEdge.sources[0],
            target: elkEdge.targets[0],
        };
    }).filter(Boolean) as Edge[] || [];

    return {
        nodes: newNodes,
        edges: newEdges,
    };
};

const CodeGraphView: React.FC = () => {
  const { fileTree, repoUrl, stagedFiles, isLoading: isRepoLoading } = useContext(GithubContext);
  const { settings } = useSettings();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [isGraphLoading, setIsGraphLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);


  const onNodesChange = useCallback((changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);

  const handleGenerateGraph = useCallback(async () => {
    if (!fileTree) {
      setError("A GitHub repository must be loaded first.");
      return;
    }

    const cacheKey = `code-graph-v2::${repoUrl}`;
    if (settings.isCacheEnabled) {
        const hasCache = await cacheService.has(cacheKey);
        if (hasCache) {
            console.log(`CodeGraphView: Loading graph from cache for key: ${cacheKey}`);
            const cachedData = await cacheService.get<{ nodes: Node[], edges: Edge[] }>(cacheKey);
            if (cachedData) {
                const { nodes: layoutedNodes, edges: layoutedEdges } = await getLayoutedElements(cachedData.nodes, cachedData.edges);
                setNodes(layoutedNodes);
                setEdges(layoutedEdges.map(e => ({ ...e, animated: true })));
                return;
            }
        }
    }

    console.log("CodeGraphView: Starting graph generation (no cache).");
    setIsGraphLoading(true);
    setError(null);
    setNodes([]);
    setEdges([]);
    setSelectedNode(null);
    
    let graphJsonString = '';
    try {
      const prompt = "Generate a code graph for the current project structure, classifying nodes and grouping them by directory. Do not calculate positions.";
      const { stream } = await supervisor.handleRequest(prompt, { fileTree, stagedFiles }, { setActiveView: () => {} }, CodeGraphAgent.id);
      
      for await (const chunk of stream) {
        if (chunk.type === 'content') {
          graphJsonString += chunk.content;
        }
      }
      
      const graphData = JSON.parse(graphJsonString);
      const rawNodes = graphData.nodes.map((node: Node) => ({
        ...node,
        style: {
            ...node.style,
            border: `2px solid ${getNodeColor(node.data.type)}`,
            backgroundColor: node.data.type === 'group' ? 'hsla(var(--card), 0.1)' : 'hsl(var(--card))',
            color: 'hsl(var(--card-foreground))',
        },
      }));
      const rawEdges = graphData.edges || [];

      const { nodes: layoutedNodes, edges: layoutedEdges } = await getLayoutedElements(rawNodes, rawEdges);
      setNodes(layoutedNodes);
      setEdges(layoutedEdges.map(e => ({ ...e, animated: true })));
      
      if (settings.isCacheEnabled) {
          console.log(`CodeGraphView: Saving graph to cache with key: ${cacheKey}`);
          await cacheService.set(cacheKey, { nodes: rawNodes, edges: rawEdges });
      }

    } catch (err) {
      console.error("CodeGraphView: Error generating or parsing graph data:", err);
      console.error("CodeGraphView: Raw AI output that failed to parse:", graphJsonString);
      setError("Failed to generate the code graph. The AI may have returned an invalid structure. Please try again.");
    } finally {
      setIsGraphLoading(false);
    }
  }, [fileTree, repoUrl, settings.isCacheEnabled, stagedFiles]);

  const summarizeOperation = useAsyncOperation(async (node: Node | null) => {
    if (!node) return null;
    const prompt = `Based on the file path "${node.id}", what is the likely purpose of this file? Provide a one-sentence summary.`;
    const { stream } = await supervisor.handleRequest(prompt, { fileTree, stagedFiles }, { setActiveView: () => {} }, 'chat-agent');
    let content = '';
    for await (const chunk of stream) {
        if (chunk.type === 'content') content += chunk.content;
    }
    return content;
  }, {
      onError: (e) => console.error(e)
  });

  const onNodeMouseEnter = (_: React.MouseEvent, node: Node) => setHoveredNodeId(node.id);
  const onNodeMouseLeave = () => setHoveredNodeId(null);
  
  useEffect(() => {
    if (!hoveredNodeId) {
        setNodes(nds => nds.map(n => ({ ...n, className: '' })));
        setEdges(eds => eds.map(e => ({ ...e, className: '' })));
        return;
    }
    const connectedEdges = edges.filter(e => e.source === hoveredNodeId || e.target === hoveredNodeId);
    const connectedNodeIds = new Set(connectedEdges.flatMap(e => [e.source, e.target]));
    
    setNodes(nds =>
        nds.map(n => ({
            ...n,
            className: n.id !== hoveredNodeId && !connectedNodeIds.has(n.id) ? 'dimmed' : '',
        }))
    );
     setEdges(eds =>
        eds.map(e => ({
            ...e,
            className: !connectedEdges.some(ce => ce.id === e.id) ? 'dimmed' : '',
        }))
    );

  }, [hoveredNodeId, edges, setNodes, setEdges]);


  useEffect(() => {
    if (!repoUrl) {
      setNodes([]);
      setEdges([]);
      setError(null);
      setSelectedNode(null);
    }
  }, [repoUrl]);
  
  const isButtonDisabled = isRepoLoading || isGraphLoading || !repoUrl;

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <ViewHeader
        icon={<CodeGraphIcon className="w-6 h-6" />}
        title="Code Graph"
        description="Visualize the architecture of your loaded GitHub repository."
      />
      
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={(_, node) => { setSelectedNode(node); summarizeOperation.reset(); }}
          onNodeMouseEnter={onNodeMouseEnter}
          onNodeMouseLeave={onNodeMouseLeave}
          fitView
          className="bg-background"
        >
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
          <Controls />
          <MiniMap nodeColor={(node) => getNodeColor(node.data.type)} nodeStrokeWidth={3} zoomable pannable />
          <Panel position="bottom-left">
            <Card className="glass-effect w-48">
                <CardHeader className="p-3">
                    <CardTitle className="text-sm">Legend</CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0 space-y-1">
                    {['entry', 'view', 'component', 'service', 'config', 'other'].map(type => (
                        <div key={type} className="flex items-center text-xs">
                            <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: getNodeColor(type) }}></div>
                            <span className="capitalize">{type}</span>
                        </div>
                    ))}
                </CardContent>
            </Card>
          </Panel>
        </ReactFlow>

        <div className="absolute top-4 left-4 z-10 w-full max-w-sm">
           <Card className="glass-effect">
                <CardHeader>
                    <CardTitle>Generate Project Graph</CardTitle>
                    <CardDescription>
                        {repoUrl 
                            ? <>Analyzing: <span className="font-mono text-primary/80">{repoUrl.split('/').slice(-2).join('/')}</span></> 
                            : 'Load a repo in the GitHub Inspector to begin.'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={handleGenerateGraph} disabled={isButtonDisabled} size="lg" className="w-full">
                        {isGraphLoading ? 'Generating...' : 'Generate Graph'}
                    </Button>
                    {error && <p className="text-xs text-destructive mt-3">{error}</p>}
                </CardContent>
           </Card>
        </div>

        {selectedNode && (
            <div className="absolute top-4 right-4 z-10 w-full max-w-sm">
                <Card className="glass-effect animate-in">
                    <CardHeader className="flex flex-row items-start justify-between p-4">
                        <div className="space-y-1">
                            <CardTitle className="text-base break-all">{selectedNode.data.label}</CardTitle>
                            <CardDescription className="text-xs">Type: <span className="font-semibold capitalize" style={{color: getNodeColor(selectedNode.data.type)}}>{selectedNode.data.type}</span></CardDescription>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedNode(null)}>
                            <CloseIcon className="h-4 w-4" />
                        </Button>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <p className="text-xs text-muted-foreground break-all mb-4"><strong>Path:</strong> {selectedNode.id}</p>
                        <div className="space-y-2">
                             <Button onClick={() => summarizeOperation.execute(selectedNode)} disabled={summarizeOperation.isLoading} className="w-full">
                                {summarizeOperation.isLoading ? 'Summarizing...' : 'Summarize File (AI)'}
                            </Button>
                            {summarizeOperation.data && <p className="text-sm bg-muted/50 p-3 rounded-md animate-in">{summarizeOperation.data}</p>}
                            {summarizeOperation.error && <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-md animate-in">Could not generate summary.</p>}
                        </div>
                    </CardContent>
                </Card>
            </div>
        )}

        {isGraphLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm z-20 animate-in">
                <LoaderIcon className="w-12 h-12 text-primary animate-spin" />
                <h2 className="text-xl font-semibold mt-6 text-foreground">Generating Code Graph...</h2>
                <p className="text-muted-foreground mt-2">The AI architect is analyzing your repository structure.</p>
                <p className="text-muted-foreground text-sm">This may take a moment.</p>
            </div>
        )}

        {!isGraphLoading && nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                <EmptyState
                    icon={<CodeGraphIcon className="w-12 h-12 text-foreground" />}
                    title="Code Graph Visualizer"
                    description={repoUrl 
                        ? "Your project is loaded. Click the 'Generate Graph' button to visualize its structure."
                        : "Go to the 'GitHub Inspector' tab to load a repository first, then come back here to generate the graph."}
                />
            </div>
        )}
      </div>
    </div>
  );
};

export default CodeGraphView;