import { MantineLayout } from "@/pages/demo/mantine/MantineLayout";
import { MantineDemoPage } from "@/pages/demo/mantine/MantineDemoPage";

export function MantineDemoRoute() {
    return (
        <MantineLayout>
            <MantineDemoPage />
        </MantineLayout>
    );
}
