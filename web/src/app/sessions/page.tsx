'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { CalendarDays, MapPin, Hash, Loader2, Trash2, LayoutGrid, Table as TableIcon, ArrowUpDown, Info } from 'lucide-react'
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
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '@/components/ui/breadcrumb'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'

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
}

interface Session {
  id: string
  name: string | null
  date_time: string
  location: string | null
  lane: string | null
  bowling_alley_name: string | null
  bowling_alley_id: string | null
  bowling_alleys?: BowlingAlley | null
  created_by_user_id: string
  status: string
  statusColor: string
  bowler_names?: string[]
  locationInfo?: {
    latitude: number
    longitude: number
    displayName: string
  } | null
  completionStats?: {
    totalGames: number
    completedGames: number
    hasPartialGames: boolean
    isComplete: boolean
    isInProgress: boolean
    isNotStarted: boolean
  }
}

interface Team {
  id: string
  name: string
  session_id: string
  bowlers?: Bowler[]
}

interface Bowler {
  id: string
  name: string
  team_id?: string
  primary_user_id?: string
}

export default function SessionsPage() {
  const { user, loading: authLoading } = useAuth()
  const [sessions, setSessions] = useState<Session[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const filteredSessions = useMemo(() => {
    const searchQuery = (columnFilters.find(f => f.id === 'search')?.value as string) || ''
    if (!searchQuery) return sessions
    
    const searchLower = searchQuery.toLowerCase()
    return sessions.filter(session => {
      return (
        session.name?.toLowerCase().includes(searchLower) ||
        session.bowling_alley_name?.toLowerCase().includes(searchLower) ||
        session.location?.toLowerCase().includes(searchLower) ||
        session.bowling_alleys?.name?.toLowerCase().includes(searchLower) ||
        session.bowler_names?.some(name => name.toLowerCase().includes(searchLower))
      )
    })
  }, [sessions, columnFilters])

  const getStatusVariant = (status: string) => {
    const normalized = status.toLowerCase()
    if (normalized.includes('complete')) return 'default'
    if (normalized.includes('progress')) return 'secondary'
    if (normalized.includes('partial')) return 'outline'
    return 'outline'
  }

  const columns = useMemo<ColumnDef<Session>[]>(
    () => [
      {
        accessorKey: 'name',
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
            href={`/sessions/${row.original.id}`}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {row.original.name || row.original.bowling_alley_name || 'Bowling session'}
          </Link>
        ),
      },
      {
        accessorKey: 'date_time',
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            >
              Date & Time
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          )
        },
        cell: ({ row }) => {
          return new Date(row.getValue('date_time')).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
          })
        },
      },
      {
        accessorKey: 'location',
        header: 'Location',
        cell: ({ row }) => {
          return (
            row.original.bowling_alleys?.name ||
            row.original.location ||
            (row.original.locationInfo ? row.original.locationInfo.displayName : '—')
          )
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
        accessorKey: 'status',
        header: ({ column }) => {
          return (
            <div className="text-center">
              <Button
                variant="ghost"
                onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
              >
                Status
                <ArrowUpDown className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )
        },
        cell: ({ row }) => {
          const status = row.getValue('status') as string
          const isIncomplete = status.toLowerCase().includes('incomplete')
          
          return (
            <div className="flex items-center justify-center">
              {isIncomplete && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="cursor-help">
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Incomplete data</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          )
        },
      },
      {
        id: 'actions',
        cell: ({ row }) => {
          return (
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.preventDefault()
                  handleDeleteClick(row.original, e)
                }}
                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button asChild variant="secondary" size="sm">
                <Link href={`/sessions/${row.original.id}`}>View session</Link>
              </Button>
            </div>
          )
        },
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
    if (!authLoading) {
      if (user) {
        fetchSessions()
      } else {
        setLoading(false)
        setError('Please log in to view your sessions')
      }
    }
  }, [user, authLoading])

  const fetchSessions = async () => {
    try {
      setLoading(true)

      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('No authentication session found')
      }

      const response = await fetch('/api/sessions', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch sessions')
      }

      const data = await response.json()
      setSessions(data.sessions || [])
    } catch (err) {
      console.error('Error fetching sessions:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      toast.error('Failed to load sessions')
    } finally {
      setLoading(false)
    }
  }

  const fetchSessionTeams = async (sessionId: string) => {
    try {
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('No authentication session found')
      }

      const response = await fetch(`/api/sessions/${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch session details')
      }
      const data = await response.json()
      return data.session?.teams || []
    } catch (err) {
      console.error('Error fetching session teams:', err)
      return []
    }
  }

  const handleSessionClick = async (session: Session) => {
    // For now, just navigate to session detail
    // Teams will be loaded there
  }

  const handleDeleteClick = (session: Session, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setSessionToDelete(session)
    setDeleteDialogOpen(true)
  }

  const handleDeleteSession = async () => {
    if (!sessionToDelete) return

    setIsDeleting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('No authentication session found')
      }

      const response = await fetch(`/api/sessions/${sessionToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete session')
      }

      toast.success('Session deleted successfully')
      
      // Remove session from list
      setSessions(sessions.filter(s => s.id !== sessionToDelete.id))
      
      setDeleteDialogOpen(false)
      setSessionToDelete(null)
    } catch (err) {
      console.error('Error deleting session:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to delete session')
    } finally {
      setIsDeleting(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto flex min-h-[60vh] max-w-7xl items-center justify-center px-4">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <Alert variant="destructive">
            <AlertTitle>Error loading sessions</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
          <div className="space-y-4">
            <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/dashboard">Dashboard</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Sessions</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold text-foreground">Bowling sessions</h1>
              <p className="text-sm text-muted-foreground">
                Review every processed session, including location, bowling alley, and status.
              </p>
            </div>
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
          <Card className="text-center">
            <CardHeader className="space-y-2">
              <CardTitle>No sessions found</CardTitle>
              <CardDescription>
                Start by uploading bowling scoreboard images to create your first session.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/upload">Upload scoreboard</Link>
              </Button>
            </CardContent>
          </Card>
        ) : viewMode === 'grid' ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredSessions.map((session) => (
              <Card key={session.id} className="h-full">
                <CardHeader className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base font-semibold">
                      {session.name || session.bowling_alley_name || 'Bowling session'}
                    </CardTitle>
                    {session.status.toLowerCase().includes('incomplete') && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button type="button" className="cursor-help">
                            <Info className="h-4 w-4 text-muted-foreground" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Incomplete data</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
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
                  {(session.bowling_alleys?.name || session.location || session.locationInfo) && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      {session.bowling_alleys?.name ||
                        session.location ||
                        (session.locationInfo ? session.locationInfo.displayName : 'Location unknown')}
                    </div>
                  )}
                  {session.lane && (
                    <div className="flex items-center gap-2">
                      <Hash className="h-4 w-4 text-muted-foreground" />
                      Lane {session.lane}
                    </div>
                  )}
                </CardContent>
                <CardFooter className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => handleDeleteClick(session, e)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Button asChild variant="secondary" className="flex-1">
                    <Link href={`/sessions/${session.id}`}>View session</Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Input
                placeholder="Search sessions (name, location, bowler)..."
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Session</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this session? This will permanently remove:
              <ul className="mt-2 list-inside list-disc space-y-1">
                <li>All games and scores from this session</li>
                <li>All uploaded images associated with this session</li>
                <li>All team data for this session</li>
              </ul>
              <p className="mt-2 font-semibold">This action cannot be undone.</p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteSession}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Session
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  )
}
