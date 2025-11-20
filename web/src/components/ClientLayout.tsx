'use client'

import React from 'react'
import { QueryProvider } from '@/lib/query-provider'
import { AuthProvider, useAuth } from '@/lib/auth-context'
import { Toaster } from '@/components/ui/sonner'
import Header from '@/components/Header'

function LayoutContent({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  // Don't render the header until we know the auth state
  if (loading) {
    return (
      <>
        {children}
        <Toaster />
      </>
    )
  }

  return (
    <>
      {user && <Header />}
      {children}
      <Toaster />
    </>
  )
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <AuthProvider>
        <LayoutContent>{children}</LayoutContent>
      </AuthProvider>
    </QueryProvider>
  )
}
