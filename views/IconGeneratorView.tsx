
import React, { useState } from 'react';
import { geminiService } from '../services/gemini.service';
import { DownloadIcon, ImageIcon, FileSvgIcon } from '../components/icons';
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

type AspectRatio = "1:1" | "3:4" | "4:3" | "9:16" | "16:9";

const IconGeneratorView: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [numberOfImages, setNumberOfImages] = useState(1);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  
  const generateImagesOperation = useAsyncOperation(async () => {
    if (!prompt.trim()) {
      throw new Error("Please enter a prompt.");
    }
    console.log(`IconGeneratorView: Generating ${numberOfImages} image(s) with aspect ratio ${aspectRatio} for prompt: "${prompt}"`);
    const images = await geminiService.generateImages(prompt, {
      numberOfImages,
      aspectRatio,
    });
    return images.map(img => img.image.imageBytes);
  });

  const handleDownloadPng = (base64Image: string, index: number) => {
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${base64Image}`;
    link.download = `icon_${index + 1}.png`;
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
        link.download = `icon_${index + 1}.svg`;
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
      "Sleek, duotone vector icon of a database, for a tech startup logo, blue and silver.",
      "Glassmorphism-style icon of a secure shield for a cybersecurity application.",
      "A friendly, illustrated mascot of a robot holding a lightbulb, for an AI assistant app.",
      "Abstract, geometric icon representing data flow and connectivity, using gradients."
  ];

  return (
    <div className="flex flex-col h-full">
      <ViewHeader
        icon={<ImageIcon className="w-6 h-6" />}
        title="Icon Generator"
        description="Create stunning icons and images with the Imagen 3 model."
      />

      <div className="flex-1 flex flex-col p-6 gap-6">
        <Card>
            <CardHeader>
                <CardTitle>Generation Settings</CardTitle>
                <CardDescription>Configure the prompt and parameters for image generation.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <ExamplePrompts prompts={examplePrompts} onSelectPrompt={setPrompt} />
                <Textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g., A minimalist vector logo of a rocket ship, blue and silver, on a dark background"
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
                                <SelectItem value="1:1">Square (1:1)</SelectItem>
                                <SelectItem value="16:9">Widescreen (16:9)</SelectItem>
                                <SelectItem value="9:16">Portrait (9:16)</SelectItem>
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

        <div className="flex-1">
          {generateImagesOperation.error && <div className="text-destructive bg-destructive/10 p-4 rounded-lg text-center">{generateImagesOperation.error}</div>}
          
          {generateImagesOperation.data && generateImagesOperation.data.length > 0 && (
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {generateImagesOperation.data.map((img, index) => (
                <div key={index} className="group relative border rounded-lg overflow-hidden">
                  <img src={`data:image/png;base64,${img}`} alt={`Generated image ${index + 1}`} className="w-full h-full object-contain aspect-square bg-muted" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
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
             <EmptyState
                icon={<ImageIcon className="w-10 h-10" />}
                title="Ready to create?"
                description='Enter a prompt above and click "Generate" to see your images appear here.'
             />
          )}
        </div>
      </div>
    </div>
  );
};

export default IconGeneratorView;
