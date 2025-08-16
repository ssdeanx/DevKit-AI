

import React from 'react';
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
import { DocumentIcon } from './components/icons';
import MemoryView from './views/MemoryView';
import { ToastProvider } from './context/ToastContext';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import DocumentationView from './views/DocumentationView';
import GitHubProView from './views/GitHubProView';

export type ViewName = 
  | 'chat' 
  | 'project-rules' 
  | 'readme-generator' 
  | 'icon-generator' 
  | 'logo-generator' 
  | 'github-inspector'
  | 'code-graph'
  | 'github-pro'
  | 'agent-memory'
  | 'documentation'
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
    const { stagedFiles } = React.useContext(GithubContext);

    if (stagedFiles.length === 0) {
        return null;
    }

    return (
        <div 
            className="absolute bottom-6 right-6 z-30 glass-effect p-3 rounded-full shadow-lg"
            data-tooltip={`${stagedFiles.length} file(s) staged for context`}
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
  const [activeView, setActiveView] = React.useState<ViewName>('chat');

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
        const cards = document.querySelectorAll('.card-glow-border');
        cards.forEach(card => {
            const rect = card.getBoundingClientRect();
            (card as HTMLElement).style.setProperty('--x', `${e.clientX - rect.left}px`);
            (card as HTMLElement).style.setProperty('--y', `${e.clientY - rect.top}px`);
        });
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
      case 'github-pro':
        return <GitHubProView setActiveView={setActiveView} />;
      case 'agent-memory':
        return <MemoryView />;
      case 'history':
        return <HistoryView />;
      case 'documentation':
        return <DocumentationView />;
      default:
        return <ChatView setActiveView={setActiveView} />;
    }
  };

  const viewVariants = {
      initial: { opacity: 0, scale: 0.98 },
      animate: { opacity: 1, scale: 1 },
      exit: { opacity: 0, scale: 0.98 },
  };

  return (
    <MotionConfig reducedMotion="user">
        <SettingsProvider>
        <GithubProvider>
            <ToastProvider>
                <div className="flex h-screen bg-background text-foreground font-sans relative overflow-hidden p-4 gap-4">
                    <div className="background-noise"></div>
                    <Sidebar activeView={activeView} setActiveView={setActiveView} />
                    <main className="flex-1 flex flex-col overflow-hidden z-10 glass-effect rounded-lg">
                        <AnimatePresence mode="wait">
                             <motion.div
                                key={activeView}
                                variants={viewVariants}
                                initial="initial"
                                animate="animate"
                                exit="exit"
                                transition={{ duration: 0.2, ease: 'easeInOut' }}
                                className="flex-1 flex flex-col overflow-y-auto custom-scrollbar"
                                id="main-scroll-container"
                             >
                                {renderView()}
                            </motion.div>
                        </AnimatePresence>
                    </main>
                    <StagedFilesIndicator />
                </div>
            </ToastProvider>
        </GithubProvider>
        </SettingsProvider>
    </MotionConfig>
  );
};

export default App;