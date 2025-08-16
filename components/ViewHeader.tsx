import React from 'react';

interface ViewHeaderProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  children?: React.ReactNode;
}

const ViewHeader: React.FC<ViewHeaderProps> = ({ icon, title, description, children }) => {
  return (
    <header className="view-header flex justify-between items-start sticky top-0 bg-background/95 backdrop-blur-sm z-10">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-secondary rounded-lg text-primary">
          {icon}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-sm text-muted-foreground h-5">{description}</p>
        </div>
      </div>
      <div>
        {children}
      </div>
    </header>
  );
};

export default ViewHeader;