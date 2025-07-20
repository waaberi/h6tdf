import React from 'react';
import { SelfGenWrapper } from './SelfGenWrapper';
import { Button } from '@/components/ui/button';

interface EnhancedButtonProps {
  children: React.ReactNode;
  onClick?: (event: React.MouseEvent) => void;
  className?: string;
  id: string;
}

export function EnhancedButton({ children, onClick, className, id }: EnhancedButtonProps) {
  return (
    <SelfGenWrapper
      id={id}
      enhancementStrategy={{
        triggers: ['click'],
        autoPrompt: true,
        mountType: 'after',
        contextDepth: 2
      }}
      className="self-gen-button-wrapper"
    >
      <Button onClick={onClick} className={className}>
        {children}
      </Button>
    </SelfGenWrapper>
  );
}

// Example usage:
// function MyApp() {
//   return (
//     <SelfGenProvider>
//       <EnhancedButton id="submit-btn">
//         Click Me
//       </EnhancedButton>
//     </SelfGenProvider>
//   );
// }
