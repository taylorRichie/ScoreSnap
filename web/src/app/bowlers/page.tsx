'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Loader2, Users, Target, Trophy, Trash2, LayoutGrid, Table as TableIcon, ArrowUpDown } from 'lucide-react'
import { toast } from 'sonner'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'

export const dynamic = 'force-dynamic'

interface Bowler {
  id: string
  canonical_name: string
  primary_user_id: string | null
  created_by_user_id: string
  created_at: string
  game_count?: number
  average_score?: number
  high_game?: number
}

export default function BowlersPage() {
  const { user } = useAuth()
  const [bowlers, setBowlers] = useState<Bowler[]>([])
  const [loading, setLoading] = useState(true)
  const [claimingBowler, setClaimingBowler] = useState<string | null>(null)
  const [deletingBowler, setDeletingBowler] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [bowlerToDelete, setBowlerToDelete] = useState<Bowler | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const filteredBowlers = useMemo(() => {
    const searchQuery = (columnFilters.find(f => f.id === 'search')?.value as string) || ''
    if (!searchQuery) return bowlers
    
    return bowlers.filter(bowler =>
      bowler.canonical_name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [bowlers, columnFilters])

  const columns = useMemo<ColumnDef<Bowler>[]>(
    () => [
      {
        accessorKey: 'canonical_name',
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            >
              Name
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          )
        },
        cell: ({ row }) => (
          <Link
            href={`/bowlers/${row.original.id}`}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {row.getValue('canonical_name')}
          </Link>
        ),
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
        cell: ({ row }) => <div className="text-center">{row.getValue('average_score') ? (row.getValue('average_score') as number).toFixed(0) : '—'}</div>,
      },
      {
        accessorKey: 'high_game',
        header: ({ column }) => {
          return (
            <div className="text-center">
              <Button
                variant="ghost"
                onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
              >
                High Game
                <ArrowUpDown className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )
        },
        cell: ({ row }) => <div className="text-center">{row.getValue('high_game') || '—'}</div>,
      },
      {
        id: 'status',
        header: () => <div className="text-center">Status</div>,
        cell: ({ row }) => {
          const isClaimedByUser = row.original.primary_user_id === user?.id
          const claimedBySomeone = row.original.primary_user_id && !isClaimedByUser
          return (
            <div className="text-center">
              {claimedBySomeone && <Badge variant="outline">Claimed</Badge>}
              {!row.original.primary_user_id && <Badge variant="outline">Unclaimed</Badge>}
            </div>
          )
        },
      },
      {
        id: 'actions',
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => {
          const isClaimedByUser = row.original.primary_user_id === user?.id
          return (
            <div className="flex items-center justify-end gap-2">
              {user && (row.original.created_by_user_id === user.id || row.original.primary_user_id === user.id) && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteClick(row.original)}
                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              {user && isClaimedByUser && (
                <Button onClick={() => unclaimBowler(row.original.id)} variant="outline" size="sm">Unclaim</Button>
              )}
              {user && !row.original.primary_user_id && (
                <Button onClick={() => claimBowler(row.original.id)} disabled={claimingBowler === row.original.id} size="sm">
                  {claimingBowler === row.original.id ? 'Claiming…' : 'Claim'}
                </Button>
              )}
            </div>
          )
        },
      },
    ],
    [user, claimingBowler]
  )

  const table = useReactTable({
    data: filteredBowlers,
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
    fetchBowlers()
  }, [])

  const fetchBowlers = async () => {
    try {
      setLoading(true)

      // Get all bowlers with basic stats
      const { data: bowlersData, error } = await supabase
        .from('bowlers')
        .select(`
          id,
          canonical_name,
          primary_user_id,
          created_by_user_id,
          created_at
        `)
        .order('canonical_name')

      if (error) throw error

      // Get stats for each bowler
      const bowlersWithStats = await Promise.all(
        (bowlersData || []).map(async (bowler) => {
          try {
            const { data: stats } = await supabase
              .rpc('get_bowler_stats', { bowler_uuid: bowler.id })

            return {
              ...bowler,
              game_count: stats?.[0]?.total_games || 0,
              average_score: stats?.[0]?.average_score || 0,
              high_game: stats?.[0]?.high_game || 0
            }
          } catch (err) {
            console.warn(`Failed to get stats for bowler ${bowler.id}:`, err)
            return {
              ...bowler,
              game_count: 0,
              average_score: 0,
              high_game: 0
            }
          }
        })
      )

      // Filter out bowlers with no games (0 sessions)
      const bowlersWithGames = bowlersWithStats.filter(bowler => bowler.game_count > 0)

      setBowlers(bowlersWithGames)
    } catch (error) {
      console.error('Error fetching bowlers:', error)
      toast.error('Failed to load bowlers')
    } finally {
      setLoading(false)
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
      setBowlers(prev =>
        prev.map(b =>
          b.id === bowlerId
            ? { ...b, primary_user_id: user.id }
            : b
        )
      )
      toast.success('Bowler profile claimed successfully!')
    } catch (error) {
      console.error('Error claiming bowler:', error)
      toast.error('Failed to claim bowler profile')
    } finally {
      setClaimingBowler(null)
    }
  }

  const unclaimBowler = async (bowlerId: string) => {
    if (!user) return

    try {
      const { error } = await supabase
        .from('bowlers')
        .update({ primary_user_id: null })
        .eq('id', bowlerId)

      if (error) throw error

      // Update local state
      setBowlers(prev =>
        prev.map(b =>
          b.id === bowlerId
            ? { ...b, primary_user_id: null }
            : b
        )
      )
      toast.success('Bowler profile unclaimed')
    } catch (error) {
      console.error('Error unclaiming bowler:', error)
      toast.error('Failed to unclaim bowler profile')
    }
  }

  const handleDeleteClick = (bowler: Bowler) => {
    setBowlerToDelete(bowler)
    setDeleteDialogOpen(true)
  }

  const deleteBowler = async () => {
    if (!bowlerToDelete || !user) return

    setDeletingBowler(bowlerToDelete.id)
    setDeleteDialogOpen(false)

    try {
      const response = await fetch('/api/bowlers', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: bowlerToDelete.id }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete bowler')
      }

      // Update local state
      setBowlers(prev => prev.filter(b => b.id !== bowlerToDelete.id))
      toast.success('Bowler profile deleted successfully')
    } catch (error) {
      console.error('Error deleting bowler:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete bowler profile')
    } finally {
      setDeletingBowler(null)
      setBowlerToDelete(null)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-4">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/">Home</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Bowlers</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold text-foreground">Bowling profiles</h1>
              <p className="text-sm text-muted-foreground">
                Browse every profile extracted from uploads and claim the ones that belong to you.
              </p>
            </div>
            {bowlers.length > 0 && (
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

        {bowlers.length === 0 ? (
          <Card className="text-center">
            <CardHeader>
              <CardTitle>No bowlers found</CardTitle>
              <CardDescription>
                Bowlers will appear after you upload and process bowling scoreboards.
              </CardDescription>
            </CardHeader>
            <CardFooter className="flex justify-center">
              <Button asChild>
                <Link href="/upload">Upload scoreboard</Link>
              </Button>
            </CardFooter>
          </Card>
        ) : viewMode === 'grid' ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredBowlers.map((bowler) => {
              const isClaimedByUser = bowler.primary_user_id === user?.id
              const claimedBySomeone = bowler.primary_user_id && !isClaimedByUser

              return (
                <Card key={bowler.id} className="h-full">
                  <CardHeader className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base">
                        <Link
                          href={`/bowlers/${bowler.id}`}
                          className="text-foreground underline-offset-4 hover:underline"
                        >
                          {bowler.canonical_name}
                        </Link>
                      </CardTitle>
                      {claimedBySomeone && <Badge variant="outline">Claimed</Badge>}
                    </div>
                    <CardDescription>
                      Created {new Date(bowler.created_at).toLocaleDateString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="space-y-1">
                        <Users className="mx-auto h-4 w-4 text-muted-foreground" />
                        <div className="text-base font-semibold text-foreground">
                          {bowler.game_count}
                        </div>
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          Games
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Target className="mx-auto h-4 w-4 text-muted-foreground" />
                        <div className="text-base font-semibold text-foreground">
                          {bowler.average_score?.toFixed(0) || '—'}
                        </div>
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          Average
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Trophy className="mx-auto h-4 w-4 text-muted-foreground" />
                        <div className="text-base font-semibold text-foreground">
                          {bowler.high_game || '—'}
                        </div>
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          High game
                        </div>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex gap-2">
                    {user && (bowler.created_by_user_id === user.id || bowler.primary_user_id === user.id) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteClick(bowler)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    <Button asChild variant="secondary" size="sm" className="flex-1">
                      <Link href={`/bowlers/${bowler.id}`}>View profile</Link>
                    </Button>
                    {user && isClaimedByUser && (
                      <Button
                        onClick={() => unclaimBowler(bowler.id)}
                        variant="outline"
                        size="sm"
                      >
                        Unclaim
                      </Button>
                    )}
                    {user && !bowler.primary_user_id && (
                      <Button
                        onClick={() => claimBowler(bowler.id)}
                        disabled={claimingBowler === bowler.id}
                        size="sm"
                      >
                        {claimingBowler === bowler.id ? 'Claiming…' : 'Claim'}
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              )
            })}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Input
                placeholder="Search bowlers..."
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
                        No bowlers found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Bowler Profile</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete the bowler profile for "{bowlerToDelete?.canonical_name}"?
                This action cannot be undone and will permanently remove all associated game data.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={deleteBowler}
                disabled={deletingBowler !== null}
              >
                {deletingBowler ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting…
                  </>
                ) : (
                  'Delete'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
