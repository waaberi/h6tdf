import { useState } from 'react';
import type { ChangeEvent, FC } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { UIComponentProps } from '../../types';

interface SearchBarProps extends UIComponentProps {
  placeholder?: string;
  onSearch?: (query: string) => void;
}

export const SearchBar: FC<SearchBarProps> = ({ 
  id, 
  onInteraction, 
  placeholder,
  onSearch
}) => {
  const [query, setQuery] = useState('');

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    onInteraction?.('change', e.target.value);
  };

  const handleSearch = () => {
    onSearch?.(query);
    onInteraction?.('submit', query);
  };

  return (
    <div className="flex w-full items-center space-x-2">
      <Input
        id={id}
        value={query}
        onChange={handleChange}
        placeholder={placeholder || 'Search...'}
        className="flex-1"
      />
      <Button onClick={handleSearch}>
        Search
      </Button>
    </div>
  );
};
