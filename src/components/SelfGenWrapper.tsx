import React, { useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useSelfGen } from '../hooks/useSelfGen';
import { logger } from '../services/logger';

type InteractionEventType = 'click' | 'focus' | 'hover' | 'input';

export interface SelfGenWrapperProps {
  children: ReactNode;
  id: string;
  enhancementStrategy?: {
    triggers?: ('click' | 'hover' | 'focus' | 'input')[];
    autoPrompt?: boolean;
    mountType?: 'after' | 'before' | 'child' | 'portal';
    contextDepth?: number;
  };
  className?: string;
}

export function SelfGenWrapper({
  children,
  id,
  enhancementStrategy = {
    triggers: ['click'],
    autoPrompt: true,
    mountType: 'after',
    contextDepth: 1
  },
  className
}: SelfGenWrapperProps) {
  const { registerMountPoint, unregisterMountPoint, generateUI } = useSelfGen();
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = wrapperRef.current;
    if (element) {
      registerMountPoint(id, element);
      return () => unregisterMountPoint(id);
    }
  }, [id, registerMountPoint, unregisterMountPoint]);

  const handleInteraction = async (event: React.SyntheticEvent) => {
    const eventType = event.type as InteractionEventType;
    
    // Check if this event type should trigger generation
    if (!enhancementStrategy.triggers?.includes(eventType)) {
      return;
    }

    // Only handle events that don't have an explicit handler
    const target = event.target as HTMLElement;
    const hasHandler = target.hasAttribute(`on${eventType}`);
    if (hasHandler) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const elementContent = (() => {
      if (target instanceof HTMLInputElement || 
          target instanceof HTMLTextAreaElement || 
          target instanceof HTMLSelectElement) {
        return target.value;
      }
      return target.textContent || undefined;
    })();

    try {
      await generateUI({
        mountStrategy: {
          type: enhancementStrategy.mountType || 'after',
          targetId: id,
          container: wrapperRef.current || undefined
        },
        autoPrompt: enhancementStrategy.autoPrompt,
        context: {
          elementId: id,
          eventType,
          elementContent,
          elementType: target.tagName.toLowerCase(),
          elementAttributes: Object.fromEntries(
            Array.from(target.attributes).map(attr => [attr.name, attr.value])
          )
        }
      });
    } catch (error) {
      logger.error('SelfGenWrapper', 'Failed to handle interaction', { 
        error: error instanceof Error ? error.message : String(error), 
        id, 
        eventType 
      });
    }
  };

  return (
    <div
      ref={wrapperRef}
      className={className}
      onClick={handleInteraction as React.MouseEventHandler}
      onFocus={enhancementStrategy.triggers?.includes('focus') 
        ? (handleInteraction as React.FocusEventHandler) 
        : undefined}
      onMouseEnter={enhancementStrategy.triggers?.includes('hover') 
        ? (handleInteraction as React.MouseEventHandler) 
        : undefined}
      onInput={enhancementStrategy.triggers?.includes('input') 
        ? (handleInteraction as React.FormEventHandler) 
        : undefined}
    >
      {children}
    </div>
  );
}
