import Potrace from 'potrace';

export const convertPngToSvg = (base64Png: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.src = `data:image/png;base64,${base64Png}`;
        image.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                return reject(new Error('Could not get canvas context'));
            }
            ctx.drawImage(image, 0, 0);

            // Potrace is an external library. We assert the type here.
            const trace = new (Potrace as any)();
            trace.setParameters({
                turdSize: 10,
                optTolerance: 0.4,
                blackOnWhite: true,
                color: 'currentColor'
            });
            trace.loadImage(canvas, (err: Error | null) => {
                if (err) {
                    return reject(err);
                }
                const svg = trace.getSVG();
                resolve(svg);
            });
        };
        image.onerror = (err) => {
            reject(new Error(`Failed to load image for conversion: ${err}`));
        };
    });
};
