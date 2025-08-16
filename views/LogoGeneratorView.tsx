

import React, { useState } from 'react';
import { geminiService } from '../services/gemini.service';
import { DownloadIcon, ImageIcon, FileSvgIcon, SparklesIcon } from '../components/icons';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
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


type AspectRatio = "1:1" | "3:4" | "4:3" | "9:16" | "16:9";

const LogoGeneratorView: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [numberOfImages, setNumberOfImages] = useState(1);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");

  const generateImagesOperation = useAsyncOperation(async () => {
    if (!prompt.trim()) {
      throw new Error("Please enter a prompt.");
    }
    console.log(`LogoGeneratorView: Generating ${numberOfImages} image(s) with aspect ratio ${aspectRatio} for prompt: "${prompt}"`);
    const images = await geminiService.generateImages(prompt, {
      numberOfImages,
      aspectRatio,
    });
    return images.map(img => img.image.imageBytes);
  });
  
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
        generateImagesOperation.setError("Failed to convert image to SVG. This feature works best for simple, high-contrast images.");
    }
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
                        onClick={generateImagesOperation.execute}
                        disabled={generateImagesOperation.isLoading}
                        className="self-end"
                        size="lg"
                    >
                      {generateImagesOperation.isLoading ? 'Generating...' : "Generate"}
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
              {generateImagesOperation.error && <div className="text-destructive bg-destructive/10 p-4 rounded-lg text-center">{generateImagesOperation.error}</div>}
              
              {generateImagesOperation.data && generateImagesOperation.data.length > 0 && (
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {generateImagesOperation.data.map((img, index) => (
                    <div key={index} className="group relative overflow-hidden card-glow-border">
                      <img src={`data:image/png;base64,${img}`} alt={`Generated image ${index + 1}`} className="w-full h-full object-contain aspect-video bg-muted/50" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <Button onClick={() => handleDownloadPng(img, index)} size="icon" variant="secondary" data-tooltip="Download PNG">
                              <DownloadIcon className="w-5 h-5" />
                          </Button>
                          <Button onClick={() => handleDownloadSvg(img, index)} size="icon" variant="secondary" data-tooltip="Download as SVG (Beta)">
                              <FileSvgIcon className="w-5 h-5" />
                          </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!generateImagesOperation.isLoading && !generateImagesOperation.data && !generateImagesOperation.error && (
                 <div className="h-full flex items-center justify-center">
                    <EmptyState
                        icon={<ImageIcon className="w-10 h-10" />}
                        title="Design your brand"
                        description='Enter a prompt above and click "Generate" to create your new logo or banner.'
                    />
                 </div>
              )}
           </div>

            {generateImagesOperation.isLoading && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in">
                    <SparklesIcon className="w-12 h-12 text-primary animate-pulse" />
                    <h3 className="text-xl font-semibold mt-4">Generating Images...</h3>
                    <p className="text-muted-foreground mt-1">The Imagen 3 model is creating your assets.</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default LogoGeneratorView;