import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/globals.css";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";
import { Providers } from "./providers/Providers";

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <Providers>
            <RouterProvider router={router} />
        </Providers>
    </React.StrictMode>
);
