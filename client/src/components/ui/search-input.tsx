import * as React from "react";
import { Input, InputProps } from "./input";

// Special search input component with additional fixes for selection issues
export const SearchInput = React.forwardRef<HTMLInputElement, InputProps>(
  (props, ref) => {
    // Custom input ref if one isn't provided
    const inputRef = React.useRef<HTMLInputElement>(null);
    const combinedRef = ref || inputRef;
    
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
      <Input
        {...props}
        ref={combinedRef as React.RefObject<HTMLInputElement>}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        inputMode="search"
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
      />
    );
  }
);

SearchInput.displayName = "SearchInput";