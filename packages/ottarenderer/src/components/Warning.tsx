import { RenderFn } from 'editorjs-blocks-react-renderer';

const WarningIcon = () => (
    <svg
        className="h-5 w-5 flex-shrink-0 text-yellow-500 dark:text-yellow-400"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
    >
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
            className={`${className} not-prose border-l-4 border-yellow-400 dark:border-yellow-500 bg-yellow-50 dark:bg-yellow-800/25 p-4 my-6 rounded-md shadow-sm`}
            role="alert"
        >
            <div className="flex items-start gap-2.5">
                <WarningIcon />
                <div className="min-w-0">
                    {data?.title && (
                        <h4 className="m-0 text-base font-semibold leading-6 text-yellow-800 dark:text-yellow-200">
                            {data.title}
                        </h4>
                    )}
                    {data?.message && (
                        <p className="m-0 mt-1 text-sm leading-6 text-yellow-700 dark:text-yellow-300">
                            {data.message}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Warning;
