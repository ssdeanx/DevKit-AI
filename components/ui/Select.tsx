import * as React from "react"
import { cn } from "../../lib/utils"

interface SelectContextValue {
    value: string;
    onValueChange: (value: string) => void;
    open: boolean;
    setOpen: (open: boolean) => void;
    selectedValueDisplay: React.ReactNode;
    setSelectedValueDisplay: (node: React.ReactNode) => void;
}
const SelectContext = React.createContext<SelectContextValue | null>(null);

const useSelect = () => {
    const context = React.useContext(SelectContext);
    if (!context) throw new Error("Select components must be used within a Select provider.");
    return context;
}

const Select = ({ children, value, onValueChange }: { children: React.ReactNode; value: string; onValueChange: (value: string) => void; }) => {
    const [open, setOpen] = React.useState(false);
    const [selectedValueDisplay, setSelectedValueDisplay] = React.useState<React.ReactNode>(null);
    const selectRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);
    
    return (
        <SelectContext.Provider value={{ value, onValueChange, open, setOpen, selectedValueDisplay, setSelectedValueDisplay }}>
            <div className="relative" ref={selectRef}>{children}</div>
        </SelectContext.Provider>
    );
};

const SelectTrigger = React.forwardRef<HTMLButtonElement, React.HTMLAttributes<HTMLButtonElement>>(({ className, children, ...props }, ref) => {
    const { open, setOpen, selectedValueDisplay } = useSelect();
    return (
        <button
            ref={ref}
            onClick={() => setOpen(!open)}
            className={cn("flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50", className)}
            {...props}
        >
            {selectedValueDisplay || children}
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 opacity-50"><path d="m6 9 6 6 6-6"/></svg>
        </button>
    );
});
SelectTrigger.displayName = "SelectTrigger";

const SelectValue = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement> & { placeholder?: string }>(({ placeholder, className, ...props }, ref) => {
    const { selectedValueDisplay, setSelectedValueDisplay } = useSelect();
    
    React.useLayoutEffect(() => {
        if (!selectedValueDisplay) {
            setSelectedValueDisplay(<span {...props} ref={ref} className={cn(className)}>{placeholder}</span>);
        }
    }, [selectedValueDisplay, placeholder, setSelectedValueDisplay, props, ref, className]);

    return null;
});
SelectValue.displayName = "SelectValue";

const SelectContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, children, ...props }, ref) => {
    const { open, value, setSelectedValueDisplay } = useSelect();

    React.useEffect(() => {
        const childrenArray = React.Children.toArray(children);
        const selectedChild = childrenArray.find(
            (child): child is React.ReactElement<{ value: string; children: React.ReactNode }> =>
                React.isValidElement(child) &&
                typeof child.props === 'object' &&
                child.props !== null &&
                'value' in child.props &&
                (child.props as { value: unknown }).value === value
        );
        if (selectedChild) {
            setSelectedValueDisplay(selectedChild.props.children);
        }
    }, [value, children, setSelectedValueDisplay]);

    if (!open) return null;

    return <div ref={ref} className={cn("absolute z-50 mt-1 w-full min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md", className)} {...props}> {children} </div>
});
SelectContent.displayName = "SelectContent";

const SelectItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { value: string }>(({ className, children, value, ...props }, ref) => {
    const { onValueChange, setOpen } = useSelect();
    return (
        <div
            ref={ref}
            onClick={() => {
                onValueChange(value);
                setOpen(false);
            }}
            className={cn("relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 hover:bg-accent", className)}
            {...props}
        >
            {children}
        </div>
    );
});
SelectItem.displayName = "SelectItem";

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };