import { RenderFn } from 'editorjs-blocks-react-renderer';

const WarningIcon = () => (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path
            fillRule="evenodd"
            d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
            clipRule="evenodd"
        />
    </svg>
);

const Warning: RenderFn<{ title?: string; message?: string }> = ({ data, className = '' }) => {
    return (
        <div
            className={`${className} not-prose rounded-xl border border-warning/30 bg-warning/10 p-4 my-6`}
            role="alert"
        >
            <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-background text-warning ring-1 ring-warning/30">
                    <WarningIcon />
                </span>
                <div className="min-w-0 pt-1">
                    {data?.title && (
                        <h4 className="m-0 text-[0.9375rem] font-semibold leading-6 text-foreground">{data.title}</h4>
                    )}
                    {data?.message && (
                        <p className="m-0 mt-1 text-sm leading-relaxed text-muted-foreground">{data.message}</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Warning;
