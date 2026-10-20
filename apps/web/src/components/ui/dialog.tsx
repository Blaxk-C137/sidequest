import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  children,
  title,
  description,
}: {
  className?: string;
  children: React.ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-midnight/80 backdrop-blur-sm data-[state=open]:animate-in" />
      <DialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-blush/20 bg-[#1b1324] p-5 shadow-2xl',
          className,
        )}
      >
        <DialogPrimitive.Title className="font-display text-xl text-cream">{title}</DialogPrimitive.Title>
        {description ? (
          <DialogPrimitive.Description className="mt-1.5 text-sm leading-relaxed text-mist/85">
            {description}
          </DialogPrimitive.Description>
        ) : null}
        <div className="mt-4">{children}</div>
        <DialogPrimitive.Close
          className="absolute right-3 top-3 rounded-full p-2 text-mist transition-colors hover:bg-cream/10 hover:text-cream"
          aria-label="Close dialog"
        >
          <X className="h-4 w-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
