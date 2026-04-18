import { RenderFn } from 'editorjs-blocks-react-renderer';
import HTMLReactParser from 'html-react-parser';

// Simple check icon SVG component
const IconCheck = ({ size = 12, className = '' }: { size?: number; className?: string }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

export interface ChecklistItem {
    text: string;
    checked: boolean;
}

const Checklist: RenderFn<{ items: ChecklistItem[] }> = ({ data, className = '' }) => {
    return (
        <ul className={`${className} list-none p-0 m-0 space-y-2`}>
            {data?.items?.map((item, i) => {
                const textColor = item.checked ? 'text-muted-foreground line-through' : 'text-foreground';
                const checkboxBorderColor = item.checked ? 'border-primary' : 'border-border';
                const checkboxBgColor = item.checked ? 'bg-primary' : 'bg-background';

                return (
                    <li key={i} className="flex items-start">
                        <div className="relative flex items-center">
                            <div
                                className={`mt-1 h-5 w-5 border ${checkboxBorderColor} rounded-sm ${checkboxBgColor} focus:outline-none transition duration-200 align-top cursor-pointer mr-2 flex items-center justify-center`}
                            >
                                {item.checked && (
                                    <IconCheck size={12} className="text-primary-foreground pointer-events-none" />
                                )}
                            </div>
                        </div>
                        <span className={`${textColor} flex-grow`}>{HTMLReactParser(item.text ?? '')}</span>
                    </li>
                );
            })}
        </ul>
    );
};

export default Checklist;
