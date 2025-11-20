import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import ClientLayout from '@/components/ClientLayout'
import { ThemeProvider } from '@/components/theme-provider'
import { cn } from '@/lib/utils'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'ScoreSnap - Bowling Score Capture',
  description: 'Upload bowling scoreboard images and automatically extract scores using AI vision',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const storageKey = 'scoresnap-ui-theme';
                const defaultTheme = 'dark';
                const stored = localStorage.getItem(storageKey);
                const theme = stored || defaultTheme;
                
                document.documentElement.classList.remove('light', 'dark');
                
                if (theme === 'system') {
                  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                  document.documentElement.classList.add(systemTheme);
                } else {
                  document.documentElement.classList.add(theme);
                }
              } catch (e) {
                // If localStorage is not available, default to dark
                document.documentElement.classList.add('dark');
              }
            `,
          }}
        />
      </head>
      <body className={cn('bg-background text-foreground antialiased', inter.className)}>
        <ThemeProvider defaultTheme="dark" storageKey="scoresnap-ui-theme">
          <ClientLayout>{children}</ClientLayout>
        </ThemeProvider>
      </body>
    </html>
  )
}
