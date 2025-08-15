import * as React from "react"
import { cn } from "../../lib/utils"

interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value'> {
  value: number[];
  onValueChange: (value: number[]) => void;
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className, value, onValueChange, ...props }, ref) => {
    const progress = ((value[0] - (props.min ? +props.min : 0)) / ((props.max ? +props.max : 100) - (props.min ? +props.min : 0))) * 100;
    
    return (
      <div className="relative flex w-full touch-none select-none items-center">
        <input
          type="range"
          ref={ref}
          value={value[0]}
          onChange={(e) => onValueChange([parseFloat(e.target.value)])}
          className={cn(
            "w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer group",
            className
          )}
          {...props}
        />
        <style>{`
            input[type=range]::-webkit-slider-thumb {
                -webkit-appearance: none;
                height: 1rem;
                width: 1rem;
                border-radius: 9999px;
                background: hsl(var(--primary));
                border: 2px solid hsl(var(--primary-foreground));
                cursor: pointer;
                margin-top: -4px; /* You need to specify a margin in Chrome, but in Firefox and IE it is automatic */
                transition: background-color .2s ease-in-out;
            }
            input[type=range]:focus::-webkit-slider-thumb {
                outline: 2px solid transparent;
                outline-offset: 2px;
                box-shadow: 0 0 0 2px hsl(var(--background)), 0 0 0 4px hsl(var(--ring));
            }
            input[type=range]::-moz-range-thumb {
                height: 1rem;
                width: 1rem;
                border-radius: 9999px;
                background: hsl(var(--primary));
                border: 2px solid hsl(var(--primary-foreground));
                cursor: pointer;
            }
        `}</style>
      </div>
    );
  }
);
Slider.displayName = "Slider";

export { Slider };