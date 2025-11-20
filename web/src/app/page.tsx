'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Trophy, TrendingUp, Users, MapPin, Target, Calendar } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

export const dynamic = 'force-dynamic'

interface DashboardStats {
  stats: {
    totalSessions: number
    totalGames: number
    totalBowlers: number
    totalAlleys: number
    averageScore: number
    highestGame: {
      score: number
      bowler: string
      sessionId: string
      date: string
    } | null
    highestSeries: {
      score: number
      bowler: string
      sessionId: string
      date: string
    } | null
  }
  recentSessions: Array<{
    id: string
    name: string | null
    date: string
    alley: string | null
    bowlerCount: number
  }>
  topBowlers: Array<{
    id: string
    name: string
    average_score: number
    game_count: number
  }>
}

export default function HomePage() {
  const { user } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/dashboard/stats')
      
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard statistics')
      }

      const data = await response.json()
      setStats(data)
    } catch (err) {
      console.error('Error fetching dashboard stats:', err)
      setError(err instanceof Error ? err.message : 'Failed to load statistics')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Skeleton className="h-10 w-64 mb-2" />
          <Skeleton className="h-6 w-96" />
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Error Loading Dashboard</CardTitle>
            <CardDescription>{error || 'Failed to load statistics'}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={fetchStats}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Community bowling statistics and leaderboards
          </p>
        </div>
        {!user && (
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/auth/login">Sign In</Link>
            </Button>
            <Button asChild>
              <Link href="/auth/signup">Get Started</Link>
            </Button>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Sessions
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.stats.totalSessions.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Games
            </CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.stats.totalGames.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Bowlers
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.stats.totalBowlers.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Bowling Alleys
            </CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.stats.totalAlleys.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Highlights */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Average Score */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Average Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-foreground">
              {stats.stats.averageScore}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Across all games
            </p>
          </CardContent>
        </Card>

        {/* Highest Game */}
        {stats.stats.highestGame && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                Highest Game
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-foreground">
                {stats.stats.highestGame.score}
              </div>
              <Link 
                href={`/bowlers/${stats.stats.highestGame.bowler}`}
                className="text-sm text-primary hover:underline mt-2 block"
              >
                {stats.stats.highestGame.bowler}
              </Link>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(stats.stats.highestGame.date).toLocaleDateString()}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Highest Series */}
        {stats.stats.highestSeries && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-blue-500" />
                Highest Series
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-foreground">
                {stats.stats.highestSeries.score}
              </div>
              <Link 
                href={`/bowlers/${stats.stats.highestSeries.bowler}`}
                className="text-sm text-primary hover:underline mt-2 block"
              >
                {stats.stats.highestSeries.bowler}
              </Link>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(stats.stats.highestSeries.date).toLocaleDateString()}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Two Column Layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Bowlers */}
        <Card>
          <CardHeader>
            <CardTitle>Top Bowlers</CardTitle>
            <CardDescription>Ranked by average score</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.topBowlers.map((bowler, index) => (
                <Link
                  key={bowler.id}
                  href={`/bowlers/${bowler.id}`}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                      index === 0 ? 'bg-yellow-500/20 text-yellow-500' :
                      index === 1 ? 'bg-gray-400/20 text-gray-400' :
                      index === 2 ? 'bg-orange-600/20 text-orange-600' :
                      'bg-muted text-muted-foreground'
                    } font-bold text-sm`}>
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium">{bowler.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {bowler.game_count} games
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary">
                    {bowler.average_score} avg
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Sessions */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Sessions</CardTitle>
            <CardDescription>Latest bowling sessions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.recentSessions.map((session) => (
                <Link
                  key={session.id}
                  href={`/sessions/${session.id}`}
                  className="block p-3 rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="flex items-start justify-between mb-1">
                    <p className="font-medium">
                      {session.name || session.alley || 'Bowling Session'}
                    </p>
                    <Badge variant="outline" className="text-xs">
                      {session.bowlerCount} bowlers
                    </Badge>
                  </div>
                  {session.alley && session.alley !== session.name && (
                    <p className="text-sm text-muted-foreground">{session.alley}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(session.date).toLocaleDateString()}
                  </p>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
