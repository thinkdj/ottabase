import { CF_PDF_BASE_PATH, type CfPdfRequest } from '@ottabase/cf-pdf';
import { CfPdfDemoPage } from '@ottabase/cf-pdf/react';
import { useApiMutation } from '@ottabase/ottaorm/client';

/** Host adapter: the package owns the UI; Ottabase owns authenticated transport. */
export function CloudflarePdfPackageDemoPage() {
    const pdfExport = useApiMutation<Blob, CfPdfRequest>({
        endpoint: CF_PDF_BASE_PATH,
        requestOptions: {
            headers: { Accept: 'application/pdf' },
            responseType: 'blob',
            timeout: 60_000,
        },
    });

    return (
        <CfPdfDemoPage
            requestPdf={(request) => pdfExport.mutateAsync(request)}
            backHref="/demo/cloudflare/pdf"
            backLabel="Back to PDF primer"
            brandName="Ottabase"
        />
    );
}
