'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Loader2, MapPin, Phone, Globe, CalendarDays, Hash } from 'lucide-react'
import { toast } from 'sonner'

import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { getGooglePlacesPhotoUrl, getStaticMapUrl } from '@/lib/google-places-photo'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

interface BowlingAlley {
  id: string
  name: string
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  phone: string | null
  website: string | null
  google_place_id: string | null
}

interface Session {
  id: string
  name: string | null
  date_time: string
  location: string | null
  bowling_alley_name: string | null
  lane: number | null
}

export default function AlleyDetailPage() {
  const params = useParams()
  const { user, loading: authLoading } = useAuth()
  const alleyId = params.id as string

  const [alley, setAlley] = useState<BowlingAlley | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && alleyId) {
      fetchAlleyData()
    }
  }, [authLoading, alleyId])

  const fetchAlleyData = async () => {
    try {
      setLoading(true)

      // Fetch bowling alley details
      const { data: alleyData, error: alleyError } = await supabase
        .from('bowling_alleys')
        .select('*')
        .eq('id', alleyId)
        .maybeSingle()

      if (alleyError) throw alleyError
      if (!alleyData) {
        throw new Error('Bowling alley not found')
      }
      setAlley(alleyData)

      // Fetch sessions at this alley
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('sessions')
        .select('id, name, date_time, location, bowling_alley_name, lane')
        .eq('bowling_alley_id', alleyId)
        .order('date_time', { ascending: false })

      if (sessionsError) throw sessionsError
      setSessions(sessionsData || [])

    } catch (err) {
      console.error('Error fetching alley data:', err)
      setError('Failed to load bowling alley data')
    } finally {
      setLoading(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !alley) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Unable to load alley</CardTitle>
            <CardDescription>{error || 'Bowling alley not found.'}</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild variant="secondary" className="w-full">
              <Link href="/alleys">Back to alleys</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  const fullAddress = [alley.address, alley.city, alley.state, alley.zip_code]
    .filter(Boolean)
    .join(', ')

  const photoUrl = alley.google_place_id 
    ? getGooglePlacesPhotoUrl(alley.google_place_id, 1200)
    : getStaticMapUrl(fullAddress, 1200, 400)

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/">Home</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/alleys">Alleys</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{alley.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{alley.name}</CardTitle>
            {(alley.city || alley.state) && (
              <CardDescription className="text-base">
                {[alley.city, alley.state].filter(Boolean).join(', ')}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {photoUrl && (
              <div className="relative aspect-[3/1] w-full overflow-hidden rounded-lg">
                <img
                  src={photoUrl}
                  alt={alley.name}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    // Fallback to static map if photo fails
                    const target = e.target as HTMLImageElement
                    const fallbackUrl = getStaticMapUrl(fullAddress, 1200, 400)
                    if (fallbackUrl && target.src !== fallbackUrl) {
                      target.src = fallbackUrl
                    }
                  }}
                />
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              {fullAddress && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-sm font-medium">Address</div>
                    <div className="text-sm text-muted-foreground">{fullAddress}</div>
                  </div>
                </div>
              )}
              {alley.phone && (
                <div className="flex items-start gap-3">
                  <Phone className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-sm font-medium">Phone</div>
                    <a href={`tel:${alley.phone}`} className="text-sm text-muted-foreground hover:underline">
                      {alley.phone}
                    </a>
                  </div>
                </div>
              )}
              {alley.website && (
                <div className="flex items-start gap-3">
                  <Globe className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-sm font-medium">Website</div>
                    <a 
                      href={alley.website} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-sm text-primary hover:underline break-all"
                    >
                      {alley.website.replace(/^https?:\/\//, '')}
                    </a>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Sessions at this alley</h2>
            <Badge variant="outline" className="text-xs">
              {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}
            </Badge>
          </div>

          {sessions.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <Alert>
                  <AlertTitle>No sessions yet</AlertTitle>
                  <AlertDescription>
                    Sessions you bowl at {alley.name} will appear here.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {sessions.map((session) => (
                <Card key={session.id} className="h-full">
                  <CardHeader className="space-y-2">
                    <CardTitle className="text-base font-semibold">
                      {session.name || session.bowling_alley_name || 'Bowling session'}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2 text-sm">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                      {new Date(session.date_time).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                      })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    {session.lane && (
                      <div className="flex items-center gap-2">
                        <Hash className="h-4 w-4 text-muted-foreground" />
                        Lane {session.lane}
                      </div>
                    )}
                  </CardContent>
                  <CardFooter>
                    <Button asChild variant="secondary" className="w-full">
                      <Link href={`/sessions/${session.id}`}>View session</Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

