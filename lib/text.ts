export const cleanText = (text: string): string => {
    // Replace multiple newlines with a single one, and trim whitespace from each line.
    return text
        .split('\n')
        .map(line => line.trim())
        .join('\n')
        .replace(/\n\n+/g, '\n\n')
        .trim();
};

export const chunkText = (text: string, chunkSize: number = 512, overlap: number = 64): string[] => {
    const chunks: string[] = [];
    if (!text) return chunks;

    for (let i = 0; i < text.length; i += (chunkSize - overlap)) {
        const chunk = text.substring(i, i + chunkSize);
        chunks.push(chunk);
    }
    return chunks;
};

// L2 normalization for vectors
export const normalize = (v: number[]): number[] => {
    const magnitude = Math.sqrt(v.reduce((sum, val) => sum + val * val, 0));
    if (magnitude === 0) return v;
    return v.map(val => val / magnitude);
};
