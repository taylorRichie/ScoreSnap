'use client'

/**
 * Dashboard Page
 *
 * TROUBLESHOOTING: If you see unstyled pages or 404 errors for CSS/JS assets,
 * run the health check script to verify Next.js is serving static assets correctly:
 *
 * npm run health-check
 *
 * This prevents the common styling regression where pages load as plain HTML.
 */

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { CalendarDays, Camera, UserPlus, Wrench, BarChart3, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

export const dynamic = 'force-dynamic'

interface Session {
  id: string
  name: string | null
  date_time: string
  location: string | null
  bowling_alley_name: string | null
  lane: number | null
  created_at: string
}

interface Bowler {
  id: string
  canonical_name: string
  primary_user_id: string | null
}

interface UserStats {
  total_games: number
  total_score: number
  average_score: number
  high_game: number
  high_series: number
}

export default function DashboardPage() {
  const { user, signOut } = useAuth()
  const [recentSessions, setRecentSessions] = useState<Session[]>([])
  const [availableBowlers, setAvailableBowlers] = useState<Bowler[]>([])
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [loadingBowlers, setLoadingBowlers] = useState(true)
  const [loadingStats, setLoadingStats] = useState(true)
  const [claimingBowler, setClaimingBowler] = useState<string | null>(null)

  const quickActions = [
    {
      title: 'Upload image',
      description: 'Capture new scoreboards',
      href: '/upload',
      icon: Camera
    },
    {
      title: 'View sessions',
      description: 'Review extracted games',
      href: '/sessions',
      icon: BarChart3
    },
    {
      title: 'Claim bowler',
      description: 'Link profiles to your account',
      href: '/bowlers',
      icon: UserPlus
    },
    {
      title: 'Debug tools',
      description: 'Inspect processing & AI output',
      href: '/debug/upload',
      icon: Wrench
    }
  ]

  const workflowCards = [
    {
      title: 'Upload scoreboard',
      description: 'Upload a bowling scoreboard image to extract scores automatically.',
      href: '/upload',
      icon: Camera
    },
    {
      title: 'Debug tools',
      description: 'View upload processing details, OCR output, and AI responses.',
      href: '/debug/upload',
      icon: Wrench
    }
  ]

  useEffect(() => {
    if (user) {
      fetchRecentSessions()
      fetchAvailableBowlers()
      fetchUserStats()
    }
  }, [user])

  const fetchRecentSessions = async () => {
    try {
      setLoadingSessions(true)

      // Get sessions in two ways:
      // 1. Sessions the user uploaded images for
      // 2. Sessions where bowlers claimed by the user appear

      const sessionIds = new Set<string>()

      // Method 1: Sessions from user's uploads
      const { data: uploads, error: uploadsError } = await supabase
        .from('uploads')
        .select('session_id')
        .eq('user_id', user?.id)
        .not('session_id', 'is', null)

      if (uploadsError) {
        console.error('Uploads error:', uploadsError)
      } else if (uploads && uploads.length > 0) {
        uploads.forEach(u => {
          if (u.session_id) sessionIds.add(u.session_id)
        })
      }

      // Method 2: Sessions where user's claimed bowlers appear
      const { data: claimedBowlers, error: bowlersError } = await supabase
        .from('bowlers')
        .select('id')
        .eq('primary_user_id', user?.id)

      if (bowlersError) {
        console.error('Bowlers error:', bowlersError)
      } else if (claimedBowlers && claimedBowlers.length > 0) {
        const bowlerIds = claimedBowlers.map(b => b.id)

        // Find series for these bowlers
        const { data: series, error: seriesError } = await supabase
          .from('series')
          .select('session_id')
          .in('bowler_id', bowlerIds)

        if (seriesError) {
          console.error('Series error:', seriesError)
        } else if (series && series.length > 0) {
          series.forEach(s => {
            if (s.session_id) sessionIds.add(s.session_id)
          })
        }
      }

      // Fetch the actual session data
      if (sessionIds.size > 0) {
        const { data: sessions, error: sessionsError } = await supabase
          .from('sessions')
          .select('*')
          .in('id', Array.from(sessionIds))
          .order('date_time', { ascending: false })
          .limit(5)

        if (sessionsError) {
          console.error('Sessions error:', sessionsError)
        } else {
          setRecentSessions(sessions || [])
        }
      } else {
        setRecentSessions([])
      }
    } catch (error) {
      console.error('Error fetching sessions:', error)
    } finally {
      setLoadingSessions(false)
    }
  }

  const fetchAvailableBowlers = async () => {
    try {
      setLoadingBowlers(true)

      // Get bowlers that are not associated with any user
      const { data: bowlers, error } = await supabase
        .from('bowlers')
        .select('id, canonical_name, primary_user_id')
        .is('primary_user_id', null)
        .order('canonical_name')
        .limit(10)

      if (error) throw error
      setAvailableBowlers(bowlers || [])
    } catch (error) {
      console.error('Error fetching bowlers:', error)
    } finally {
      setLoadingBowlers(false)
    }
  }

  const fetchUserStats = async () => {
    try {
      setLoadingStats(true)

      // Get claimed bowlers
      const { data: claimedBowlers, error: bowlersError } = await supabase
        .from('bowlers')
        .select('id')
        .eq('primary_user_id', user?.id)

      if (bowlersError) throw bowlersError

      if (claimedBowlers && claimedBowlers.length > 0) {
        // Aggregate stats from all claimed bowlers
        let totalGames = 0
        let totalScore = 0
        let highGame = 0
        let highSeries = 0

        for (const bowler of claimedBowlers) {
          try {
            const { data: stats } = await supabase
              .rpc('get_bowler_stats', { bowler_uuid: bowler.id })

            if (stats && stats[0]) {
              totalGames += stats[0].total_games || 0
              totalScore += stats[0].total_score || 0
              highGame = Math.max(highGame, stats[0].high_game || 0)
              highSeries = Math.max(highSeries, stats[0].high_series || 0)
            }
          } catch (err) {
            console.warn(`Failed to get stats for bowler ${bowler.id}:`, err)
          }
        }

        const averageScore = totalGames > 0 ? Math.round(totalScore / totalGames) : 0

        setUserStats({
          total_games: totalGames,
          total_score: totalScore,
          average_score: averageScore,
          high_game: highGame,
          high_series: highSeries
        })
      } else {
        setUserStats({
          total_games: 0,
          total_score: 0,
          average_score: 0,
          high_game: 0,
          high_series: 0
        })
      }
    } catch (error) {
      console.error('Error fetching user stats:', error)
      setUserStats(null)
    } finally {
      setLoadingStats(false)
    }
  }

  const claimBowler = async (bowlerId: string) => {
    if (!user) return

    setClaimingBowler(bowlerId)
    try {
      const { error } = await supabase
        .from('bowlers')
        .update({ primary_user_id: user.id })
        .eq('id', bowlerId)

      if (error) throw error

      // Update local state
      setAvailableBowlers(prev => prev.filter(b => b.id !== bowlerId))

      // Refresh sessions and stats to show newly claimed bowler data
      fetchRecentSessions()
      fetchUserStats()

      toast.success('Bowler profile claimed successfully!')
    } catch (error) {
      console.error('Error claiming bowler:', error)
      toast.error('Failed to claim bowler profile')
    } finally {
      setClaimingBowler(null)
    }
  }

  const handleSignOut = async () => {
    await signOut()
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto w-full max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-1">
          <p className="text-sm uppercase tracking-wide text-muted-foreground">Overview</p>
          <h1 className="text-3xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Manage uploads, recent sessions, and bowler claims from a single place.
          </p>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => (
            <Link key={action.title} href={action.href} className="block">
              <Card className="h-full transition hover:border-primary/40">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {action.title}
                  </CardTitle>
                  <action.icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <CardDescription>{action.description}</CardDescription>
                </CardContent>
              </Card>
            </Link>
          ))}
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="space-y-1">
              <CardDescription>Total games</CardDescription>
              {loadingStats ? (
                <Skeleton className="h-7 w-20" />
              ) : (
                <CardTitle className="text-3xl">
                  {userStats?.total_games || 0}
                </CardTitle>
              )}
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="space-y-1">
              <CardDescription>Average score</CardDescription>
              {loadingStats ? (
                <Skeleton className="h-7 w-16" />
              ) : (
                <CardTitle className="text-3xl">
                  {userStats?.average_score || 0}
                </CardTitle>
              )}
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="space-y-1">
              <CardDescription>High game</CardDescription>
              {loadingStats ? (
                <Skeleton className="h-7 w-16" />
              ) : (
                <CardTitle className="text-3xl">
                  {userStats?.high_game || 0}
                </CardTitle>
              )}
            </CardHeader>
          </Card>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Quick actions</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {workflowCards.map((action) => (
              <Card key={action.title} className="h-full transition hover:border-primary/40">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div>
                    <CardTitle className="text-base">{action.title}</CardTitle>
                    <CardDescription>{action.description}</CardDescription>
                  </div>
                  <action.icon className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardFooter className="pt-0">
                  <Button asChild variant="secondary" size="sm">
                    <Link href={action.href}>Open</Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Recent sessions</h2>
            {recentSessions.length > 0 && (
              <Button asChild variant="link" size="sm">
                <Link href="/sessions">View all sessions</Link>
              </Button>
            )}
          </div>
          <Card>
            <CardContent className="space-y-4 pt-6">
              {loadingSessions ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="space-y-2">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-64" />
                  </div>
                ))
              ) : recentSessions.length === 0 ? (
                <Alert>
                  <AlertTitle>No sessions yet</AlertTitle>
                  <AlertDescription>
                    Upload a bowling scoreboard to create your first session.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  {recentSessions.map((session) => (
                    <Card key={session.id} className="shadow-none">
                      <CardHeader className="space-y-2 p-4 pb-2">
                        <div className="flex items-center justify-between gap-4">
                          <CardTitle className="text-base font-semibold">
                            <Link
                              href={`/sessions/${session.id}`}
                              className="hover:underline"
                            >
                              {session.name || session.bowling_alley_name || 'Bowling session'}
                            </Link>
                          </CardTitle>
                          <Badge variant="secondary">
                            {new Date(session.date_time).toLocaleDateString()}
                          </Badge>
                        </div>
                        <CardDescription className="flex items-center gap-2 text-sm">
                          <CalendarDays className="h-4 w-4 text-muted-foreground" />
                          {new Date(session.date_time).toLocaleTimeString()}
                          {session.lane && ` · Lane ${session.lane}`}
                        </CardDescription>
                        {session.location && (
                          <CardDescription>{session.location}</CardDescription>
                        )}
                      </CardHeader>
                      <CardFooter className="flex items-center justify-end p-4 pt-0">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/sessions/${session.id}`}>
                            View scores
                          </Link>
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {availableBowlers.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Claim your bowler profile</h2>
              <Button asChild variant="link" size="sm">
                <Link href="/bowlers">View all bowlers</Link>
              </Button>
            </div>
            <Card>
              <CardContent className="space-y-4 pt-6">
                <p className="text-sm text-muted-foreground">
                  Associate your account with bowler profiles to track personal statistics and history.
                </p>
                {loadingBowlers ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading available bowlers...
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {availableBowlers.map((bowler) => (
                      <Card key={bowler.id} className="shadow-none">
                        <CardHeader className="p-4 pb-2">
                          <CardTitle className="text-base font-semibold">
                            {bowler.canonical_name}
                          </CardTitle>
                          <CardDescription>Available to claim</CardDescription>
                        </CardHeader>
                        <CardFooter className="p-4 pt-0">
                          <Button
                            onClick={() => claimBowler(bowler.id)}
                            disabled={claimingBowler === bowler.id}
                            size="sm"
                            className="w-full"
                          >
                            {claimingBowler === bowler.id ? 'Claiming…' : 'Claim'}
                          </Button>
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        )}
      </main>
    </div>
  )
}
