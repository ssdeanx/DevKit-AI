

import React, { useState, useEffect, useContext } from 'react';
import Sidebar from './components/Sidebar';
import ChatView from './views/ChatView';
import ReadmeView from './views/ReadmeView';
import IconGeneratorView from './views/IconGeneratorView';
import SettingsView from './views/SettingsView';
import { GithubContext, GithubProvider } from './context/GithubContext';
import ProjectRulesView from './views/ProjectRulesView';
import LogoGeneratorView from './views/LogoGeneratorView';
import GithubInspectorView from './views/GithubInspectorView';
import HistoryView from './views/HistoryView';
import { SettingsProvider } from './context/SettingsContext';
import CodeGraphView from './views/CodeGraphView';
import { DocumentIcon, DatabaseIcon } from './components/icons';
import MemoryView from './views/MemoryView';
import { ToastProvider } from './context/ToastContext';

export type ViewName = 
  | 'chat' 
  | 'project-rules' 
  | 'readme-generator' 
  | 'icon-generator' 
  | 'logo-generator' 
  | 'github-inspector'
  | 'code-graph'
  | 'agent-memory'
  | 'history' 
  | 'settings';

export interface WorkflowStep {
    step: number;
    agent: string;
    task: string;
    status: 'pending' | 'in-progress' | 'completed';
    output?: string;
}

const StagedFilesIndicator: React.FC = () => {
    const { stagedFiles } = useContext(GithubContext);

    if (stagedFiles.length === 0) {
        return null;
    }

    return (
        <div 
            className="absolute bottom-6 right-6 z-30 glass-effect p-3 rounded-full shadow-lg"
            title={`${stagedFiles.length} file(s) staged for context`}
        >
            <div className="relative">
                <DocumentIcon className="w-6 h-6 text-primary" />
                <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                    {stagedFiles.length}
                </span>
            </div>
        </div>
    );
};


const App: React.FC = () => {
  const [activeView, setActiveView] = useState<ViewName>('chat');
  const [viewKey, setViewKey] = useState(Date.now()); // Used to re-trigger animations

  useEffect(() => {
    setViewKey(Date.now());
  }, [activeView]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      document.documentElement.style.setProperty('--x', `${e.clientX}px`);
      document.documentElement.style.setProperty('--y', `${e.clientY}px`);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  const renderView = () => {
    switch (activeView) {
      case 'chat':
        return <ChatView setActiveView={setActiveView} />;
      case 'readme-generator':
        return <ReadmeView />;
      case 'icon-generator':
        return <IconGeneratorView />;
      case 'settings':
        return <SettingsView />;
      case 'project-rules':
        return <ProjectRulesView />;
      case 'logo-generator':
        return <LogoGeneratorView />;
      case 'github-inspector':
        return <GithubInspectorView />;
      case 'code-graph':
        return <CodeGraphView />;
      case 'agent-memory':
        return <MemoryView />;
      case 'history':
        return <HistoryView />;
      default:
        return <ChatView setActiveView={setActiveView} />;
    }
  };

  return (
    <SettingsProvider>
      <GithubProvider>
        <ToastProvider>
            <div className="flex h-screen bg-background text-foreground font-sans relative overflow-hidden p-4 gap-4">
            <div className="spotlight"></div>
            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-full -z-10 overflow-hidden background-grid">
                <div 
                className="absolute w-[80vw] h-[80vh] bg-primary/5 rounded-full blur-[150px] animate-aurora-bg"
                style={{
                    '--aurora-start-x': '0%', '--aurora-start-y': '0%', 
                    '--aurora-mid-x': '50%', '--aurora-mid-y': '100%',
                    '--aurora-end-x': '100%', '--aurora-end-y': '0%'} as React.CSSProperties}
                ></div>
                <div 
                className="absolute w-[60vw] h-[70vh] bg-secondary/10 rounded-full blur-[120px] animate-aurora-bg"
                style={{
                    animationDelay: '15s', 
                    '--aurora-start-x': '100%', '--aurora-start-y': '100%', 
                    '--aurora-mid-x': '0%', '--aurora-mid-y': '50%',
                    '--aurora-end-x': '0%', '--aurora-end-y': '0%'} as React.CSSProperties}
                ></div>
            </div>

            <Sidebar activeView={activeView} setActiveView={setActiveView} />
            <main className="flex-1 flex flex-col overflow-hidden z-10 rounded-lg border bg-card/50 backdrop-blur-lg shadow-2xl shadow-black/10">
                <div key={viewKey} className="animate-in flex-1 flex flex-col overflow-y-auto custom-scrollbar">
                {renderView()}
                </div>
            </main>
            <StagedFilesIndicator />
            </div>
        </ToastProvider>
      </GithubProvider>
    </SettingsProvider>
  );
};

export default App;