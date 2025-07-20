import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SearchBar } from '@/components/ui/SearchBar';
import { Form } from '@/components/ui/Form';
import { List } from '@/components/ui/List';
import { Modal } from '@/components/ui/Modal';
import { Navigation } from '@/components/ui/Navigation';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import type { UIComponent, UIPlaceholder, UIComponentProps } from '../types';
import { patchService } from '../services/patchService';
import { isValidHTMLElement, isWebComponent } from '@/lib/elementUtils';
import { resolveEventHandler, isFunctionProperty } from '@/lib/functionResolver';
import { logger } from '@/services/logger';

interface DynamicRendererProps {
  components: UIComponent[];
  onPlaceholderGenerate?: (placeholder: UIPlaceholder, inputValue?: unknown) => void;
  onError?: (error: Error, componentId: string) => void;
  onComponentUpdate?: (componentId: string, updates: Partial<UIComponent>) => void;
  onComponentInteraction?: (componentId: string, action: string, data?: unknown) => void;
}

interface DynamicRendererState {
  componentErrors: Record<string, string>;
  componentCode: Record<string, string>;
  patchAttempts: Record<string, number>;
}

// Props whitelist per component type - expanded to include common AI-generated props
const propWhitelist: Record<string, string[]> = {
  'search-bar': ['placeholder', 'className', 'aria-label', 'ariaLabel', 'id', 'metadata', 'onUpdate', 'onInteraction', 'value', 'onChange'],
  'button': ['className', 'children', 'onClick', 'type', 'id', 'onUpdate', 'onInteraction', 'text', 'variant', 'size', 'ariaLabel', 'aria-label', 'disabled'],
  'input': ['placeholder', 'type', 'className', 'value', 'onChange', 'id', 'onUpdate', 'onInteraction', 'ariaLabel', 'aria-label', 'disabled', 'required'],
  'card': ['className', 'id', 'title', 'onUpdate', 'onInteraction', 'variant', 'padding'],
  'list': ['className', 'id', 'items', 'onUpdate', 'onInteraction', 'variant', 'spacing'],
  'modal': ['className', 'title', 'id', 'isOpen', 'onClose', 'onUpdate', 'onInteraction', 'size', 'variant'],
  'form': ['className', 'onSubmit', 'id', 'onUpdate', 'onInteraction', 'method', 'action'],
  'navigation': ['items', 'className', 'id', 'onUpdate', 'onInteraction', 'variant', 'orientation'],
};

function filterProps(type: string, component: UIComponent): UIComponentProps {
  const { props = {}, id } = component;
  const componentId = id || `gen_${Date.now()}`; // Ensure a unique ID for context
  const allowed = propWhitelist[type] || [];
  const filtered: UIComponentProps = { id: componentId };

  // First, filter props based on the whitelist
  Object.keys(props).forEach(key => {
    if (allowed.includes(key)) {
      filtered[key] = props[key];
    }
  });

  // Now, resolve event handlers for the filtered props
  Object.keys(filtered).forEach(key => {
    if (isFunctionProperty(key)) {
      // The elementId can be the componentId here, as the component is the element
      filtered[key] = resolveEventHandler(key, filtered[key], componentId, componentId);
    }
  });

  // Add metadata if it exists
  if (component.metadata) {
    filtered.metadata = component.metadata;
  }
  
  return filtered;
}

export class DynamicRenderer extends React.Component<DynamicRendererProps, DynamicRendererState> {
  constructor(props: DynamicRendererProps) {
    super(props);
    this.state = {
      componentErrors: {},
      componentCode: {},
      patchAttempts: {},
    };
  }

  handleError = (error: Error, componentId: string) => {
    logger.error('DynamicRenderer', `Component error occurred for component ${componentId}`, { 
      componentId, 
      error: error.message,
      stack: error.stack 
    });
    // Queue a patch request instead of handling it directly
    patchService.queuePatch(componentId, error.message);
  };

  renderComponent = (component: UIComponent): React.ReactNode => {
    const { type, children = [] } = component;
    const componentString = JSON.stringify(component);

    logger.debug('DynamicRenderer', 'Rendering component', {
      id: component.id,
      type: component.type,
      props: component.props,
      childrenCount: Array.isArray(children) ? children.length : 0,
      component: component
    });

    // Ensure children is always an array to prevent children.map errors
    const childrenArray = Array.isArray(children) ? children : [];
    
    const childNodes = childrenArray.map(child => {
      if (typeof child === 'string') {
        return child;
      }
      if (child && typeof child === 'object' && child.type === 'placeholder') {
        return null; // Placeholders are handled separately
      }
      return this.renderComponent(child as UIComponent);
    }).filter(Boolean);

    return (
      <ErrorBoundary 
        key={component.id} 
        componentCode={componentString}
        onError={(error) => this.handleError(error, component.id)}
      >
        {this.renderComponentByType(type, component.props || {}, childNodes)}
      </ErrorBoundary>
    );
  };

  renderComponentByType = (
    type: string, 
    props: Record<string, unknown>, 
    children: React.ReactNode[]
  ): React.ReactNode => {
    let finalProps: Record<string, unknown> = {};
    let renderedElement: React.ReactNode = null;

    switch (type) {
      case 'search-bar': {
        const componentProps = filterProps(type, { type, props, id: props.id as string || '' } as UIComponent);
        finalProps = componentProps;
        renderedElement = <SearchBar {...(componentProps as UIComponentProps)} />;
        break;
      }
      case 'button': {
        const componentProps = filterProps(type, { type, props, id: props.id as string || '' } as UIComponent);
        finalProps = componentProps;
        // Handle text prop by converting it to children if no children exist
        const buttonText = props.text as string;
        const finalChildren = children.length > 0 ? children : (buttonText ? [buttonText] : []);
        renderedElement = <Button {...(componentProps as UIComponentProps)}>{finalChildren}</Button>;
        break;
      }
      case 'input': {
        const componentProps = filterProps(type, { type, props, id: props.id as string || '' } as UIComponent);
        finalProps = componentProps;
        renderedElement = <Input {...(componentProps as UIComponentProps)} />;
        break;
      }
      case 'card': {
        const componentProps = filterProps(type, { type, props, id: props.id as string || '' } as UIComponent);
        finalProps = componentProps;
        const title = props.title as string;
        renderedElement = (
          <Card {...(componentProps as UIComponentProps)}>
            {title && <CardHeader><CardTitle>{title}</CardTitle></CardHeader>}
            <CardContent>{children}</CardContent>
          </Card>
        );
        break;
      }
      case 'list': {
        const componentProps = filterProps(type, { type, props, id: props.id as string || '' } as UIComponent);
        finalProps = componentProps;
        renderedElement = <List {...(componentProps as UIComponentProps)}>{children}</List>;
        break;
      }
      case 'modal': {
        const componentProps = filterProps(type, { type, props, id: props.id as string || '' } as UIComponent);
        finalProps = componentProps;
        renderedElement = <Modal {...(componentProps as UIComponentProps)}>{children}</Modal>;
        break;
      }
      case 'form': {
        const componentProps = filterProps(type, { type, props, id: props.id as string || '' } as UIComponent);
        finalProps = componentProps;
        renderedElement = <Form {...(componentProps as UIComponentProps)}>{children}</Form>;
        break;
      }
      case 'navigation': {
        const componentProps = filterProps(type, { type, props, id: props.id as string || '' } as UIComponent);
        finalProps = componentProps;
        renderedElement = <Navigation {...(componentProps as UIComponentProps)} />;
        break;
      }
      default:
        // Handle HTML5 elements and web components
        if (isValidHTMLElement(type)) {
          // For HTML elements, pass through all props except our internal ones
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { metadata, onUpdate, onInteraction, ...cleanProps } = props;
          
          // Resolve event handlers for HTML elements
          const resolvedProps: Record<string, unknown> = {};
          Object.keys(cleanProps).forEach(key => {
            if (isFunctionProperty(key)) {
              const componentId = (props.id as string) || `html_${type}_${Date.now()}`;
              resolvedProps[key] = resolveEventHandler(key, cleanProps[key], componentId, componentId);
            } else {
              resolvedProps[key] = cleanProps[key];
            }
          });

          finalProps = resolvedProps;
          renderedElement = React.createElement(type, resolvedProps, ...children);
        }
        
        else if (isWebComponent(type)) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { metadata, onUpdate, onInteraction, ...cleanProps } = props;

          // Resolve event handlers for Web Components
          const resolvedProps: Record<string, unknown> = {};
          Object.keys(cleanProps).forEach(key => {
            if (isFunctionProperty(key)) {
              const componentId = (props.id as string) || `wc_${type}_${Date.now()}`;
              resolvedProps[key] = resolveEventHandler(key, cleanProps[key], componentId, componentId);
            } else {
              resolvedProps[key] = cleanProps[key];
            }
          });

          finalProps = resolvedProps;
          renderedElement = React.createElement(type, resolvedProps, ...children);
        }
        
        else {
          // Unknown component type - this will trigger the error interceptor
          logger.error('DynamicRenderer', `Unknown component type "${type}" - triggering autopatch system`, { type, props });
          renderedElement = null;
        }
    }

    logger.info('DynamicRenderer', `Final props for component "${type}" before rendering`, {
      type,
      props: finalProps,
      childrenCount: children.length,
    });

    return renderedElement;
  };

  render() {
    const { components } = this.props;
    // Ensure components is always an array to prevent map errors
    const componentsArray = Array.isArray(components) ? components : [];
    
    logger.debug('DynamicRenderer', 'Rendering dynamic components', { 
      componentCount: componentsArray.length,
      componentIds: componentsArray.map(c => c.id)
    });
    
    return (
      <div className="dynamic-renderer">
        {componentsArray.map(comp => this.renderComponent(comp)).filter(Boolean)}
      </div>
    );
  }
}


