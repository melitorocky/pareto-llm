"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { PropsWithChildren, useRef } from "react";

export default function Providers({ children }: PropsWithChildren) {
  const clientRef = useRef<QueryClient | null>(null);
  if (!clientRef.current) clientRef.current = new QueryClient();
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={clientRef.current}>{children}</QueryClientProvider>
    </ThemeProvider>
  );
}
