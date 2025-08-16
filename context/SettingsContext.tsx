import React, { createContext, useState, useEffect, ReactNode, useContext } from 'react';

export type AgentThoughtsStyle = 'default' | 'terminal' | 'blueprint' | 'handwritten' | 'code-comment' | 'matrix' | 'scroll';
export type WorkflowVisualType = 'simple' | 'detailed';
export type Theme = 'light' | 'dark' | 'system';

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
  workflowVisual: 'simple',
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
    const isDark =
      settings.theme === 'dark' ||
      (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    root.classList.toggle('dark', isDark);
    
    // For mermaid.js
    const mermaid = (window as any).mermaid;
    if (mermaid && mermaid.initialize) {
        mermaid.initialize({
            startOnLoad: false,
            theme: isDark ? 'dark' : 'default',
            themeVariables: {
                background: isDark ? '#0f172a' : '#ffffff',
                primaryColor: isDark ? '#1e293b' : '#f1f5f9',
                primaryTextColor: isDark ? '#f8fafc' : '#020817',
                lineColor: isDark ? '#334155' : '#e2e8f0',
            }
        });
    }

    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error("Failed to save settings to localStorage:", error);
    }
  }, [settings]);

  const setSettings = (newSettings: Settings) => {
    setSettingsState(newSettings);
  };

  return (
    <SettingsContext.Provider value={{ settings, setSettings }}>
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