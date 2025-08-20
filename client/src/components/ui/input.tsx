import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, onFocus, onMouseDown, ...props }, ref) => {
    // Prevents initial auto-selection issue
    const inputRef = React.useRef<HTMLInputElement>(null);
    const combinedRef = (ref || inputRef) as React.RefObject<HTMLInputElement>;
    const mouseIsDown = React.useRef(false);
    const selectionWasMade = React.useRef(false);

    // Handle mousedown - we'll use this to track when the user is selecting text
    const handleMouseDown = (e: React.MouseEvent<HTMLInputElement>) => {
      mouseIsDown.current = true;
      selectionWasMade.current = false;

      // Call the original onMouseDown if it exists
      if (onMouseDown) {
        onMouseDown(e);
      }
    };

    // Handle mouseup - this is when we know if a selection was made
    const handleMouseUp = (e: React.MouseEvent<HTMLInputElement>) => {
      mouseIsDown.current = false;
      
      // If the user has a selection, we don't want to override it
      const selection = window.getSelection();
      if (selection && selection.toString().length > 0) {
        selectionWasMade.current = true;
      }
      
      // Call the original onMouseUp if it exists
      if (props.onMouseUp) {
        props.onMouseUp(e);
      }
    };

    // Handle mouseMove - track if user is making a selection
    const handleMouseMove = (e: React.MouseEvent<HTMLInputElement>) => {
      if (mouseIsDown.current) {
        const selection = window.getSelection();
        if (selection && selection.toString().length > 0) {
          selectionWasMade.current = true;
        }
      }
      
      // Call the original onMouseMove if it exists
      if (props.onMouseMove) {
        props.onMouseMove(e);
      }
    };

    // Prevent initial auto-selection on focus, but allow manual selection
    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      // If the user manually made a selection, don't override it
      if (!selectionWasMade.current) {
        // Move cursor to the end of input text on initial focus only
        const value = e.target.value;
        requestAnimationFrame(() => {
          if (combinedRef.current && !selectionWasMade.current) {
            combinedRef.current.setSelectionRange(value.length, value.length);
          }
        });
      }
      
      // Call the original onFocus if it exists
      if (onFocus) {
        onFocus(e);
      }
    };
    
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={combinedRef}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        onFocus={handleFocus}
        autoFocus={false}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
