/**
 * Test demonstration for function property resolution
 * This file shows how the system handles serialized function properties
 */

import { resolveFunctionProperties, registerFunction } from './functionResolver';

// Example component props that might come from AI or storage
const exampleProps = {
  id: 'test-button',
  onClick: 'logClick', // This is a string, but should be a function
  onChange: 'logChange',
  onSubmit: 'submitForm',
  className: 'btn btn-primary',
  customHandler: 'alertClick',
  nonFunction: 'just a string',
  actualFunction: () => console.log('This is already a function'),
};

console.log('=== Function Resolver Demo ===');
console.log('Original props:', exampleProps);

// Resolve function properties
const resolvedProps = resolveFunctionProperties(exampleProps);
console.log('Resolved props:', resolvedProps);

// Test the resolved functions
console.log('\n=== Testing Resolved Functions ===');
if (typeof resolvedProps.onClick === 'function') {
  console.log('✅ onClick is now a function');
  // Test it with a mock event
  const mockEvent = { target: { id: 'test' }, type: 'click' } as unknown as MouseEvent;
  resolvedProps.onClick(mockEvent);
} else {
  console.log('❌ onClick is still not a function');
}

// Register a custom function and test it
registerFunction('customAlert', (message: string) => {
  alert(`Custom message: ${message}`);
});

const propsWithCustomFunction = {
  id: 'test-custom',
  onClick: 'customAlert',
  message: 'Hello from custom function!'
};

const resolvedCustomProps = resolveFunctionProperties(propsWithCustomFunction);
console.log('Custom function resolved:', typeof resolvedCustomProps.onClick === 'function');

export { exampleProps, resolvedProps };
