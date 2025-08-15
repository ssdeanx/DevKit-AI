
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatView from './views/ChatView';
import ReadmeView from './views/ReadmeView';
import IconGeneratorView from './views/IconGeneratorView';
import SettingsView from './views/SettingsView';
import { GithubProvider } from './context/GithubContext';
import ProjectRulesView from './views/ProjectRulesView';
import LogoGeneratorView from './views/LogoGeneratorView';
import GithubInspectorView from './views/GithubInspectorView';
import HistoryView from './views/HistoryView';
import { SettingsProvider } from './context/SettingsContext';
import CodeGraphView from './views/CodeGraphView';

export type ViewName = 
  | 'chat' 
  | 'project-rules' 
  | 'readme-generator' 
  | 'icon-generator' 
  | 'logo-generator' 
  | 'github-inspector'
  | 'code-graph'
  | 'history' 
  | 'settings';

export interface WorkflowStep {
    step: number;
    agent: string;
    task: string;
    status: 'pending' | 'in-progress' | 'completed';
    output?: string;
}

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<ViewName>('chat');

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
      case 'history':
        return <HistoryView />;
      default:
        return <ChatView setActiveView={setActiveView} />;
    }
  };

  return (
    <SettingsProvider>
      <GithubProvider>
        <div className="flex h-screen bg-background text-foreground font-sans relative overflow-hidden">
          <div className="spotlight"></div>
          {/* Aurora Background */}
          <div className="absolute top-0 left-0 w-full h-full -z-10 overflow-hidden">
            <div 
              className="absolute w-[50vw] h-[50vh] bg-primary/10 rounded-full blur-[100px] animate-aurora-bg"
              style={{'--aurora-start-x': '0%', '--aurora-start-y': '0%', '--aurora-end-x': '100%', '--aurora-end-y': '100%'} as React.CSSProperties}
            ></div>
             <div 
              className="absolute w-[40vw] h-[60vh] bg-secondary/20 rounded-full blur-[120px] animate-aurora-bg"
              style={{animationDelay: '5s', '--aurora-start-x': '100%', '--aurora-start-y': '100%', '--aurora-end-x': '0%', '--aurora-end-y': '0%'} as React.CSSProperties}
            ></div>
            <div className="absolute w-[2px] h-[300px] bg-gradient-to-b from-primary/50 to-transparent animate-meteor" style={{top: '-50%', left: '20%', animationDelay: '1s'}}></div>
            <div className="absolute w-[2px] h-[300px] bg-gradient-to-b from-primary/50 to-transparent animate-meteor" style={{top: '-50%', left: '80%', animationDelay: '3.5s'}}></div>

          </div>

          <Sidebar activeView={activeView} setActiveView={setActiveView} />
          <main className="flex-1 flex flex-col overflow-hidden z-10">
            {renderView()}
          </main>
        </div>
      </GithubProvider>
    </SettingsProvider>
  );
};

export default App;