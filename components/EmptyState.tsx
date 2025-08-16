import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description }) => {
  return (
    <Card className="flex-1 flex items-center justify-center border-2 border-dashed border-border h-full min-h-[300px] bg-transparent shadow-none">
      <CardContent className="text-center text-muted-foreground p-6">
        <div className="mx-auto w-fit p-4 bg-secondary rounded-full mb-4">
          {icon}
        </div>
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p>{description}</p>
      </CardContent>
    </Card>
  );
};

export default EmptyState;
