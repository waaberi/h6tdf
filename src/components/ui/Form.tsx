import React from 'react';

interface FormProps {
  children: React.ReactNode;
  onSubmit?: (data: FormData) => void;
  className?: string;
}

export const Form: React.FC<FormProps> = ({ 
  children, 
  onSubmit,
  className = ""
}) => {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (onSubmit) {
      const formData = new FormData(e.currentTarget);
      onSubmit(formData);
    }
  };

  return (
    <form 
      onSubmit={handleSubmit}
      className={`space-y-4 ${className}`}
    >
      {children}
    </form>
  );
};
