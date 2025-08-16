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

type AspectRatio = "1:1" | "3:4" | "4:3" | "9:16" | "16:9";

const IconGeneratorView: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [numberOfImages, setNumberOfImages] = useState(1);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError("Please enter a prompt.");
      return;
    }
    console.log(`IconGeneratorView: Generating ${numberOfImages} image(s) with aspect ratio ${aspectRatio} for prompt: "${prompt}"`);
    setIsLoading(true);
    setError(null);
    setGeneratedImages([]);

    try {
      const images = await geminiService.generateImages(prompt, {
        numberOfImages,
        aspectRatio,
      });
      setGeneratedImages(images.map(img => img.image.imageBytes));
    } catch (e) {
      console.error("IconGeneratorView: Image generation failed:", e);
      setError("Failed to generate images. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  
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
        setError("Failed to convert image to SVG. This feature works best for simple, high-contrast images.");
    }
  };
  
  const examplePrompts = [
      "A minimalist, single-line vector icon of a brain.",
      "A flat design icon for a weather app showing a sun behind a cloud.",
      "A photorealistic 3D icon of a golden key.",
      "A retro, pixel art icon of a floppy disk."
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-background">
      <ViewHeader
        icon={<ImageIcon className="w-6 h-6" />}
        title="Icon Generator"
        description="Create stunning icons and images with the Imagen 3 model."
      />

      <div className="flex-1 flex flex-col p-6 gap-6 overflow-y-auto custom-scrollbar">
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
                        onClick={handleGenerate}
                        disabled={isLoading}
                        className="self-end"
                        size="lg"
                    >
                      {isLoading ? 'Generating...' : "Generate"}
                    </Button>
                </div>
                <p className="text-xs text-muted-foreground pt-2">Note: SVG conversion is performed in-browser and works best for high-contrast images. All generated images include a SynthID watermark.</p>
            </CardContent>
        </Card>

        <div className="flex-1">
          {error && <div className="text-destructive bg-destructive/10 p-4 rounded-lg text-center">{error}</div>}
          
          {generatedImages.length > 0 && (
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {generatedImages.map((img, index) => (
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

          {!isLoading && generatedImages.length === 0 && !error && (
             <Card className="flex-1 flex items-center justify-center border-2 border-dashed border-border h-full min-h-[300px] bg-transparent shadow-none">
                <CardContent className="text-center text-muted-foreground p-6">
                    <div className="mx-auto w-fit p-4 bg-secondary rounded-full mb-4">
                        <ImageIcon className="w-10 h-10" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">Ready to create?</h3>
                    <p>Enter a prompt above and click "Generate" to see your images appear here.</p>
                </CardContent>
             </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default IconGeneratorView;