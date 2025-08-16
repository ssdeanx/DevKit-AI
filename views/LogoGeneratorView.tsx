

import React, { useState, useEffect } from 'react';
import { supervisor } from '../services/supervisor';
import { ImageRefinementAgent } from '../agents/ImageRefinementAgent';
import { geminiService } from '../services/gemini.service';
import { DownloadIcon, ImageIcon, FileSvgIcon, SparklesIcon, RefreshCwIcon, BrainIcon } from '../components/icons';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/Card';
import { Textarea } from '../components/ui/Textarea';
import { Button } from '../components/ui/Button';
import { Label } from '../components/ui/Label';
import { Slider } from '../components/ui/Slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/Select';
import { convertPngToSvg } from '../lib/image';
import ExamplePrompts from '../components/ExamplePrompts';
import ViewHeader from '../components/ViewHeader';
import { useAsyncOperation } from '../hooks/useAsyncOperation';
import EmptyState from '../components/EmptyState';
import { cn } from '../lib/utils';
import { useStreamingOperation } from '../hooks/useStreamingOperation';
import { Content, Part } from '@google/genai';

type AspectRatio = "1:1" | "3:4" | "4:3" | "9:16" | "16:9";

interface RefinementState {
    isOpen: boolean;
    base64Image: string | null;
    originalPrompt: string | null;
    feedback: string;
}

const LogoGeneratorView: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [numberOfImages, setNumberOfImages] = useState(1);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");
  const [refinementState, setRefinementState] = useState<RefinementState>({ isOpen: false, base64Image: null, originalPrompt: null, feedback: '' });

  const { data: generatedImages, isLoading: isGenerating, error: generationError, execute: executeGeneration, setError: setGenerationError } = useAsyncOperation(async (currentPrompt: string) => {
    if (!currentPrompt.trim()) {
      throw new Error("Please enter a prompt.");
    }
    console.log(`LogoGeneratorView: Generating ${numberOfImages} image(s) with aspect ratio ${aspectRatio} for prompt: "${currentPrompt}"`);
    const images = await geminiService.generateImages(currentPrompt, {
      numberOfImages,
      aspectRatio,
    });
    return images.map(img => img.image.imageBytes);
  });
  
  const refinementOperation = useStreamingOperation(async () => {
    if (!refinementState.base64Image || !refinementState.originalPrompt) {
        throw new Error("Missing context for refinement.");
    }
    const imagePart: Part = { inlineData: { mimeType: 'image/png', data: refinementState.base64Image }};
    const textPart: Part = { text: `Original Prompt: "${refinementState.originalPrompt}"\n\nUser Feedback: "${refinementState.feedback}"`};
    const contents: Content[] = [{ role: 'user', parts: [imagePart, textPart] }];
    return supervisor.handleRequest('', { fileTree: null, stagedFiles: [] }, { setActiveView: () => {} }, ImageRefinementAgent.id, undefined, contents);
  });

  useEffect(() => {
    if (refinementOperation.content) {
        try {
            const result = JSON.parse(refinementOperation.content);
            if (result.new_prompt) {
                console.log("Refinement successful, new prompt:", result.new_prompt);
                setPrompt(result.new_prompt);
                setRefinementState({ isOpen: false, base64Image: null, originalPrompt: null, feedback: '' });
                executeGeneration(result.new_prompt);
            }
        } catch (e) {
            console.error("Failed to parse refinement response:", e);
        }
    }
  }, [refinementOperation.content]);

  const handleDownloadPng = (base64Image: string, index: number) => {
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${base64Image}`;
    link.download = `logo_${index + 1}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadSvg = async (base64Image: string, index: number) => {
    try {
        const svgString = await convertPngToSvg(base64Image);
        const blob = new Blob([svgString], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `logo_${index + 1}.svg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (err) {
        console.error("Failed to convert to SVG:", err);
        setGenerationError("Failed to convert image to SVG. This feature works best for simple, high-contrast images.");
    }
  };

  const openRefinementModal = (base64Image: string) => {
    setRefinementState({
        isOpen: true,
        base64Image,
        originalPrompt: prompt,
        feedback: ''
    });
  };
  
  const examplePrompts = [
      "A dynamic, wide-aspect-ratio banner for a GitHub repository about a futuristic UI framework.",
      "Minimalist wordmark logo for 'CodeFlow', a developer tooling company. Emphasize the 'flow' aspect.",
      "An emblem-style logo for an open-source project named 'Orion', featuring a constellation.",
      "A vibrant, abstract banner for a web development agency's homepage."
  ];

  return (
    <div className="flex flex-col h-full">
      <ViewHeader
        icon={<ImageIcon className="w-6 h-6" />}
        title="Logo & Banner Generator"
        description="Design logos and banners for your brand or project."
      />

      <div className="flex-1 grid grid-rows-[auto,1fr] p-6 gap-6 overflow-hidden">
        {/* Control Panel */}
        <Card>
            <CardHeader>
                <CardTitle>Control Panel</CardTitle>
                <CardDescription>Configure the prompt and parameters for logo generation.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 <ExamplePrompts prompts={examplePrompts} onSelectPrompt={setPrompt} />
                <Textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g., A modern, minimalist logo for a tech company called 'Nexus', blue and black, abstract geometric shapes"
                    className="min-h-[80px]"
                />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <Label>Number of images: {numberOfImages}</Label>
                        <Slider
                            value={[numberOfImages]}
                            onValueChange={(value) => setNumberOfImages(value[0])}
                            min={1}
                            max={4}
                            step={1}
                        />
                    </div>
                     <div className="space-y-2">
                        <Label>Aspect Ratio</Label>
                        <Select value={aspectRatio} onValueChange={(v) => setAspectRatio(v as AspectRatio)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select aspect ratio" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="16:9">Banner (16:9)</SelectItem>
                                <SelectItem value="1:1">Square Logo (1:1)</SelectItem>
                                <SelectItem value="9:16">Vertical Banner (9:16)</SelectItem>
                                <SelectItem value="4:3">Landscape (4:3)</SelectItem>
                                <SelectItem value="3:4">Tall (3:4)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Button
                        onClick={() => executeGeneration(prompt)}
                        disabled={isGenerating}
                        className="self-end"
                        size="lg"
                    >
                      {isGenerating ? 'Generating...' : "Generate"}
                    </Button>
                </div>
                 <p className="text-xs text-muted-foreground pt-2">Note: SVG conversion is performed in-browser and works best for high-contrast images. All generated images include a SynthID watermark.</p>
            </CardContent>
        </Card>

        {/* Canvas */}
        <div className={cn("flex flex-col relative aurora-canvas canvas-background p-4 h-full overflow-hidden")}>
           <div className="flex justify-between items-center p-2 relative z-10">
              <h3 className="text-lg font-semibold">Generated Logos & Banners</h3>
           </div>
           <div className="flex-1 overflow-y-auto custom-scrollbar p-2 relative z-10">
              {generationError && <div className="text-destructive bg-destructive/10 p-4 rounded-lg text-center">{generationError}</div>}
              
              {generatedImages && generatedImages.length > 0 && (
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {generatedImages.map((img, index) => (
                    <div key={index} className="group relative overflow-hidden card-glow-border">
                      <img src={`data:image/png;base64,${img}`} alt={`Generated image ${index + 1}`} className="w-full h-full object-contain aspect-video bg-muted/50" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <Button onClick={() => handleDownloadPng(img, index)} size="icon" variant="secondary" data-tooltip="Download PNG">
                              <DownloadIcon className="w-5 h-5" />
                          </Button>
                          <Button onClick={() => handleDownloadSvg(img, index)} size="icon" variant="secondary" data-tooltip="Download as SVG (Beta)">
                              <FileSvgIcon className="w-5 h-5" />
                          </Button>
                          <Button onClick={() => openRefinementModal(img)} size="icon" variant="secondary" data-tooltip="Refine with AI">
                              <RefreshCwIcon className="w-5 h-5" />
                          </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!isGenerating && !generatedImages && !generationError && (
                 <div className="h-full flex items-center justify-center">
                    <EmptyState
                        icon={<ImageIcon className="w-10 h-10" />}
                        title="Design your brand"
                        description='Enter a prompt above and click "Generate" to create your new logo or banner.'
                    />
                 </div>
              )}
           </div>

            {isGenerating && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in">
                    <SparklesIcon className="w-12 h-12 text-primary animate-pulse" />
                    <h3 className="text-xl font-semibold mt-4">Generating Images...</h3>
                    <p className="text-muted-foreground mt-1">The Imagen 3 model is creating your assets.</p>
                </div>
            )}
        </div>
      </div>
      
       {/* Refinement Modal */}
       {refinementState.isOpen && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in">
                <Card className="w-full max-w-3xl">
                    <CardHeader>
                        <CardTitle>Refine Image with AI</CardTitle>
                        <CardDescription>Provide feedback on the image, and the AI will generate a new prompt to improve it.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-6">
                        <div className="flex flex-col gap-4">
                             <img src={`data:image/png;base64,${refinementState.base64Image}`} alt="Image to refine" className="rounded-lg object-contain aspect-square border" />
                             {refinementOperation.thoughts && (
                                <div className="p-2 bg-muted/50 rounded-md text-xs text-muted-foreground">
                                    <p className="font-semibold mb-1 flex items-center gap-1"><BrainIcon className="w-3 h-3"/> AI Thoughts:</p>
                                    <p className="whitespace-pre-wrap font-mono">{refinementOperation.thoughts}</p>
                                </div>
                             )}
                        </div>
                        <div className="space-y-4">
                            <div>
                                <Label>Original Prompt</Label>
                                <p className="text-sm text-muted-foreground p-2 border rounded-md bg-muted/50">{refinementState.originalPrompt}</p>
                            </div>
                            <div>
                                <Label htmlFor="refinement-feedback">Your Feedback</Label>
                                <Textarea
                                    id="refinement-feedback"
                                    placeholder="e.g., 'I like the concept, but make the colors warmer and the style more minimalist.'"
                                    value={refinementState.feedback}
                                    onChange={(e) => setRefinementState(s => ({...s, feedback: e.target.value}))}
                                    className="min-h-[120px]"
                                />
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => setRefinementState(s => ({ ...s, isOpen: false }))}>Cancel</Button>
                        <Button onClick={refinementOperation.execute} disabled={refinementOperation.isLoading || !refinementState.feedback.trim()}>
                            {refinementOperation.isLoading ? 'Refining...' : 'Generate New Prompt & Re-create'}
                        </Button>
                    </CardFooter>
                </Card>
            </div>
       )}
    </div>
  );
};

export default LogoGeneratorView;