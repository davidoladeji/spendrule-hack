'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface CollapsibleContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CollapsibleContext = React.createContext<CollapsibleContextValue | undefined>(undefined);

interface CollapsibleProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function Collapsible({ open: controlledOpen, onOpenChange, children, defaultOpen = false }: CollapsibleProps) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const handleOpenChange = onOpenChange || setInternalOpen;

  return (
    <CollapsibleContext.Provider value={{ open, onOpenChange: handleOpenChange }}>
      {children}
    </CollapsibleContext.Provider>
  );
}

function CollapsibleTrigger({
  asChild,
  children,
  className,
  ...props
}: React.ComponentProps<'button'> & { asChild?: boolean }) {
  const context = React.useContext(CollapsibleContext);
  if (!context) throw new Error('CollapsibleTrigger must be used within Collapsible');

  const handleClick = () => {
    context.onOpenChange(!context.open);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, { onClick: handleClick, ...props });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn('cursor-pointer', className)}
      {...props}
    >
      {children}
    </button>
  );
}

function CollapsibleContent({
  children,
  className,
  ...props
}: React.ComponentProps<'div'>) {
  const context = React.useContext(CollapsibleContext);
  if (!context) throw new Error('CollapsibleContent must be used within Collapsible');

  if (!context.open) return null;

  return (
    <div className={cn('', className)} {...props}>
      {children}
    </div>
  );
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent };

