import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@ottabase/ui-shadcn';
import { Eye, EyeOff, GripVertical } from 'lucide-react';

interface CanvasSection {
    id: string;
    slot: string;
    variant: string;
    title?: string;
    enabled?: boolean;
    sortOrder: number;
}

interface BuilderCanvasProps {
    sections: CanvasSection[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    onReorder: (activeId: string, overId: string) => void;
}

/** Sortable section card rendered inside the canvas. */
function SortableBlock({
    section,
    isSelected,
    onSelect,
}: {
    section: CanvasSection;
    isSelected: boolean;
    onSelect: () => void;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: section.id,
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : undefined,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            role="listitem"
            tabIndex={0}
            aria-selected={isSelected}
            aria-label={`${section.slot} block: ${section.title || 'Untitled'}`}
            onClick={onSelect}
            className={`group cursor-pointer rounded-lg border bg-card p-3 transition-all ${
                isDragging ? 'shadow-lg ring-2 ring-primary/40 opacity-90' : ''
            } ${isSelected ? 'border-primary ring-1 ring-primary/20' : 'hover:border-muted-foreground/30'}`}
        >
            <div className="flex items-center gap-2">
                {/* Drag handle */}
                <button
                    type="button"
                    className="cursor-grab touch-none rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground active:cursor-grabbing"
                    aria-label="Drag to reorder"
                    aria-roledescription="sortable"
                    {...attributes}
                    {...listeners}
                >
                    <GripVertical className="h-4 w-4" />
                </button>

                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="shrink-0 text-[10px] font-semibold uppercase">
                            {section.slot}
                        </Badge>
                        <span className="truncate text-sm font-medium">{section.title || 'Untitled'}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{section.variant}</p>
                </div>

                {/* Visibility indicator */}
                {section.enabled ? (
                    <Eye className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                ) : (
                    <EyeOff className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                )}
            </div>
        </div>
    );
}

/** Drag-and-drop sortable canvas using @dnd-kit. */
export function BuilderCanvas({ sections, selectedId, onSelect, onReorder }: BuilderCanvasProps) {
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            onReorder(String(active.id), String(over.id));
        }
    };

    return (
        <Card className="h-fit">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">Canvas</CardTitle>
                    <span className="text-xs text-muted-foreground">{sections.length} blocks</span>
                </div>
            </CardHeader>
            <CardContent>
                {sections.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-12 text-center">
                        <p className="text-sm font-medium text-muted-foreground">No blocks yet</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Add blocks from the palette to start building.
                        </p>
                    </div>
                ) : (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                            <div className="space-y-2" role="list">
                                {sections.map((section) => (
                                    <SortableBlock
                                        key={section.id}
                                        section={section}
                                        isSelected={selectedId === section.id}
                                        onSelect={() => onSelect(section.id)}
                                    />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>
                )}
            </CardContent>
        </Card>
    );
}
