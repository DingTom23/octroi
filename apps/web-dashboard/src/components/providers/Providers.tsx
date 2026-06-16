'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Root client-side providers. Mounted once in app/layout.tsx.
 *
 * QueryClientProvider for TanStack Query — powers the dashboard's live data
 * fetches. Auth is an API-key session held in localStorage (see useApiKey),
 * so there's no auth provider to mount here.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: true,
            retry: 1,
          },
        },
      }),
  );

  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}
