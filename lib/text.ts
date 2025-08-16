export const cleanText = (text: string): string => {
    // Replace multiple newlines with a single one, and trim whitespace from each line.
    return text
        .split('\n')
        .map(line => line.trim())
        .join('\n')
        .replace(/\n\n+/g, '\n\n')
        .trim();
};
