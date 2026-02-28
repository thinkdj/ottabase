// ============================================================
// OttaPort Admin — Data Import/Export Hub
// ============================================================

import { useState } from 'react';
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@ottabase/ui-shadcn';
import { ArrowDownToLine, ArrowUpFromLine, History } from 'lucide-react';
import { OttaportImportWizard } from './OttaportImportWizard';
import { OttaportExportPage } from './OttaportExportPage';
import { OttaportHistoryPage } from './OttaportHistoryPage';

export function AdminOttaportPage() {
    const [activeTab, setActiveTab] = useState('import');

    return (
        <div className="container mx-auto max-w-6xl space-y-6 p-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Data Import/Export</h1>
                    <p className="text-sm text-muted-foreground">
                        Import data from CSV/JSON/TSV files or export model data with filters
                    </p>
                </div>
                <Badge variant="outline" className="text-xs">
                    OttaPort
                </Badge>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-3 max-w-md">
                    <TabsTrigger value="import" className="flex items-center gap-1.5">
                        <ArrowUpFromLine className="h-3.5 w-3.5" />
                        Import
                    </TabsTrigger>
                    <TabsTrigger value="export" className="flex items-center gap-1.5">
                        <ArrowDownToLine className="h-3.5 w-3.5" />
                        Export
                    </TabsTrigger>
                    <TabsTrigger value="history" className="flex items-center gap-1.5">
                        <History className="h-3.5 w-3.5" />
                        History
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="import" className="mt-4">
                    <OttaportImportWizard />
                </TabsContent>

                <TabsContent value="export" className="mt-4">
                    <OttaportExportPage />
                </TabsContent>

                <TabsContent value="history" className="mt-4">
                    <OttaportHistoryPage />
                </TabsContent>
            </Tabs>
        </div>
    );
}
