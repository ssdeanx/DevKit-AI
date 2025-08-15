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
import { GithubContext } from '../context/GithubContext';
import { supervisor } from '../services/supervisor';
import { CodeGraphAgent } from '../agents/CodeGraphAgent';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { CodeGraphIcon, CloseIcon } from '../components/icons';
import { cacheService } from '../services/cache.service';
import { useSettings } from '../context/SettingsContext';
import { cn } from '../lib/utils';

const getNodeColor = (type?: string) => {
    switch (type) {
        case 'entry': return 'hsl(var(--primary))';
        case 'view': return 'hsl(var(--ring))';
        case 'component': return '#16a34a'; // Green-600
        case 'service': return '#c026d3'; // Fuchsia-600
        case 'config': return '#ca8a04'; // Yellow-600
        case 'group': return 'hsl(var(--border))';
        default: return 'hsl(var(--muted-foreground))';
    }
};

const elk = new ELK();

const getLayoutedElements = async (nodes: Node[], edges: Edge[]) => {
    const graph = {
        id: 'root',
        layoutOptions: { 
            'elk.algorithm': 'layered',
            'elk.direction': 'RIGHT',
            'elk.spacing.nodeNode': '80' 
        },
        children: nodes.map(node => ({
            ...node,
            width: node.width ?? 150,
            height: node.height ?? 40,
        })),
        edges: edges,
    };

    const layoutedGraph = await elk.layout(graph);
    
    return {
        nodes: layoutedGraph.children?.map(node => ({
            ...node,
            // elkjs returns x, y at the top-left, react-flow needs it at the center
            position: { x: node.x!, y: node.y! },
        })) || [],
        edges: layoutedGraph.edges || [],
    };
};

const CodeGraphView: React.FC = () => {
  const { fileTree, repoUrl, isLoading: isRepoLoading } = useContext(GithubContext);
  const { settings } = useSettings();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [isGraphLoading, setIsGraphLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
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
      const { stream } = await supervisor.handleRequest(prompt, fileTree, { setActiveView: () => {} }, CodeGraphAgent.id);
      
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
  }, [fileTree, repoUrl, settings.isCacheEnabled]);

  const handleSummarizeNode = async () => {
    if (!selectedNode) return;
    setIsSummaryLoading(true);
    setSummary(null);
    try {
      const prompt = `Based on the file path "${selectedNode.id}", what is the likely purpose of this file? Provide a one-sentence summary.`;
      const { stream } = await supervisor.handleRequest(prompt, fileTree, { setActiveView: () => {} }, 'chat-agent');
      let content = '';
      for await (const chunk of stream) {
        if (chunk.type === 'content') content += chunk.content;
      }
      setSummary(content);
    } catch (e) {
      console.error(e);
      setSummary("Could not generate summary.");
    } finally {
      setIsSummaryLoading(false);
    }
  };

  const onNodeMouseEnter = (_: React.MouseEvent, node: Node) => setHoveredNodeId(node.id);
  const onNodeMouseLeave = () => setHoveredNodeId(null);
  
  useEffect(() => {
    const connectedEdges = hoveredNodeId ? edges.filter(e => e.source === hoveredNodeId || e.target === hoveredNodeId) : [];
    const connectedNodeIds = new Set(connectedEdges.flatMap(e => [e.source, e.target]));
    
    setNodes(nds =>
        nds.map(n => ({
            ...n,
            className: cn({ 'dimmed': hoveredNodeId && !connectedNodeIds.has(n.id) && n.id !== hoveredNodeId }),
        }))
    );
     setEdges(eds =>
        eds.map(e => ({
            ...e,
            className: cn({ 'dimmed': hoveredNodeId && !connectedEdges.includes(e) }),
        }))
    );

  }, [hoveredNodeId]);


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
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
      <header className="p-6 border-b z-10">
        <h1 className="text-2xl font-bold">Code Graph</h1>
        <p className="text-sm text-muted-foreground">Visualize the architecture of your loaded GitHub repository.</p>
      </header>
      
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={(_, node) => { setSelectedNode(node); setSummary(null); }}
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
                             <Button onClick={handleSummarizeNode} disabled={isSummaryLoading} className="w-full">
                                {isSummaryLoading ? 'Summarizing...' : 'Summarize File (AI)'}
                            </Button>
                            {summary && <p className="text-sm bg-muted/50 p-3 rounded-md animate-in">{summary}</p>}
                        </div>
                    </CardContent>
                </Card>
            </div>
        )}

        {!isGraphLoading && nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center text-muted-foreground p-4 bg-background/50 rounded-lg">
                    <CodeGraphIcon className="w-16 h-16 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold">Code Graph Visualizer</h2>
                    <p>
                        {repoUrl 
                            ? "Click 'Generate Graph' to see your project's structure."
                            : "Go to the 'GitHub Inspector' tab to load a repository first."}
                    </p>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default CodeGraphView;