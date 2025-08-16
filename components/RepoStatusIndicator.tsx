import React, { useContext } from 'react';
import { GithubContext } from '../context/GithubContext';
import { cn } from '../lib/utils';

interface RepoStatusIndicatorProps {
    className?: string;
}

const RepoStatusIndicator: React.FC<RepoStatusIndicatorProps> = ({ className }) => {
    const { repoUrl } = useContext(GithubContext);
    const isConnected = !!repoUrl;

    const tooltipText = isConnected 
        ? `Connected to: ${repoUrl}` 
        : "No repository connected. Load one in the GitHub Inspector view.";

    return (
        <div 
            className={cn(
                'flex items-center text-xs font-medium px-2.5 py-1 rounded-full border',
                isConnected ? 'bg-success/10 border-success/20 text-success' : 'bg-destructive/10 border-destructive/20 text-destructive',
                className
            )}
            data-tooltip={tooltipText}
        >
            <span className={cn(
                'w-2 h-2 rounded-full mr-2 flex-shrink-0',
                isConnected ? 'bg-success' : 'bg-destructive'
            )}></span>
            <span className='truncate font-semibold'>
                {isConnected ? `Connected: ${repoUrl.split('/').slice(-2).join('/')}` : 'Not Connected'}
            </span>
        </div>
    );
};

export default RepoStatusIndicator;