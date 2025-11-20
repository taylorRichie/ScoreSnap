'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function BackfillPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const handleBackfill = async () => {
    setLoading(true)
    setResult(null)
    setError(null)

    try {
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('Not authenticated')
      }

      const response = await fetch('/api/admin/backfill-place-ids', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Backfill failed')
      }

      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto max-w-4xl p-6">
      <Card>
        <CardHeader>
          <CardTitle>Backfill Google Place IDs</CardTitle>
          <CardDescription>
            This will update all bowling alleys that have coordinates but are missing google_place_id.
            This enables photos and better location data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={handleBackfill} 
            disabled={loading}
            size="lg"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? 'Backfilling...' : 'Start Backfill'}
          </Button>

          {result && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-semibold">{result.message}</p>
                  <div className="text-sm space-y-1">
                    <p>Total alleys checked: {result.total}</p>
                    <p>Successfully updated: {result.updated}</p>
                    <p>Skipped: {result.skipped}</p>
                    {result.errors?.length > 0 && (
                      <div className="mt-2">
                        <p className="font-semibold text-destructive">Errors:</p>
                        <ul className="list-disc list-inside">
                          {result.errors.map((err: string, i: number) => (
                            <li key={i}>{err}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="text-sm text-muted-foreground">
            <p className="font-semibold mb-2">What this does:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Finds all bowling alleys with coordinates but no google_place_id</li>
              <li>Calls Google Places API to get the place_id for each</li>
              <li>Updates the database with the place_id</li>
              <li>Enables photos and enhanced location data</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

