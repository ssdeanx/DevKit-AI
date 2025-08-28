
import React, { useContext } from 'react';
import { ViewName } from '../App';
import { ChatIcon, DocumentIcon, ImageIcon, GithubIcon, HistoryIcon, SettingsIcon, CodeGraphIcon, LogoIcon, SunIcon, MoonIcon, BrainIcon, DatabaseIcon, BookOpenIcon, GitPullRequestIcon, WorkflowIcon } from './icons';
import { Button } from './ui/Button';
import { cn } from '../lib/utils';
import { GithubContext } from '../context/GithubContext';
import { useSettings } from '../context/SettingsContext';

interface SidebarProps {
  activeView: ViewName;
  setActiveView: (view: ViewName) => void;
}

interface NavItemConfig {
    id: ViewName;
    label: string;
    icon: React.ReactNode;
    group: string;
    disabled?: boolean;
    tooltip?: string;
}

const ThemeSwitcher: React.FC = () => {
    const { settings, setSettings } = useSettings();

    const setTheme = (theme: 'light' | 'dark') => {
        setSettings({ ...settings, theme });
    };

    return (
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-secondary p-1">
            <Button
                variant={settings.theme === 'light' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setTheme('light')}
                className="flex items-center gap-2"
            >
                <SunIcon className="w-4 h-4"/>
                Light
            </Button>
            <Button
                variant={settings.theme === 'dark' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setTheme('dark')}
                className="flex items-center gap-2"
            >
                <MoonIcon className="w-4 h-4"/>
                Dark
            </Button>
        </div>
    );
};

const NavItem: React.FC<{
    config: NavItemConfig,
    activeView: ViewName,
    setActiveView: (view: ViewName) => void
}> = React.memo(({ config, activeView, setActiveView }) => {
    const isActive = activeView === config.id;
    return (
        <button
            onClick={() => setActiveView(config.id)}
            disabled={config.disabled}
            data-tooltip={config.tooltip}
            className={cn(
                "flex items-center w-full text-left p-3 rounded-lg transition-all duration-200 text-sm font-medium relative",
                "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                isActive && "bg-primary/10 text-primary font-semibold",
                config.disabled && "opacity-50 cursor-not-allowed"
            )}
        >
            {isActive && (
                 <span className="absolute left-0 top-1/2 -translate-y-1/2 h-3/5 w-1 bg-primary rounded-r-full"></span>
            )}
            <span className="relative ml-2 mr-3 w-5 h-5">{config.icon}</span>
            <span className="relative">{config.label}</span>
        </button>
    );
});


const Sidebar: React.FC<SidebarProps> = ({ activeView, setActiveView }) => {
    const { repoUrl } = useContext(GithubContext);

    const navItems: NavItemConfig[] = [
        // AI GROUP
        { id: 'chat', label: 'Chat', icon: <ChatIcon />, group: 'AI' },
        
        // PROJECT GROUP
        { id: 'github-inspector', label: 'GitHub Inspector', icon: <GithubIcon />, group: 'PROJECT' },
        { id: 'github-pro', label: 'GitHub Pro', icon: <GitPullRequestIcon />, group: 'PROJECT', disabled: !repoUrl, tooltip: !repoUrl ? "Load a repo first" : undefined },
        { id: 'code-graph', label: 'Code Graph', icon: <CodeGraphIcon />, group: 'PROJECT', disabled: !repoUrl, tooltip: !repoUrl ? "Load a repo first" : undefined },
        
        // GENERATORS GROUP
        { id: 'readme-generator', label: 'README Pro', icon: <DocumentIcon />, group: 'GENERATORS' },
        { id: 'project-rules', label: 'Specification Generator', icon: <DocumentIcon />, group: 'GENERATORS', disabled: !repoUrl, tooltip: !repoUrl ? "Load a repo first" : undefined },
        { id: 'icon-generator', label: 'Icon Generator', icon: <ImageIcon />, group: 'GENERATORS' },
        { id: 'logo-generator', label: 'Logo Generator', icon: <ImageIcon />, group: 'GENERATORS' },
        
        // MEMORY GROUP
        { id: 'working-memory', label: 'Working Memory', icon: <WorkflowIcon />, group: 'MEMORY' },
        { id: 'knowledge-base', label: 'Knowledge Base', icon: <DatabaseIcon />, group: 'MEMORY' },
        { id: 'learned-memories', label: 'Learned Memories', icon: <BrainIcon />, group: 'MEMORY' },
    ];
    
    const groupOrder = ['AI', 'PROJECT', 'GENERATORS', 'MEMORY'];

    const groupedItems = navItems.reduce((acc, item) => {
        if (!acc[item.group]) {
            acc[item.group] = [];
        }
        acc[item.group].push(item);
        return acc;
    }, {} as Record<string, NavItemConfig[]>);

    return (
        <aside className="w-64 flex-shrink-0 flex flex-col z-10 glass-effect rounded-lg p-4">
             <div className="flex items-center gap-3 mb-4 p-2">
                <LogoIcon className="w-8 h-8 text-primary" />
                <h1 className="text-xl font-bold tracking-tight">DevKit AI Pro</h1>
            </div>
            <nav className="flex-1 space-y-4 overflow-y-auto custom-scrollbar -mr-2 pr-2">
                {groupOrder.map(groupName => {
                    const items = groupedItems[groupName];
                    if (!items) return null;
                    return (
                        <div key={groupName}>
                            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2">{groupName}</h2>
                            <div className="space-y-1">
                                {items.map(item => (
                                    <NavItem key={item.id} config={item} activeView={activeView} setActiveView={setActiveView} />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </nav>
            <div className="mt-auto space-y-2">
                <ThemeSwitcher />
                <NavItem config={{id: 'documentation', label: 'Documentation', icon: <BookOpenIcon />, group: ''}} activeView={activeView} setActiveView={setActiveView} />
                <NavItem config={{id: 'history', label: 'History', icon: <HistoryIcon />, group: ''}} activeView={activeView} setActiveView={setActiveView} />
                <NavItem config={{id: 'settings', label: 'Settings', icon: <SettingsIcon />, group: ''}} activeView={activeView} setActiveView={setActiveView} />
            </div>
        </aside>
    );
};

export default Sidebar;
