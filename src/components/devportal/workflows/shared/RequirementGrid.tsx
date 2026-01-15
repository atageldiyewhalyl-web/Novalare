import { CheckCircle2, Circle } from 'lucide-react';
import { ReactNode } from 'react';

interface RequirementGridProps {
  children: ReactNode;
  columns?: 2 | 3 | 4;
}

export function RequirementGrid({ children, columns = 2 }: RequirementGridProps) {
  const gridColsClass = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
  };

  return (
    <div className={`grid ${gridColsClass[columns]} gap-3`}>
      {children}
    </div>
  );
}