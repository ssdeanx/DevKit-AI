import React, { createContext, useState, useEffect, ReactNode, useContext } from 'react';

export type AgentThoughtsStyle = 'default' | 'terminal' | 'blueprint' | 'handwritten' | 'code-comment' | 'matrix' | 'scroll' | 'notebook' | 'gradient-glow' | 'scientific-journal' | 'redacted';
export type WorkflowVisualType = 'simple-list' | 'detailed-card' | 'timeline' | 'metro-grid' | 'stepped-process' | 'minimalist-log' | 'neural-network' | 'circuit-board' | 'git-branch';
export type Theme = 'light' | 'dark';

interface Settings {
  agentThoughtsStyle: AgentThoughtsStyle;
  workflowVisual: WorkflowVisualType;
  isCacheEnabled: boolean;
  theme: Theme;
}

interface SettingsContextType {
  settings: Settings;
  setSettings: (settings: Settings) => void;
}

const SETTINGS_STORAGE_KEY = 'devkit-ai-pro-settings';

const defaultSettings: Settings = {
  agentThoughtsStyle: 'default',
  workflowVisual: 'simple-list',
  isCacheEnabled: true,
  theme: 'dark',
};

export const SettingsContext = createContext<SettingsContextType>({
  settings: defaultSettings,
  setSettings: () => {},
});

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettingsState] = useState<Settings>(() => {
    try {
      const storedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
      const parsedSettings = storedSettings ? JSON.parse(storedSettings) : {};
      return { ...defaultSettings, ...parsedSettings };
    } catch (error) {
      console.error("Failed to load settings from localStorage:", error);
      return defaultSettings;
    }
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(settings.theme);
    
    // For mermaid.js
    const mermaid = (window as any).mermaid;
    if (mermaid && mermaid.initialize) {
        const isDark = settings.theme === 'dark';
        const mermaidThemeVariables = {
            background: isDark ? 'hsl(224 71.4% 4.1%)' : 'hsl(0 0% 100%)',
            primaryColor: isDark ? 'hsl(215 27.9% 16.9%)' : 'hsl(220 14.3% 95.9%)',
            primaryTextColor: isDark ? 'hsl(210 20% 98%)' : 'hsl(224 71.4% 4.1%)',
            lineColor: isDark ? 'hsl(215 27.9% 16.9%)' : 'hsl(220 13% 91%)',
            textColor: isDark ? 'hsl(210 20% 98%)' : 'hsl(224 71.4% 4.1%)',
        };
        mermaid.initialize({
            startOnLoad: false,
            theme: isDark ? 'dark' : 'default',
            themeVariables: mermaidThemeVariables,
        });
    }

    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error("Failed to save settings to localStorage:", error);
    }
  }, [settings]);

  const setSettings = (newSettings: Partial<Settings>) => {
    setSettingsState(prev => ({ ...prev, ...newSettings }));
  };

  return (
    <SettingsContext.Provider value={{ settings, setSettings: setSettings as (settings: Settings) => void }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if(!context) {
        throw new Error("useSettings must be used within a SettingsProvider");
    }
    return context;
}