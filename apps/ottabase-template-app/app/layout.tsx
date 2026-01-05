import { APP_META } from "@/ottabase/config/app.config";
import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: APP_META.title,
  description: APP_META.description,
  keywords: APP_META.keywords,
  robots: APP_META.robots,
  authors: [{ name: APP_META.author }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{__html: `
          /* FOUC Prevention - Lightweight loading indicator */
          #app-loading {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #ffffff;
            z-index: 9999;
          }
          
          @media (prefers-color-scheme: dark) {
            #app-loading {
              background: #0a0a0a;
            }
            #app-loading .spinner {
              border-top-color: #ffffff !important;
            }
          }
          
          #app-loading .spinner {
            width: 40px;
            height: 40px;
            border: 3px solid #f3f4f6;
            border-top-color: #3b82f6;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }
          
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}} />
      </head>
      <body>
        <div id="app-loading">
          <div className="spinner"></div>
        </div>
        <Providers>{children}</Providers>
        <script dangerouslySetInnerHTML={{__html: `
          // Hide loading indicator once React hydrates
          if (typeof window !== 'undefined') {
            window.addEventListener('load', function() {
              setTimeout(function() {
                var loader = document.getElementById('app-loading');
                if (loader) {
                  loader.style.opacity = '0';
                  loader.style.transition = 'opacity 0.3s';
                  setTimeout(function() {
                    loader.style.display = 'none';
                  }, 300);
                }
              }, 100);
            });
          }
        `}} />
      </body>
    </html>
  );
}
