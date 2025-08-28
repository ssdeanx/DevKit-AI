
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
import { TokenUsage } from './agents/types';
import KnowledgeBaseView from './views/KnowledgeBaseView';
import WorkingMemoryView from './views/WorkingMemoryView';

export type ViewName = 
  | 'chat' 
  | 'project-rules' 
  | 'readme-generator' 
  | 'icon-generator' 
  | 'logo-generator' 
  | 'github-inspector'
  | 'code-graph'
  | 'knowledge-base'
  | 'github-pro'
  | 'learned-memories'
  | 'working-memory'
  | 'documentation'
  | 'history' 
  | 'settings';

export interface WorkflowStep {
    step: number;
    agent: string;
    task: string;
    status: 'pending' | 'in-progress' | 'completed';
    output?: string;
    usage?: TokenUsage;
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
       case 'knowledge-base':
        return <KnowledgeBaseView />;
      case 'github-pro':
        return <GitHubProView setActiveView={setActiveView} />;
      case 'learned-memories':
        return <MemoryView />;
      case 'working-memory':
        return <WorkingMemoryView />;
      case 'history':
        return <HistoryView />;
      case 'documentation':
        return <DocumentationView />;
      default:
        return <ChatView setActiveView={setActiveView} />;
    }
  };

  const viewVariants = {
      initial: { opacity: 0, y: 15 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: -15 },
  };

  return (
    <MotionConfig reducedMotion="user">
        <SettingsProvider>
            <ToastProvider>
                <GithubProvider>
                    <div className="w-screen h-screen bg-transparent text-foreground font-sans relative overflow-hidden">
                         <div className="absolute inset-0 -z-10 overflow-hidden">
                            <div className="meteors">
                                {[...Array(20)].map((_, i) => <div key={i} className="meteor-particle" style={{
                                    top: `${Math.random() * 100}%`,
                                    left: `${Math.random() * 100}%`,
                                    animationDelay: `${Math.random() * 10}s`,
                                    animationDuration: `${Math.random() * 4 + 3}s`,
                                }} />)}
                            </div>
                        </div>
                        <div className="flex h-full p-4 gap-4">
                            <Sidebar activeView={activeView} setActiveView={setActiveView} />
                            <main className="flex-1 flex flex-col overflow-hidden z-10 glass-effect rounded-lg">
                                <AnimatePresence mode="wait">
                                     <motion.div
                                        key={activeView}
                                        variants={viewVariants}
                                        initial="initial"
                                        animate="animate"
                                        exit="exit"
                                        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                                        className="flex-1 flex flex-col overflow-y-auto custom-scrollbar"
                                        id="main-scroll-container"
                                     >
                                        {renderView()}
                                    </motion.div>
                                </AnimatePresence>
                            </main>
                            <StagedFilesIndicator />
                        </div>
                    </div>
                </GithubProvider>
            </ToastProvider>
        </SettingsProvider>
    </MotionConfig>
  );
};

export default App;
