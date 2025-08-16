
import React, { useContext } from 'react';
import { ViewName } from '../App';
import { ChatIcon, DocumentIcon, ImageIcon, GithubIcon, HistoryIcon, SettingsIcon, CodeGraphIcon, LogoIcon, SunIcon, MoonIcon, DatabaseIcon } from './icons';
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
}

const ThemeSwitcher: React.FC = () => {
    const { settings, setSettings } = useSettings();

    const toggleTheme = () => {
        const newTheme = settings.theme === 'dark' ? 'light' : 'dark';
        setSettings({ ...settings, theme: newTheme });
    };

    return (
        <div className="p-2">
            <div className="flex items-center justify-center p-1 rounded-full bg-secondary">
                <Button 
                    variant={settings.theme === 'light' ? 'default' : 'ghost'} 
                    size="sm" 
                    onClick={() => setSettings({...settings, theme: 'light'})}
                    className="flex-1"
                >
                    <SunIcon className="w-4 h-4" />
                </Button>
                <Button 
                    variant={settings.theme === 'dark' ? 'default' : 'ghost'} 
                    size="sm" 
                    onClick={() => setSettings({...settings, theme: 'dark'})}
                    className="flex-1"
                >
                    <MoonIcon className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
};

const NavItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  viewName: ViewName;
  isActive: boolean;
  onClick: () => void;
  disabled?: boolean;
}> = ({ icon, label, isActive, onClick, disabled }) => (
  <Button
    variant="ghost"
    onClick={onClick}
    className={cn(
        "w-full justify-start text-base py-6 relative",
        isActive && "bg-primary/10 text-primary font-semibold"
    )}
    aria-current={isActive ? 'page' : undefined}
    disabled={disabled}
  >
    {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full"></div>}
    {icon}
    <span className="ml-3">{label}</span>
  </Button>
);

const Sidebar: React.FC<SidebarProps> = ({ activeView, setActiveView }) => {
  const { repoUrl } = useContext(GithubContext);

  const navItems: NavItemConfig[] = [
    { id: 'chat', label: 'Chat', icon: <ChatIcon className="h-5 w-5" />, group: 'AI Tools' },
    { id: 'project-rules', label: 'Project Rules', icon: <DocumentIcon className="h-5 w-5" />, group: 'AI Tools' },
    { id: 'readme-generator', label: 'README Pro', icon: <DocumentIcon className="h-5 w-5" />, group: 'AI Tools' },
    { id: 'icon-generator', label: 'Icon Generator', icon: <ImageIcon className="h-5 w-5" />, group: 'AI Tools' },
    { id: 'logo-generator', label: 'Logo/Banner Gen', icon: <ImageIcon className="h-5 w-5" />, group: 'AI Tools' },
    { id: 'github-inspector', label: 'GitHub Inspector', icon: <GithubIcon className="h-5 w-5" />, group: 'Project' },
    { id: 'code-graph', label: 'Code Graph', icon: <CodeGraphIcon className="h-5 w-5" />, group: 'Project', disabled: !repoUrl },
    { id: 'knowledge-base', label: 'Knowledge Base', icon: <DatabaseIcon className="h-5 w-5" />, group: 'Project' },
    { id: 'history', label: 'History', icon: <HistoryIcon className="h-5 w-5" />, group: 'Project' },
    { id: 'settings', label: 'Settings', icon: <SettingsIcon className="h-5 w-5" />, group: 'Project' },
  ];

  const groupedNavItems = navItems.reduce<Record<string, NavItemConfig[]>>((acc, item) => {
    if (!acc[item.group]) {
      acc[item.group] = [];
    }
    acc[item.group].push(item);
    return acc;
  }, {});

  return (
    <aside className="w-72 flex-shrink-0 p-4 flex flex-col glass-effect z-20 rounded-lg shadow-2xl shadow-black/10">
      <div className="mb-6 flex items-center justify-center gap-2 p-4">
         <LogoIcon className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-bold text-center animate-text-gradient bg-gradient-to-r from-primary via-muted-foreground to-primary">DevKit AI Pro</h1>
      </div>
      <nav className="flex-1 space-y-6">
        {Object.entries(groupedNavItems).map(([groupName, items]) => (
          <div key={groupName}>
            <h2 className="px-2 mb-2 text-sm font-semibold tracking-wider text-muted-foreground uppercase">{groupName}</h2>
            <div className="space-y-1">
              {items.map((item) => (
                <NavItem
                  key={item.id}
                  icon={item.icon}
                  label={item.label}
                  viewName={item.id}
                  isActive={activeView === item.id}
                  onClick={() => setActiveView(item.id)}
                  disabled={item.disabled}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>
      <ThemeSwitcher />
    </aside>
  );
};

export default Sidebar;