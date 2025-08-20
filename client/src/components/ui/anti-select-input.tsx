import * as React from "react"
import { cn } from "@/lib/utils"

export interface AntiSelectInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

// This is a specialized input component that prevents unwanted text selection
// It's particularly useful for search inputs where auto-selection can be disruptive
const AntiSelectInput = React.forwardRef<HTMLInputElement, AntiSelectInputProps>(
  ({ className, type, ...props }, ref) => {
    // Custom ref if one isn't provided
    const inputRef = React.useRef<HTMLInputElement>(null);
    const combinedRef = (ref || inputRef) as React.RefObject<HTMLInputElement>;
    
    // When input is clicked after it already has focus, this prevents any auto-selection
    const handleClick = (e: React.MouseEvent<HTMLInputElement>) => {
      // Call the original onClick if it exists
      if (props.onClick) {
        props.onClick(e);
      }
      
      // Ensure no selection happens on click
      const target = e.target as HTMLInputElement;
      if (target === document.activeElement) {
        // Store current cursor position
        const cursorPos = target.selectionStart;
        
        // Remove selection if any exists
        if (window.getSelection) {
          const selection = window.getSelection();
          if (selection) selection.removeAllRanges();
        }
        
        // Restore cursor position
        if (cursorPos !== null) {
          setTimeout(() => {
            target.setSelectionRange(cursorPos, cursorPos);
          }, 0);
        }
      }
    };
    
    // This prevents any selection behavior at all on mouse down
    const handleMouseDown = (e: React.MouseEvent<HTMLInputElement>) => {
      if (document.activeElement === e.currentTarget) {
        e.preventDefault();
      }
      
      // Call the original onMouseDown if it exists
      if (props.onMouseDown) {
        props.onMouseDown(e);
      }
    };
    
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={combinedRef}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        inputMode="search" 
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        {...props}
      />
    )
  }
)

AntiSelectInput.displayName = "AntiSelectInput"

export { AntiSelectInput }