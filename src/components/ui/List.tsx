import React from 'react';

interface ListProps {
  children: React.ReactNode;
  className?: string;
  ordered?: boolean;
}

export const List: React.FC<ListProps> = ({ 
  children, 
  className = "",
  ordered = false
}) => {
  const Component = ordered ? 'ol' : 'ul';
  
  return (
    <Component className={`space-y-2 ${className}`}>
      {children}
    </Component>
  );
};

interface ListItemProps {
  children: React.ReactNode;
  className?: string;
}

export const ListItem: React.FC<ListItemProps> = ({ 
  children,
  className = ""
}) => {
  return (
    <li className={`list-item ${className}`}>
      {children}
    </li>
  );
};
