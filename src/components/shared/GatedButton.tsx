'use client';

import { Button, type ButtonProps } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/overlays';

/**
 * An action the user may be allowed to take but a business rule blocks (README §8.1: self-handling, already approved…):
 * shown disabled with the reason in a tooltip instead of disappearing without explanation.
 */
export function GatedButton({ blocked, ...props }: ButtonProps & { blocked?: string | null | false }) {
  if (!blocked) return <Button {...props} />;
  return (
    <Tooltip content={blocked}>
      <span tabIndex={0} className="inline-flex rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`${typeof props.children === 'string' ? props.children : 'Action'} unavailable: ${blocked}`}>
        <Button {...props} disabled className="pointer-events-none" />
      </span>
    </Tooltip>
  );
}
