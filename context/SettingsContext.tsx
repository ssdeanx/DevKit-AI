import React, { createContext, useState, useEffect, ReactNode, useContext } from 'react';

export type AgentThoughtsStyle = 'default' | 'terminal' | 'blueprint';
export type WorkflowVisualType = 'simple' | 'detailed';

interface Settings {
  agentThoughtsStyle: AgentThoughtsStyle;
  workflowVisual: WorkflowVisualType;
}

interface SettingsContextType {
  settings: Settings;
  setSettings: (settings: Settings) => void;
}

const SETTINGS_STORAGE_KEY = 'devkit-ai-pro-settings';

const defaultSettings: Settings = {
  agentThoughtsStyle: 'default',
  workflowVisual: 'simple',
};

export const SettingsContext = createContext<SettingsContextType>({
  settings: defaultSettings,
  setSettings: () => {},
});

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettingsState] = useState<Settings>(() => {
    try {
      const storedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
      return storedSettings ? JSON.parse(storedSettings) : defaultSettings;
    } catch (error) {
      console.error("Failed to load settings from localStorage:", error);
      return defaultSettings;
    }
  });

  useEffect(() => {
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