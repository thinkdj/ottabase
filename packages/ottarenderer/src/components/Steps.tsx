import { RenderFn } from 'editorjs-blocks-react-renderer';

export interface StepItem {
    title?: string;
    content?: string;
}

export interface StepsData {
    items?: StepItem[];
}

const Steps: RenderFn<StepsData> = ({ data, className = '' }) => {
    const items = (data?.items || [])
        .map((item) => ({
            title: item?.title?.trim() || '',
            content: item?.content?.trim() || '',
        }))
        .filter((item) => item.title !== '' || item.content !== '');

    if (!items.length) {
        return null;
    }

    return (
        <section className={`${className} my-6 not-prose cdc-content-steps`} aria-label="Step list">
            <div className="space-y-0" role="list">
                {items.map((item, index) => (
                    <div
                        key={`${item.title}-${index}`}
                        className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-4 pb-8 last:pb-0"
                        role="listitem"
                        data-step-index={index + 1}
                    >
                        <div className="flex flex-col items-center pt-0.5" aria-hidden="true">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-[13px] font-semibold text-background shadow-md">
                                {index + 1}
                            </div>
                            {index < items.length - 1 ? <div className="mt-2 w-px flex-1 bg-border" /> : null}
                        </div>

                        <article className="min-w-0 pt-0.5">
                            {item.title ? (
                                <h3 className="m-0 text-[15px] font-medium leading-7 text-muted-foreground">
                                    {item.title}
                                </h3>
                            ) : null}
                            {item.content ? (
                                <p
                                    className={`m-0 whitespace-pre-line text-base leading-7 text-foreground ${
                                        item.title ? 'mt-3' : 'mt-1'
                                    }`}
                                >
                                    {item.content}
                                </p>
                            ) : null}
                        </article>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default Steps;
