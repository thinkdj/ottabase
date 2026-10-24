import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { Heart } from 'lucide-react';
import { useState, type CSSProperties } from 'react';
import { Rating } from '../components/ui/rating';

const meta: Meta<typeof Rating> = {
    title: 'Rating',
    component: Rating,
    args: { 'aria-label': 'Your rating', defaultValue: 3, max: 5, step: 1, size: 'default' },
    argTypes: {
        step: { options: [1, 0.5], control: { type: 'inline-radio' } },
        size: { options: ['sm', 'default', 'lg'], control: { type: 'inline-radio' } },
    },
    parameters: { layout: 'centered' },
    tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof Rating>;

export const Interactive: Story = {};

/** Pointer halves and arrow-key half steps. */
export const HalfSteps: Story = {
    render: function Render(args) {
        const [value, setValue] = useState(3.5);
        return (
            <div className="flex items-center gap-3">
                <Rating {...args} step={0.5} value={value} onValueChange={setValue} />
                <span className="w-8 text-sm tabular-nums text-muted-foreground">{value}</span>
            </div>
        );
    },
};

/** An average shows as it is: 4.3 fills 30% of the fifth star. */
export const ReadOnlyAverage: Story = {
    render: () => (
        <div className="flex items-center gap-2 text-sm">
            <Rating readOnly value={4.3} aria-label="Average rating" size="sm" />
            <span className="font-semibold tabular-nums">4.3</span>
            <span className="text-muted-foreground">· 128 reviews</span>
        </div>
    ),
};

export const Sizes: Story = {
    render: () => (
        <div className="flex flex-col items-start gap-3">
            <Rating aria-label="Small" size="sm" defaultValue={4} />
            <Rating aria-label="Default" defaultValue={4} />
            <Rating aria-label="Large" size="lg" defaultValue={4} />
        </div>
    ),
};

export const Disabled: Story = { args: { disabled: true } };

/** Halves read-only: 2.5 fills half of the third star. */
export const HalfReadOnly: Story = {
    render: () => <Rating readOnly value={2.5} aria-label="Score" />,
};

/** Your own SVG component, at half steps: it only has to pass `className` on to its <svg>. */
export const CustomSvgComponent: Story = {
    render: function Render() {
        const Drop = ({ className }: { className?: string }) => (
            <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
                <path
                    d="M12 2.5c-3.7 5-6.2 8.4-6.2 11.6a6.2 6.2 0 0 0 12.4 0c0-3.2-2.5-6.6-6.2-11.6Z"
                    stroke="currentColor"
                    strokeLinejoin="round"
                />
            </svg>
        );
        const [value, setValue] = useState(2.5);
        return (
            <Rating
                aria-label="Spice level"
                icon={Drop}
                step={0.5}
                value={value}
                onValueChange={setValue}
                getValueText={(v, max) => `${v} of ${max} chillies`}
                style={{ '--rating-color': 'hsl(var(--destructive))' } as CSSProperties}
            />
        );
    },
};

/** <svg> elements, with a dashed mark of its own for the empty part. */
export const CustomSvgElements: Story = {
    render: () => {
        const hex = 'M12 2.6 20.2 7.3v9.4L12 21.4l-8.2-4.7V7.3Z';
        return (
            <Rating
                aria-label="Effort"
                size="lg"
                step={0.5}
                defaultValue={1.5}
                icon={
                    <svg viewBox="0 0 24 24">
                        <path d={hex} />
                    </svg>
                }
                emptyIcon={
                    <svg viewBox="0 0 24 24">
                        <path d={hex} fill="none" stroke="currentColor" strokeDasharray="2.6 2.2" />
                    </svg>
                }
                style={{ '--rating-color': 'hsl(var(--primary))' } as CSSProperties}
            />
        );
    },
};

/** Any Lucide icon, and --rating-color re-colours the fill. */
export const CustomIcon: Story = {
    render: () => (
        <Rating
            aria-label="Love it"
            icon={Heart}
            max={3}
            defaultValue={2}
            getValueText={(value, max) => `${value} of ${max} hearts`}
            style={{ '--rating-color': 'hsl(var(--destructive))' } as CSSProperties}
        />
    ),
};
