import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { logger } from '@/services/logger';

interface SimpleSearchBarProps {
  placeholder?: string;
  onSearch?: (query: string) => void;
  className?: string;
  isLoading?: boolean;
}

export const SimpleSearchBar: React.FC<SimpleSearchBarProps> = ({ 
  placeholder = "Search...", 
  onSearch,
  className = "",
  isLoading = false
}) => {
  const [query, setQuery] = useState('');

  const handleSearch = () => {
    logger.debug('SimpleSearchBar', 'Search triggered', { query, hasOnSearch: !!onSearch });
    if (onSearch) {
      onSearch(query);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      logger.debug('SimpleSearchBar', 'Enter key pressed', { query });
      handleSearch();
    }
  };

  return (
    <div className={`flex gap-2 ${className}`}>
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        onKeyPress={handleKeyPress}
        className="flex-1"
      />
      <Button onClick={handleSearch} disabled={isLoading}>
        {isLoading ? 'Generating...' : 'Search'}
      </Button>
    </div>
  );
};
