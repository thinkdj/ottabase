import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@ottabase/ui-shadcn";

export const Route = createFileRoute("/demo/ottaeditor/")({
  component: OttaEditorDemo,
});

function OttaEditorDemo() {
  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col gap-8 px-4 py-16">
      <div className="flex flex-col gap-4">
        <Button asChild variant="ghost" className="w-fit">
          <Link to="/demo">← Back to Demo Gallery</Link>
        </Button>

        <h1 className="text-4xl font-bold tracking-tight">OttaEditor Demo</h1>
        <p className="text-lg text-muted-foreground">
          Rich text editor with custom plugins and formatting capabilities.
        </p>
      </div>

      <div className="rounded-lg border bg-muted/50 p-6">
        <h2 className="mb-4 text-xl font-semibold">Editor Integration</h2>
        <p className="text-sm text-muted-foreground mb-4">
          OttaEditor is a block-based rich text editor built on Editor.js. 
          It requires client-side rendering due to its dependency on browser APIs.
        </p>
        
        <div className="rounded-lg border bg-background p-8 text-center">
          <p className="text-muted-foreground">
            Editor component will be rendered here when client-side hydration is complete.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            In a production app, you would dynamically import the OttaEditor component.
          </p>
        </div>
      </div>

      <div className="rounded-lg border bg-muted/50 p-6">
        <h2 className="mb-4 text-xl font-semibold">Features</h2>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>✅ Block-based editing (paragraphs, headers, lists, etc.)</li>
          <li>✅ Custom plugins support</li>
          <li>✅ JSON output for easy storage</li>
          <li>✅ Inline formatting (bold, italic, links)</li>
          <li>✅ Extensible architecture</li>
        </ul>
      </div>
    </div>
  );
}
