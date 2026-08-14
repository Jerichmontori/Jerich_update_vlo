import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import AdminBackToDashboard from "@/components/AdminBackToDashboard";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const errorMessage = error instanceof Error ? error.message : String(error);
  const isAssetLoadError = /chunkloaderror|loading chunk|dynamically imported module|failed to fetch module script|importing a module script/i.test(errorMessage);

  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });

    // A deployment can replace hashed route chunks while an older page is
    // still open. Recover once with a clean document request instead of
    // leaving the user trapped in the root error boundary.
    if (!isAssetLoadError) return;
    const recoveryKey = `asset-recovery:${window.location.pathname}`;
    if (sessionStorage.getItem(recoveryKey)) return;
    sessionStorage.setItem(recoveryKey, "1");
    const url = new URL(window.location.href);
    url.searchParams.set("refresh", Date.now().toString());
    window.location.replace(url.toString());
  }, [error, isAssetLoadError]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isAssetLoadError
            ? "Versi aplikasi telah diperbarui. Halaman sedang dimuat ulang otomatis."
            : "Terjadi kesalahan saat memuat halaman. Coba muat ulang atau kembali ke beranda."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Sistem Penjurian Baca Mazmur" },
      { name: "description", content: "Aplikasi penilaian dan pemeringkatan lomba baca Mazmur — objektif, transparan, dan mudah digunakan oleh juri." },
      { property: "og:title", content: "Sistem Penjurian Baca Mazmur" },
      { property: "og:description", content: "Aplikasi penilaian dan pemeringkatan lomba baca Mazmur — objektif, transparan, dan mudah digunakan oleh juri." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Sistem Penjurian Baca Mazmur" },
      { name: "twitter:description", content: "Aplikasi penilaian dan pemeringkatan lomba baca Mazmur — objektif, transparan, dan mudah digunakan oleh juri." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/a8c18cf1-40d7-45b2-b07f-ae7a5618f0ed/id-preview-a5738e1c--f2c51ec0-c815-473f-a79d-fcb58c7b6ae0.lovable.app-1784697374963.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/a8c18cf1-40d7-45b2-b07f-ae7a5618f0ed/id-preview-a5738e1c--f2c51ec0-c815-473f-a79d-fcb58c7b6ae0.lovable.app-1784697374963.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <AdminBackToDashboard />
    </QueryClientProvider>
  );
}
