'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { MapPin, Phone, Globe, Loader2, LayoutGrid, Table as TableIcon, ArrowUpDown } from 'lucide-react'
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
import { getGooglePlacesPhotoUrl, getStaticMapUrl } from '@/lib/google-places-photo'

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
  session_count?: number
}

export default function AlleysPage() {
  const { user, loading: authLoading } = useAuth()
  const [alleys, setAlleys] = useState<BowlingAlley[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const filteredAlleys = useMemo(() => {
    const searchQuery = (columnFilters.find(f => f.id === 'search')?.value as string) || ''
    if (!searchQuery) return alleys
    
    const searchLower = searchQuery.toLowerCase()
    return alleys.filter(alley => {
      return (
        alley.name?.toLowerCase().includes(searchLower) ||
        alley.city?.toLowerCase().includes(searchLower) ||
        alley.state?.toLowerCase().includes(searchLower) ||
        alley.address?.toLowerCase().includes(searchLower)
      )
    })
  }, [alleys, columnFilters])

  const columns = useMemo<ColumnDef<BowlingAlley>[]>(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            Alley Name <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <Link href={`/alleys/${row.original.id}`} className="font-medium text-foreground underline-offset-4 hover:underline">
            {row.original.name}
          </Link>
        ),
      },
      {
        accessorKey: 'city',
        header: 'City',
        cell: ({ row }) => row.getValue('city') || '—',
      },
      {
        accessorKey: 'state',
        header: 'State',
        cell: ({ row }) => row.getValue('state') || '—',
      },
      {
        accessorKey: 'session_count',
        header: ({ column }) => (
          <div className="text-center">
            <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
              Sessions <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          </div>
        ),
        cell: ({ row }) => (
          <div className="text-center">{row.getValue('session_count') || 0}</div>
        ),
      },
      {
        id: 'actions',
        cell: ({ row }) => (
          <div className="flex items-center justify-end">
            <Button asChild variant="secondary" size="sm">
              <Link href={`/alleys/${row.original.id}`}>View details</Link>
            </Button>
          </div>
        ),
      },
    ],
    []
  )

  const table = useReactTable({
    data: filteredAlleys,
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
      fetchAlleys()
    }
  }, [authLoading])

  const fetchAlleys = async () => {
    try {
      setLoading(true)

      // Get all bowling alleys with session count
      const { data: alleysData, error } = await supabase
        .from('bowling_alleys')
        .select(`
          id,
          name,
          address,
          city,
          state,
          zip_code,
          phone,
          website,
          google_place_id
        `)
        .order('name')

      if (error) throw error

      // Get session count for each alley
      const alleysWithCounts = await Promise.all(
        (alleysData || []).map(async (alley) => {
          const { count } = await supabase
            .from('sessions')
            .select('*', { count: 'exact', head: true })
            .eq('bowling_alley_id', alley.id)

          return {
            ...alley,
            session_count: count || 0
          }
        })
      )

      setAlleys(alleysWithCounts)
    } catch (error) {
      console.error('Error fetching alleys:', error)
      toast.error('Failed to load bowling alleys')
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
                <BreadcrumbPage>Alleys</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold text-foreground">Bowling alleys</h1>
              <p className="text-sm text-muted-foreground">
                Browse bowling alleys where you've bowled and view their session history.
              </p>
            </div>
            {alleys.length > 0 && (
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

        {alleys.length === 0 ? (
          <Card className="text-center">
            <CardHeader className="space-y-2">
              <CardTitle>No bowling alleys found</CardTitle>
              <CardDescription>
                Bowling alleys will appear here once you upload scoreboard images.
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
            {filteredAlleys.map((alley) => {
              const fullAddress = [alley.address, alley.city, alley.state, alley.zip_code]
                .filter(Boolean)
                .join(', ')
              
              const photoUrl = alley.google_place_id 
                ? getGooglePlacesPhotoUrl(alley.google_place_id, 600)
                : getStaticMapUrl(fullAddress, 600, 300)

              return (
                <Card key={alley.id} className="h-full overflow-hidden">
                  {photoUrl && (
                    <div className="relative aspect-[2/1] w-full overflow-hidden">
                      <img
                        src={photoUrl}
                        alt={alley.name}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          const fallbackUrl = getStaticMapUrl(fullAddress, 600, 300)
                          if (fallbackUrl && target.src !== fallbackUrl) {
                            target.src = fallbackUrl
                          }
                        }}
                      />
                    </div>
                  )}
                  <CardHeader className="space-y-2">
                    <CardTitle className="text-base font-semibold">
                      {alley.name}
                    </CardTitle>
                    {(alley.city || alley.state) && (
                      <CardDescription className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        {[alley.city, alley.state].filter(Boolean).join(', ')}
                      </CardDescription>
                    )}
                  </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  {alley.address && (
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <span>{alley.address}</span>
                    </div>
                  )}
                  {alley.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      {alley.phone}
                    </div>
                  )}
                  {alley.website && (
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <a href={alley.website} target="_blank" rel="noopener noreferrer" className="hover:underline truncate">
                        {alley.website.replace(/^https?:\/\//, '')}
                      </a>
                    </div>
                  )}
                  <div className="text-xs pt-2 border-t">
                    {alley.session_count} {alley.session_count === 1 ? 'session' : 'sessions'}
                  </div>
                </CardContent>
                <CardFooter>
                  <Button asChild variant="secondary" className="w-full">
                    <Link href={`/alleys/${alley.id}`}>View details</Link>
                  </Button>
                </CardFooter>
              </Card>
              )
            })}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Input
                placeholder="Search alleys..."
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
                        No alleys found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

