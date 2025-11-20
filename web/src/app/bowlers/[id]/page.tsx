'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Loader2, CalendarDays, MapPin, Hash, LayoutGrid, Table as TableIcon, ArrowUpDown, GitMerge, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts'
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'

import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
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
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'

export const dynamic = 'force-dynamic'

interface Bowler {
  id: string
  canonical_name: string
  claimed_by_user_id: string | null
  created_at: string
}

interface SessionData {
  session_id: string
  series_id: string
  session_date: string
  location: string | null
  bowling_alley_name: string | null
  series_total: number
  game_count: number
  average_score: number
  lane: string | null
}

interface BowlerSearchResult {
  id: string
  canonical_name: string
}

interface BowlerStats {
  total_games: number
  total_score: number
  average_score: number
  high_game: number
  high_series: number
  high_game_session_id?: string
  high_game_number?: number
  high_series_session_id?: string
}

export default function BowlerDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const bowlerId = params.id as string

  const [bowler, setBowler] = useState<Bowler | null>(null)
  const [sessions, setSessions] = useState<SessionData[]>([])
  const [stats, setStats] = useState<BowlerStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [associating, setAssociating] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [mergeDialog, setMergeDialog] = useState<{
    open: boolean
    sessionId: string | null
    seriesId: string | null
    sessionName: string | null
  }>({ open: false, sessionId: null, seriesId: null, sessionName: null })
  const [bowlerSearch, setBowlerSearch] = useState('')
  const [searchResults, setSearchResults] = useState<BowlerSearchResult[]>([])
  const [selectedTargetBowler, setSelectedTargetBowler] = useState<BowlerSearchResult | null>(null)
  const [isMerging, setIsMerging] = useState(false)

  const filteredSessions = useMemo(() => {
    const searchQuery = (columnFilters.find(f => f.id === 'search')?.value as string) || ''
    if (!searchQuery) return sessions
    
    const searchLower = searchQuery.toLowerCase()
    return sessions.filter(session => {
      return (
        session.bowling_alley_name?.toLowerCase().includes(searchLower) ||
        session.location?.toLowerCase().includes(searchLower)
      )
    })
  }, [sessions, columnFilters])

  const columns = useMemo<ColumnDef<SessionData>[]>(
    () => [
      {
        accessorKey: 'bowling_alley_name',
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            >
              Session
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          )
        },
        cell: ({ row }) => (
          <Link
            href={`/sessions/${row.original.session_id}`}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {row.getValue('bowling_alley_name') || 'Bowling session'}
          </Link>
        ),
      },
      {
        accessorKey: 'session_date',
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            >
              Date
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          )
        },
        cell: ({ row }) => {
          return new Date(row.getValue('session_date')).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          })
        },
      },
      {
        accessorKey: 'location',
        header: 'Location',
        cell: ({ row }) => {
          return row.getValue('location') || row.original.bowling_alley_name || '—'
        },
      },
      {
        accessorKey: 'lane',
        header: 'Lane',
        cell: ({ row }) => {
          return row.getValue('lane') ? `Lane ${row.getValue('lane')}` : '—'
        },
      },
      {
        accessorKey: 'series_total',
        header: ({ column }) => {
          return (
            <div className="text-center">
              <Button
                variant="ghost"
                onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
              >
                Series
                <ArrowUpDown className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )
        },
        cell: ({ row }) => <div className="text-center">{row.getValue('series_total')}</div>,
      },
      {
        accessorKey: 'game_count',
        header: ({ column }) => {
          return (
            <div className="text-center">
              <Button
                variant="ghost"
                onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
              >
                Games
                <ArrowUpDown className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )
        },
        cell: ({ row }) => <div className="text-center">{row.getValue('game_count')}</div>,
      },
      {
        accessorKey: 'average_score',
        header: ({ column }) => {
          return (
            <div className="text-center">
              <Button
                variant="ghost"
                onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
              >
                Average
                <ArrowUpDown className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )
        },
        cell: ({ row }) => <div className="text-center">{row.getValue('average_score')}</div>,
      },
      {
        id: 'actions',
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => (
          <div className="text-right">
            <Button asChild variant="secondary" size="sm">
              <Link href={`/sessions/${row.original.session_id}`}>View</Link>
            </Button>
          </div>
        ),
      },
    ],
    []
  )

  const table = useReactTable({
    data: filteredSessions,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      columnFilters,
    },
  })

  useEffect(() => {
    if (bowlerId) {
      fetchBowlerData()
    }
  }, [bowlerId])

  const fetchBowlerData = async () => {
    try {
      setLoading(true)

      // Fetch bowler info
      const { data: bowlerData, error: bowlerError } = await supabase
        .from('bowlers')
        .select('*')
        .eq('id', bowlerId)
        .maybeSingle()

      if (bowlerError) throw bowlerError
      if (!bowlerData) {
        throw new Error('Bowler not found')
      }
      setBowler(bowlerData)

      // Fetch games with session info to aggregate into sessions
      const { data: gamesData, error: gamesError } = await supabase
        .from('games')
        .select(`
          id,
          total_score,
          game_number,
          series: series_id (
            id,
            session: session_id (
              id,
              date_time,
              location,
              bowling_alley_name,
              lane
            )
          )
        `)
        .eq('bowler_id', bowlerId)
        .order('created_at', { ascending: false })

      if (gamesError) throw gamesError

      // Aggregate games into sessions and track high game/series
      const sessionMap = new Map<string, SessionData>()
      let highGame = { score: 0, sessionId: '', gameNumber: 0 }
      let highSeries = { total: 0, sessionId: '' }
      
      gamesData?.forEach((game: any) => {
        const session = game.series?.session
        if (!session) return

        const score = game.total_score || 0

        // Track high game
        if (score > highGame.score) {
          highGame = { score, sessionId: session.id, gameNumber: game.game_number }
        }

        const existing = sessionMap.get(session.id)

        if (existing) {
          existing.series_total += score
          existing.game_count += 1
          existing.average_score = Math.round(existing.series_total / existing.game_count)
        } else {
          sessionMap.set(session.id, {
            session_id: session.id,
            series_id: game.series?.id || '',
            session_date: session.date_time,
            location: session.location,
            bowling_alley_name: session.bowling_alley_name,
            lane: session.lane,
            series_total: score,
            game_count: 1,
            average_score: score
          })
        }
      })

      // Find high series
      sessionMap.forEach((session) => {
        if (session.series_total > highSeries.total) {
          highSeries = { total: session.series_total, sessionId: session.session_id }
        }
      })

      // Convert map to array and sort by date descending
      const sessionsArray = Array.from(sessionMap.values()).sort(
        (a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime()
      )
      setSessions(sessionsArray)

      // Fetch stats using the database function
      const { data: statsData, error: statsError } = await supabase
        .rpc('get_bowler_stats', { bowler_uuid: bowlerId })

      if (statsError) {
        console.warn('Stats error:', statsError)
      } else {
        const baseStats = statsData?.[0] || null
        if (baseStats) {
          // Add high game and high series session IDs
          setStats({
            ...baseStats,
            high_game_session_id: highGame.sessionId,
            high_game_number: highGame.gameNumber,
            high_series_session_id: highSeries.sessionId
          })
        } else {
          setStats(null)
        }
      }

    } catch (err: any) {
      console.error('Error fetching bowler data:', err)
      console.error('Error details:', {
        message: err?.message,
        code: err?.code,
        details: err?.details,
        hint: err?.hint
      })
      setError(err?.message || 'Failed to load bowler data')
    } finally {
      setLoading(false)
    }
  }

  const handleAssociateAccount = async () => {
    if (!user || !bowler) return

    setAssociating(true)
    try {
      // Check if user already has a claimed bowler
      const { data: userProfile, error: profileError } = await supabase
        .from('user_profiles')
        .select('claimed_bowler_id')
        .eq('user_id', user.id)
        .single()

      if (profileError) throw profileError

      if (userProfile?.claimed_bowler_id) {
        toast.error('You have already claimed a bowler profile. You can only claim one.')
        setAssociating(false)
        return
      }

      // Check if this bowler is already claimed
      if (bowler.claimed_by_user_id) {
        toast.error('This bowler profile has already been claimed by another user')
        setAssociating(false)
        return
      }

      // Update bowlers table
      const { error: bowlerError } = await supabase
        .from('bowlers')
        .update({ 
          claimed_by_user_id: user.id,
          claimed_at: new Date().toISOString()
        })
        .eq('id', bowlerId)
        .is('claimed_by_user_id', null) // Safety check

      if (bowlerError) throw bowlerError

      // Update user_profiles table
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ claimed_bowler_id: bowlerId })
        .eq('user_id', user.id)

      if (updateError) throw updateError

      // Update local state
      setBowler({ ...bowler, claimed_by_user_id: user.id })
      toast.success('Successfully claimed this bowler profile! Reloading...')

      // Force a full page reload to update header navigation
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    } catch (error) {
      console.error('Error claiming profile:', error)
      toast.error('Failed to claim profile')
    } finally {
      setAssociating(false)
    }
  }

  const handleOpenMergeDialog = (session: SessionData) => {
    setMergeDialog({
      open: true,
      sessionId: session.session_id,
      seriesId: session.series_id,
      sessionName: session.bowling_alley_name || 'this session'
    })
    setBowlerSearch('')
    setSearchResults([])
    setSelectedTargetBowler(null)
  }

  const handleCloseMergeDialog = () => {
    setMergeDialog({ open: false, sessionId: null, seriesId: null, sessionName: null })
    setBowlerSearch('')
    setSearchResults([])
    setSelectedTargetBowler(null)
  }

  const searchBowlers = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }

    try {
      const { data, error } = await supabase
        .from('bowlers')
        .select('id, canonical_name')
        .ilike('canonical_name', `%${query}%`)
        .neq('id', bowlerId) // Don't show the current bowler
        .limit(10)

      if (error) throw error
      setSearchResults(data || [])
    } catch (error) {
      console.error('Error searching bowlers:', error)
      setSearchResults([])
    }
  }

  const handleConfirmMerge = async () => {
    if (!selectedTargetBowler || !mergeDialog.seriesId || !mergeDialog.sessionId) return

    try {
      setIsMerging(true)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('No authentication session found')
      }

      const response = await fetch(`/api/sessions/${mergeDialog.sessionId}/merge-bowler`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          seriesId: mergeDialog.seriesId,
          targetBowlerId: selectedTargetBowler.id
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to merge bowler')
      }

      const result = await response.json()
      toast.success(result.message || 'Successfully merged bowler!')

      // Check if this was the last session for this bowler
      const isLastSession = sessions.length === 1

      // Close dialog
      handleCloseMergeDialog()

      if (isLastSession) {
        // If this was the last session, redirect to the target bowler's profile
        toast.success(`Redirecting to ${selectedTargetBowler.canonical_name}'s profile...`, { duration: 2000 })
        setTimeout(() => {
          router.push(`/bowlers/${selectedTargetBowler.id}`)
        }, 1000)
      } else {
        // Otherwise, just refresh the current page
        await fetchBowlerData()
      }

    } catch (error: any) {
      console.error('Merge error:', error)
      toast.error(error.message || 'Failed to merge bowler')
    } finally {
      setIsMerging(false)
    }
  }

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (mergeDialog.open && bowlerSearch) {
        searchBowlers(bowlerSearch)
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [bowlerSearch, mergeDialog.open])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !bowler) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Unable to load bowler</CardTitle>
            <CardDescription>{error || 'Bowler not found.'}</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild variant="secondary" className="w-full">
              <Link href="/bowlers">Back to bowlers</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

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
                <Link href="/bowlers">Bowlers</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{bowler.canonical_name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <Card>
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex-1">
              <CardTitle className="text-2xl">{bowler.canonical_name}</CardTitle>
              <CardDescription>Bowling statistics and game history.</CardDescription>
            </div>
            {user && !bowler.claimed_by_user_id && (
              <Button onClick={handleAssociateAccount} disabled={associating}>
                {associating ? 'Claiming…' : 'Claim this profile'}
              </Button>
            )}
          </CardHeader>
        </Card>

        {stats && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader>
                <CardDescription>Total games</CardDescription>
                <CardTitle className="text-3xl">{stats.total_games}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Average score</CardDescription>
                <CardTitle className="text-3xl">{stats.average_score ? stats.average_score.toFixed(1) : '0.0'}</CardTitle>
              </CardHeader>
            </Card>
            <Link 
              href={stats.high_game_session_id && stats.high_game_number 
                ? `/sessions/${stats.high_game_session_id}?highlightGame=${stats.high_game_number}&bowlerId=${bowlerId}`
                : '#'}
              className={stats.high_game_session_id ? "block" : "pointer-events-none"}
            >
              <Card 
                className={stats.high_game_session_id ? "cursor-pointer hover:bg-accent/50 transition-colors" : ""}
              >
                <CardHeader>
                  <CardDescription>High game</CardDescription>
                  <CardTitle className="text-3xl">{stats.high_game}</CardTitle>
                </CardHeader>
              </Card>
            </Link>
            <Link 
              href={stats.high_series_session_id 
                ? `/sessions/${stats.high_series_session_id}?highlightBowler=${bowlerId}`
                : '#'}
              className={stats.high_series_session_id ? "block" : "pointer-events-none"}
            >
              <Card 
                className={stats.high_series_session_id ? "cursor-pointer hover:bg-accent/50 transition-colors" : ""}
              >
                <CardHeader>
                  <CardDescription>High series</CardDescription>
                  <CardTitle className="text-3xl">{stats.high_series}</CardTitle>
                </CardHeader>
              </Card>
            </Link>
          </div>
        )}

        {sessions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Series Performance</CardTitle>
              <CardDescription>Series scores across all sessions</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  series: {
                    label: "Series Score",
                    color: "hsl(var(--chart-1))",
                  },
                } satisfies ChartConfig}
                className="h-[200px] w-full"
              >
                <BarChart 
                  accessibilityLayer 
                  data={sessions.map(session => ({
                    date: new Date(session.session_date).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric' 
                    }),
                    series: session.series_total,
                    sessionId: session.session_id
                  }))}
                  onClick={(data) => {
                    if (data?.activePayload?.[0]?.payload?.sessionId) {
                      router.push(`/sessions/${data.activePayload[0].payload.sessionId}?highlightBowler=${bowlerId}`)
                    }
                  }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar 
                    dataKey="series" 
                    fill="var(--color-series)" 
                    radius={4}
                    className="cursor-pointer"
                  />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Sessions</h2>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}
              </Badge>
              {sessions.length > 0 && (
                <div className="flex items-center gap-1 rounded-md border p-1">
                  <Button
                    variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                    className="h-8 w-8 p-0"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('table')}
                    className="h-8 w-8 p-0"
                  >
                    <TableIcon className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {sessions.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <Alert>
                  <AlertTitle>No sessions recorded</AlertTitle>
                  <AlertDescription>
                    Upload and process a scoreboard that includes this bowler to see results here.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          ) : viewMode === 'grid' ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredSessions.map((session) => (
                <Card key={session.session_id} className="h-full">
                  <CardHeader className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base font-semibold">
                        {session.bowling_alley_name || 'Bowling session'}
                      </CardTitle>
                      <Badge variant="outline">{session.series_total} series</Badge>
                    </div>
                    <CardDescription className="flex items-center gap-2 text-sm">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                      {new Date(session.session_date).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    {(session.location || session.bowling_alley_name) && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        {session.location || session.bowling_alley_name}
                      </div>
                    )}
                    {session.lane && (
                      <div className="flex items-center gap-2">
                        <Hash className="h-4 w-4 text-muted-foreground" />
                        Lane {session.lane}
                      </div>
                    )}
                    <div className="text-xs">
                      {session.game_count} {session.game_count === 1 ? 'game' : 'games'} • {session.average_score} avg
                    </div>
                  </CardContent>
                  <CardFooter className="flex gap-2">
                    {user && (
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleOpenMergeDialog(session)}
                        title="Merge this session into another bowler"
                      >
                        <GitMerge className="h-4 w-4" />
                      </Button>
                    )}
                    <Button asChild variant="secondary" className="flex-1">
                      <Link href={`/sessions/${session.session_id}`}>View session</Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Input
                  placeholder="Search sessions..."
                  value={(columnFilters.find(f => f.id === 'search')?.value as string) || ''}
                  onChange={(e) => {
                    const value = e.target.value
                    setColumnFilters(value ? [{ id: 'search', value }] : [])
                  }}
                  className="max-w-sm"
                />
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                          <TableHead key={header.id}>
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext()
                                )}
                          </TableHead>
                        ))}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {table.getRowModel().rows?.length ? (
                      table.getRowModel().rows.map((row) => (
                        <TableRow
                          key={row.id}
                          data-state={row.getIsSelected() && 'selected'}
                        >
                          {row.getVisibleCells().map((cell) => (
                            <TableCell key={cell.id}>
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext()
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={columns.length}
                          className="h-24 text-center"
                        >
                          No sessions found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        {/* Merge Dialog */}
        <Dialog open={mergeDialog.open} onOpenChange={(open) => {
          if (!open && !isMerging) {
            handleCloseMergeDialog()
          }
        }}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Merge Session</DialogTitle>
              <DialogDescription>
                Merge {bowler?.canonical_name}'s games from "{mergeDialog.sessionName}" into another bowler's profile.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Input
                  placeholder="Search for a bowler..."
                  value={bowlerSearch}
                  onChange={(e) => setBowlerSearch(e.target.value)}
                  disabled={isMerging}
                />
                {searchResults.length > 0 && (
                  <div className="rounded-md border">
                    <Command>
                      <CommandList>
                        <CommandGroup>
                          {searchResults.map((result) => (
                            <CommandItem
                              key={result.id}
                              onSelect={() => {
                                setSelectedTargetBowler(result)
                                setBowlerSearch(result.canonical_name)
                                setSearchResults([])
                              }}
                              className="cursor-pointer"
                            >
                              {result.canonical_name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </div>
                )}
              </div>
              {selectedTargetBowler && (
                <Alert>
                  <AlertTitle>Selected Bowler</AlertTitle>
                  <AlertDescription>
                    <p className="font-medium">{selectedTargetBowler.canonical_name}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      All games from this session will be moved to {selectedTargetBowler.canonical_name}'s profile.
                    </p>
                  </AlertDescription>
                </Alert>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={handleCloseMergeDialog}
                disabled={isMerging}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmMerge}
                disabled={!selectedTargetBowler || isMerging}
              >
                {isMerging ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Merging…
                  </>
                ) : (
                  <>
                    <GitMerge className="mr-2 h-4 w-4" />
                    Confirm Merge
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
