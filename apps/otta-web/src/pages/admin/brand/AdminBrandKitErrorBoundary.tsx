import React from 'react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ottabase/ui-shadcn';

interface Props {
    children: React.ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

/**
 * Error boundary for Admin Brand Kit editor.
 * Catches errors and displays a user-friendly recovery message.
 */
export class AdminBrandKitErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error) {
        console.error('Admin Brand Kit error:', error);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <Card className="border-red-500">
                    <CardHeader>
                        <CardTitle>Error in Brand Kit Editor</CardTitle>
                        <CardDescription>An unexpected error occurred while loading the editor.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="rounded-md bg-red-50 p-3 dark:bg-red-950">
                            <p className="text-sm text-red-700 dark:text-red-300 font-mono">
                                {this.state.error?.message || 'Unknown error'}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={this.handleReset} variant="outline">
                                Try Again
                            </Button>
                            <Button onClick={() => window.location.reload()} variant="default">
                                Reload Page
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            );
        }

        return this.props.children;
    }
}
