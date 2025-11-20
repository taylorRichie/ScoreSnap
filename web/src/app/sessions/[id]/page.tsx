'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { CalendarDays, MapPin, Phone, Globe, Loader2, Hash, Pencil, Check, X, Trash2, Trophy, Zap, AlertCircle, Sparkles, Image as ImageIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import { Cross1Icon } from '@radix-ui/react-icons'
import { toast } from 'sonner'

import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

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
  lane: number | null
  bowling_alley_name: string | null
  bowling_alley_id: string | null
  bowling_alleys?: BowlingAlley | null
  created_at: string
}

interface Team {
  id: string
  name: string
  team_bowlers: Array<{
    bowler: {
      id: string
      canonical_name: string
    }
  }>
}

interface BowlerScore {
  series_id: string
  bowler: {
    id: string
    canonical_name: string
  }
  games: Array<{
    id: string
    game_number: number
    total_score: number | null
    is_partial: boolean
    frames: Array<{
      frame_number: number
      roll_1: number | null
      roll_2: number | null
      roll_3: number | null
      notation: string | null
    }>
  }>
  series_total: number
  average_score: number
}

interface Upload {
  id: string
  storage_path: string
  original_filename: string
  created_at: string
}

export default function SessionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading } = useAuth()
  const sessionId = params.id as string

  const [session, setSession] = useState<Session | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [bowlerScores, setBowlerScores] = useState<BowlerScore[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState('')
  const [isSavingName, setIsSavingName] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [highlightedGame, setHighlightedGame] = useState<{ gameId: string; bowlerId: string } | null>(null)
  const [isFlashing, setIsFlashing] = useState(false)
  const [teamViewEnabled, setTeamViewEnabled] = useState(true)
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null)
  const [editedTeamName, setEditedTeamName] = useState('')
  const [generatingTeamName, setGeneratingTeamName] = useState<string | null>(null)
  const [uploads, setUploads] = useState<Upload[]>([])
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const gameRowRefs = useRef<{ [key: string]: HTMLTableRowElement | null }>({})
  const teamScoreRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})

  useEffect(() => {
    if (!authLoading) {
      if (user && sessionId) {
        fetchSessionData()
      } else if (!user) {
        setLoading(false)
        setError('Please log in to view session details')
      }
    }
  }, [user, authLoading, sessionId])

  // Keyboard navigation for image gallery
  useEffect(() => {
    if (!galleryOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        handlePreviousImage()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        handleNextImage()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        handleCloseGallery()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [galleryOpen, uploads.length])

  const fetchSessionData = async () => {
    try {
      setLoading(true)

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
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch session data')
      }

      const data = await response.json()
      console.log('📊 Session data received:', {
        sessionId: data.session?.id,
        teamsCount: data.teams?.length,
        teams: data.teams,
        scoresCount: data.scores?.length
      })
      
      // Debug team_bowlers
      data.teams?.forEach((team: any) => {
        console.log(`👥 Team "${team.name}":`, {
          teamId: team.id,
          bowlersCount: team.team_bowlers?.length,
          bowlers: team.team_bowlers?.map((tb: any) => tb.bowler?.canonical_name)
        })
      })
      
      setSession(data.session)
      setTeams(data.teams || [])
      setBowlerScores(data.scores || [])
      
      // Fetch uploads for this session
      await fetchUploads()

    } catch (err) {
      console.error('Error fetching session data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load session data')
    } finally {
      setLoading(false)
    }
  }

  const fetchUploads = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return

      // Fetch uploads that are linked to this session
      const { data, error } = await supabase
        .from('uploads')
        .select('id, storage_path, original_filename, created_at')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })

      if (error) throw error

      setUploads(data || [])
    } catch (err) {
      console.error('Error fetching uploads:', err)
    }
  }

  const handleOpenGallery = (index: number = 0) => {
    setCurrentImageIndex(index)
    setGalleryOpen(true)
  }

  const handleCloseGallery = () => {
    setGalleryOpen(false)
  }

  const handlePreviousImage = () => {
    setCurrentImageIndex((prev) => (prev > 0 ? prev - 1 : uploads.length - 1))
  }

  const handleNextImage = () => {
    setCurrentImageIndex((prev) => (prev < uploads.length - 1 ? prev + 1 : 0))
  }

  const handleEditName = () => {
    setEditedName(session?.name || '')
    setIsEditingName(true)
  }

  const handleCancelEdit = () => {
    setIsEditingName(false)
    setEditedName('')
  }

  const handleSaveName = async () => {
    if (!session || !editedName.trim()) return

    setIsSavingName(true)
    try {
      const { error } = await supabase
        .from('sessions')
        .update({ name: editedName.trim() })
        .eq('id', sessionId)

      if (error) throw error

      setSession({ ...session, name: editedName.trim() })
      setIsEditingName(false)
      toast.success('Session name updated successfully')
    } catch (err) {
      console.error('Error updating session name:', err)
      toast.error('Failed to update session name')
    } finally {
      setIsSavingName(false)
    }
  }

  const handleDeleteSession = async () => {
    if (!session) return

    setIsDeleting(true)
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession()
      if (!authSession?.access_token) {
        throw new Error('No authentication session found')
      }

      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authSession.access_token}`
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete session')
      }

      toast.success('Session deleted successfully')
      router.push('/sessions')
    } catch (err) {
      console.error('Error deleting session:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to delete session')
    } finally {
      setIsDeleting(false)
      setDeleteDialogOpen(false)
    }
  }

  const handleEditTeamName = (teamId: string, currentName: string) => {
    setEditingTeamId(teamId)
    setEditedTeamName(currentName)
  }

  const handleSaveTeamName = async (teamId: string) => {
    if (!editedTeamName.trim()) {
      toast.error('Team name cannot be empty')
      return
    }

    try {
      const { error } = await supabase
        .from('teams')
        .update({ name: editedTeamName.trim() })
        .eq('id', teamId)

      if (error) throw error

      // Update local state
      setTeams(teams.map(team => 
        team.id === teamId ? { ...team, name: editedTeamName.trim() } : team
      ))
      
      setEditingTeamId(null)
      toast.success('Team name updated')
    } catch (error) {
      console.error('Error updating team name:', error)
      toast.error('Failed to update team name')
    }
  }

  const handleGenerateTeamName = async (teamId: string) => {
    setGeneratingTeamName(teamId)
    
    try {
      const team = teams.find(t => t.id === teamId)
      if (!team) return

      const teamBowlerIds = team.team_bowlers.map(tb => tb.bowler.id)
      const teamBowlers = bowlerScores.filter(bs => teamBowlerIds.includes(bs.bowler.id))

      const response = await fetch('/api/generate-team-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bowlers: teamBowlers.map(bs => ({
            name: bs.bowler.canonical_name,
            scores: bs.games.map(g => g.total_score),
            average: bs.average_score,
            seriesTotal: bs.series_total
          })),
          location: session?.bowling_alley_name || session?.location,
          sessionDate: session?.date_time
        })
      })

      if (!response.ok) throw new Error('Failed to generate team name')

      const { teamName } = await response.json()

      // Update team name in database
      const { error } = await supabase
        .from('teams')
        .update({ name: teamName })
        .eq('id', teamId)

      if (error) throw error

      // Update local state
      setTeams(teams.map(team => 
        team.id === teamId ? { ...team, name: teamName } : team
      ))

      toast.success('Team name generated!')
    } catch (error) {
      console.error('Error generating team name:', error)
      toast.error('Failed to generate team name')
    } finally {
      setGeneratingTeamName(null)
    }
  }

  const handleScoreClick = (gameId: string, bowlerId: string, gameNumber: number) => {
    const accordionTrigger = document.querySelector(`[data-game-number="${gameNumber}"]`)
    if (!accordionTrigger) return
    
    // Check if accordion needs to be opened first
    const accordionItem = accordionTrigger.closest('[data-state]')
    const needsToOpen = accordionItem?.getAttribute('data-state') === 'closed'
    
    if (needsToOpen) {
      // Open accordion first, then scroll after DOM settles
      const trigger = accordionTrigger as HTMLElement
      trigger.click()
      
      // Wait for accordion animation to complete before scrolling
      setTimeout(() => {
        const rowKey = `${gameId}-${bowlerId}`
        const row = gameRowRefs.current[rowKey]
        if (row) {
          row.scrollIntoView({ behavior: 'smooth', block: 'center' })
          
          // Start flash after scroll begins
          setTimeout(() => {
            setIsFlashing(true)
            setHighlightedGame({ gameId, bowlerId })
            
            // End flash after animation
            setTimeout(() => {
              setIsFlashing(false)
            }, 800)
          }, 400)
        }
      }, 350)
    } else {
      // Accordion already open, just scroll
      const rowKey = `${gameId}-${bowlerId}`
      const row = gameRowRefs.current[rowKey]
      if (row) {
        row.scrollIntoView({ behavior: 'smooth', block: 'center' })
        
        // Start flash after scroll begins
        setTimeout(() => {
          setIsFlashing(true)
          setHighlightedGame({ gameId, bowlerId })
          
          // End flash after animation
          setTimeout(() => {
            setIsFlashing(false)
          }, 800)
        }, 400)
      }
    }
  }

  const handleTeamCardClick = (teamId: string) => {
    const teamCard = teamScoreRefs.current[teamId]
    if (teamCard) {
      teamCard.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // Handle query parameters for highlighting
  useEffect(() => {
    if (!loading && bowlerScores.length > 0) {
      const highlightGameParam = searchParams.get('highlightGame')
      const bowlerIdParam = searchParams.get('bowlerId')
      const highlightBowlerParam = searchParams.get('highlightBowler')

      if (highlightGameParam && bowlerIdParam) {
        // Find the game and highlight it
        const gameNumber = parseInt(highlightGameParam)
        const bowler = bowlerScores.find(bs => bs.bowler.id === bowlerIdParam)
        const game = bowler?.games.find(g => g.game_number === gameNumber)
        
        if (game && bowler) {
          // Small delay to ensure DOM is ready
          setTimeout(() => {
            handleScoreClick(game.id, bowler.bowler.id, gameNumber)
          }, 500)
        }
      } else if (highlightBowlerParam) {
        // Scroll to scores section
        setTimeout(() => {
          const scoresSection = document.querySelector('[class*="space-y-4"] h2')
          if (scoresSection && scoresSection.textContent === 'Scores') {
            scoresSection.parentElement?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
        }, 300)
      }
    }
  }, [loading, bowlerScores, searchParams, handleScoreClick])

  // Clear highlight on any click
  useEffect(() => {
    const handleClick = () => {
      if (highlightedGame) {
        setHighlightedGame(null)
        setIsFlashing(false)
      }
    }

    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [highlightedGame])

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Unable to load session</CardTitle>
            <CardDescription>{error || 'Session not found.'}</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild variant="secondary" className="w-full">
              <Link href="/dashboard">Back to dashboard</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  // Calculate actual unique games played (not bowler count * games)
  const uniqueGameNumbers = new Set<number>()
  bowlerScores.forEach(bowler => {
    bowler.games.forEach(game => {
      uniqueGameNumbers.add(game.game_number)
    })
  })
  const totalGames = uniqueGameNumbers.size
  
  const averageScore =
    bowlerScores.length > 0
      ? Math.round(
          bowlerScores.reduce((sum, bowler) => sum + bowler.average_score, 0) / bowlerScores.length
        )
      : 0
  const maxGames = bowlerScores.length > 0 ? Math.max(...bowlerScores.map((b) => b.games.length)) : 0
  
  // Calculate session statistics
  const allScores = bowlerScores.flatMap(b => b.games.map(g => g.total_score).filter(s => s !== null)) as number[]
  const highScore = allScores.length > 0 ? Math.max(...allScores) : 0
  const highScoreBowler = bowlerScores.find(b => 
    b.games.some(g => g.total_score === highScore)
  )
  const highScoreGame = highScoreBowler?.games.find(g => g.total_score === highScore)
  
  // Calculate strikes (would need frame data)
  const totalStrikes = bowlerScores.reduce((sum, bowler) => {
    return sum + bowler.games.reduce((gameSum, game) => {
      if (!game.frames) return gameSum
      return gameSum + game.frames.filter(f => f.notation === 'X').length
    }, 0)
  }, 0)

  // Calculate team statistics
  const teamStats = teams.map(team => {
    const teamBowlerIds = team.team_bowlers.map(tb => tb.bowler.id)
    const teamBowlers = bowlerScores.filter(bs => teamBowlerIds.includes(bs.bowler.id))
    const teamTotal = teamBowlers.reduce((sum, bowler) => sum + bowler.series_total, 0)
    const teamGameScores = teamBowlers.flatMap(b => b.games.map(g => ({ score: g.total_score, game: g, bowler: b })).filter(item => item.score !== null))
    const teamHighScoreItem = teamGameScores.length > 0 
      ? teamGameScores.reduce((max, item) => (item.score! > max.score! ? item : max))
      : null
    const teamHighScore = teamHighScoreItem?.score ?? 0
    const teamAverage = teamBowlers.length > 0 
      ? Math.round(teamBowlers.reduce((sum, b) => sum + b.average_score, 0) / teamBowlers.length)
      : 0
    
    return {
      team,
      total: teamTotal,
      average: teamAverage,
      highScore: teamHighScore,
      highScoreGame: teamHighScoreItem?.game,
      highScoreBowler: teamHighScoreItem?.bowler,
      bowlerCount: teamBowlers.length
    }
  })

  const winningTeam = teamStats.length > 0 
    ? teamStats.reduce((winner, current) => current.total > winner.total ? current : winner)
    : null

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/dashboard">Dashboard</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/sessions">Sessions</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{session.name || session.bowling_alley_name || 'Session'}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <Card>
          <CardHeader className="space-y-2">
            <div className="flex items-center gap-2">
              {isEditingName ? (
                <div className="flex flex-1 items-center gap-2">
                  <Input
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    placeholder="Enter session name"
                    className="flex-1"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveName()
                      if (e.key === 'Escape') handleCancelEdit()
                    }}
                    autoFocus
                  />
                  <Button
                    size="sm"
                    onClick={handleSaveName}
                    disabled={isSavingName || !editedName.trim()}
                  >
                    {isSavingName ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancelEdit}
                    disabled={isSavingName}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex-1">
                    <CardTitle className="text-2xl">
                      {session.name || session.bowling_alleys?.name || session.bowling_alley_name || 'Bowling session'}
                    </CardTitle>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleEditName}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <span>
                {new Date(session.date_time).toLocaleDateString()} · {new Date(session.date_time).toLocaleTimeString()}
              </span>
            </div>
            {(session.bowling_alleys?.name || session.bowling_alley_name || session.lane) && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>
                  {session.bowling_alleys?.name || session.bowling_alley_name || ''}
                  {session.lane && (
                    <>
                      {(session.bowling_alleys?.name || session.bowling_alley_name) && ' · '}
                      Lane {session.lane}
                    </>
                  )}
                </span>
              </div>
            )}
            {session.bowling_alleys ? (
              <>
                {(session.bowling_alleys.address ||
                  session.bowling_alleys.city ||
                  session.bowling_alleys.state ||
                  session.bowling_alleys.zip_code) && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 mt-0.5 opacity-0" />
                    <span>
                      {session.bowling_alleys.address}
                      {session.bowling_alleys.city && `, ${session.bowling_alleys.city}`}
                      {session.bowling_alleys.state && `, ${session.bowling_alleys.state}`}
                      {session.bowling_alleys.zip_code && ` ${session.bowling_alleys.zip_code}`}
                    </span>
                  </div>
                )}
                {session.bowling_alleys.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={`tel:${session.bowling_alleys.phone}`}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {session.bowling_alleys.phone}
                    </a>
                  </div>
                )}
                {session.bowling_alleys.website && (
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={session.bowling_alleys.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      Visit website
                    </a>
                  </div>
                )}
              </>
            ) : (
              session.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  {session.location}
                </div>
              )
            )}
          </CardContent>
          <CardFooter className="flex justify-between items-center border-t pt-4">
            {/* Image Gallery Button */}
            {uploads.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleOpenGallery(0)}
                className="gap-2"
              >
                <div className="relative">
                  <ImageIcon className="h-4 w-4" />
                  <Badge 
                    variant="secondary" 
                    className="absolute -top-2 -right-2 h-4 w-4 p-0 flex items-center justify-center text-[10px]"
                  >
                    {uploads.length}
                  </Badge>
                </div>
                <span className="text-xs">Images</span>
              </Button>
            )}
            {teams.length > 0 && (
              <div className="flex items-center gap-2 ml-auto">
                <Label htmlFor="team-view-toggle" className="text-sm cursor-pointer">
                  Teams
                </Label>
                <Switch
                  id="team-view-toggle"
                  checked={teamViewEnabled}
                  onCheckedChange={setTeamViewEnabled}
                />
              </div>
            )}
          </CardFooter>
        
        </Card>

        {teams.length > 0 && teamViewEnabled && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Teams</h2>
              <Badge variant="outline" className="text-xs">
                {teams.length} teams
              </Badge>
            </div>
            <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 ${teams.length >= 4 ? 'xl:grid-cols-4' : ''}`}>
              {teams.map((team) => {
                const teamStat = teamStats.find(t => t.team.id === team.id)
                const isWinningTeam = winningTeam?.team.id === team.id
                
                return (
                  <Card 
                    key={team.id} 
                    className="h-full cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => handleTeamCardClick(team.id)}
                  >
                  <CardHeader>
                      <div className="flex items-center gap-2">
                        {editingTeamId === team.id ? (
                          <>
                            <Input
                              value={editedTeamName}
                              onChange={(e) => setEditedTeamName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleSaveTeamName(team.id)
                                } else if (e.key === 'Escape') {
                                  setEditingTeamId(null)
                                }
                              }}
                              className="h-7 text-base font-semibold"
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleSaveTeamName(team.id)
                              }}
                              className="h-7 w-7 p-0"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditingTeamId(null)
                              }}
                              className="h-7 w-7 p-0"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            {isWinningTeam && (
                              <Trophy className="h-4 w-4 text-yellow-500 shrink-0" />
                            )}
                            <CardTitle className="text-base flex-1">{team.name}</CardTitle>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEditTeamName(team.id, team.name)
                              }}
                              className="h-7 w-7 p-0"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleGenerateTeamName(team.id)
                              }}
                              disabled={generatingTeamName === team.id}
                              className="h-7 w-7 p-0"
                            >
                              {generatingTeamName === team.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Sparkles className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </>
                        )}
                      </div>
                      {teamStat && (
                        <div className="space-y-1 text-xs text-muted-foreground mt-2">
                          <div className="flex justify-between">
                            <span>Series:</span>
                            <span className="font-semibold">{teamStat.total}</span>
                          </div>
                          <div 
                            className="flex justify-between cursor-pointer hover:text-foreground transition-colors"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (teamStat.highScoreGame && teamStat.highScoreBowler) {
                                handleScoreClick(teamStat.highScoreGame.id, teamStat.highScoreBowler.bowler.id, teamStat.highScoreGame.game_number)
                              }
                            }}
                          >
                            <span>High score:</span>
                            <span className="font-semibold">{teamStat.highScore}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Average:</span>
                            <span className="font-semibold">{teamStat.average}</span>
                          </div>
                        </div>
                      )}
                      <CardDescription className="mt-2">{team.team_bowlers.length} bowlers</CardDescription>
                  </CardHeader>
                    <CardContent 
                      className="space-y-1 text-sm text-muted-foreground"
                      onClick={(e) => e.stopPropagation()}
                    >
                    {team.team_bowlers.map((teamBowler) => (
                        <Link 
                          key={teamBowler.bowler.id}
                          href={`/bowlers/${teamBowler.bowler.id}`}
                          className="block hover:text-foreground transition-colors cursor-pointer"
                        >
                          {teamBowler.bowler.canonical_name}
                        </Link>
                    ))}
                  </CardContent>
                </Card>
                )
              })}
            </div>
          </section>
        )}

        {bowlerScores.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Session summary</h2>
            {teams.length > 0 && teamViewEnabled ? (
              /* Team-based summary */
              <>
                {/* Session-level summary */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {winningTeam && (
              <Card>
                      <CardHeader>
                        <CardDescription className="flex items-center gap-1">
                          <Trophy className="h-4 w-4" />
                          Winning team
                        </CardDescription>
                        <CardTitle className="text-3xl">{winningTeam.total}</CardTitle>
                        <CardDescription className="text-xs mt-1">
                          {winningTeam.team.name}
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  )}
                  <Card>
                    <CardHeader>
                      <CardDescription>Session high score</CardDescription>
                      <button
                        onClick={() => {
                          if (highScoreGame && highScoreBowler) {
                            handleScoreClick(highScoreGame.id, highScoreBowler.bowler.id, highScoreGame.game_number)
                          }
                        }}
                        className="cursor-pointer hover:opacity-70 transition-opacity text-left"
                      >
                        <CardTitle className="text-3xl">{highScore}</CardTitle>
                        {highScoreBowler && (
                          <CardDescription className="text-xs mt-1">
                            {highScoreBowler.bowler.canonical_name}
                          </CardDescription>
                        )}
                      </button>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader>
                  <CardDescription>Bowlers</CardDescription>
                  <CardTitle className="text-3xl">{bowlerScores.length}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                    <CardHeader>
                  <CardDescription>Games played</CardDescription>
                  <CardTitle className="text-3xl">{totalGames}</CardTitle>
                </CardHeader>
              </Card>
                </div>
              </>
            ) : (
              /* Individual-based summary */
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                  <CardHeader>
                    <CardDescription>Bowlers</CardDescription>
                    <CardTitle className="text-3xl">{bowlerScores.length}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader>
                    <CardDescription>Games played</CardDescription>
                    <CardTitle className="text-3xl">{totalGames}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader>
                  <CardDescription>Average score</CardDescription>
                  <CardTitle className="text-3xl">{averageScore}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                  <CardHeader>
                  <CardDescription className="flex items-center gap-1">
                    <Trophy className="h-4 w-4" />
                    High score
                  </CardDescription>
                    <button
                      onClick={() => {
                        if (highScoreGame && highScoreBowler) {
                          handleScoreClick(highScoreGame.id, highScoreBowler.bowler.id, highScoreGame.game_number)
                        }
                      }}
                      className="cursor-pointer hover:opacity-70 transition-opacity text-left"
                    >
                  <CardTitle className="text-3xl">{highScore}</CardTitle>
                  {highScoreBowler && (
                    <CardDescription className="text-xs mt-1">
                      {highScoreBowler.bowler.canonical_name}
                    </CardDescription>
                  )}
                    </button>
                </CardHeader>
              </Card>
            </div>
            )}
            {totalStrikes > 0 && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardDescription className="flex items-center gap-1">
                      <Zap className="h-4 w-4" />
                      Total strikes
                    </CardDescription>
                    <CardTitle className="text-3xl">{totalStrikes}</CardTitle>
                  </CardHeader>
                </Card>
              </div>
            )}
          </section>
        )}

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Scores</h2>
            {bowlerScores.length > 0 && (
              <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {bowlerScores.length} bowlers
                </Badge>
                {teams.length > 0 && teamViewEnabled && (
                  <Badge variant="outline" className="text-xs">
                    {teams.length} {teams.length === 1 ? 'team' : 'teams'}
              </Badge>
            )}
          </div>
            )}
          </div>
          
          {bowlerScores.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
                <Alert>
                  <AlertTitle>No scores yet</AlertTitle>
                  <AlertDescription>
                    Upload a scoreboard or re-run processing to populate this session.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          ) : (teams.length > 0 && teamViewEnabled) ? (
            /* Display by teams if teams exist */
            <div className="space-y-6">
              {teams.map((team) => {
                // Get bowlers for this team
                const teamBowlerIds = team.team_bowlers.map(tb => tb.bowler.id)
                const teamBowlers = bowlerScores.filter(bs => teamBowlerIds.includes(bs.bowler.id))
                
                // Calculate team totals per game
                const teamTotals = Array.from({ length: maxGames }, (_, i) => {
                  const gameNum = i + 1
                  return teamBowlers.reduce((sum, bowler) => {
                    const game = bowler.games.find(g => g.game_number === gameNum)
                    return sum + (game?.total_score || 0)
                  }, 0)
                })
                const teamGrandTotal = teamTotals.reduce((sum, total) => sum + total, 0)
                
                return (
                  <Card 
                    key={team.id}
                    ref={(el) => { teamScoreRefs.current[team.id] = el }}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {editingTeamId === team.id ? (
                            <>
                              <Input
                                value={editedTeamName}
                                onChange={(e) => setEditedTeamName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleSaveTeamName(team.id)
                                  } else if (e.key === 'Escape') {
                                    setEditingTeamId(null)
                                  }
                                }}
                                className="h-7 text-base font-semibold"
                                autoFocus
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleSaveTeamName(team.id)}
                                className="h-7 w-7 p-0"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingTeamId(null)}
                                className="h-7 w-7 p-0"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <CardTitle className="text-base">{team.name}</CardTitle>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEditTeamName(team.id, team.name)}
                                className="h-7 w-7 p-0"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleGenerateTeamName(team.id)}
                                disabled={generatingTeamName === team.id}
                                className="h-7 w-7 p-0"
                              >
                                {generatingTeamName === team.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Sparkles className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                          <span>Total:</span>
                          <span className="text-foreground">{teamGrandTotal}</span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Bowler</TableHead>
                        {Array.from({ length: maxGames }, (_, i) => i + 1).map((gameNum) => (
                          <TableHead key={gameNum} className="text-center">
                            Game {gameNum}
                          </TableHead>
                        ))}
                        <TableHead className="text-center">Series</TableHead>
                        <TableHead className="text-center">Average</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                            {teamBowlers.map((bowlerScore, index) => (
                              <TableRow key={bowlerScore.bowler.id} className={index % 2 === 0 ? 'bg-muted/30' : ''}>
                                <TableCell className="font-medium bg-muted/50">
                            <Link
                              href={`/bowlers/${bowlerScore.bowler.id}`}
                              className="text-primary underline-offset-4 hover:underline"
                            >
                              {bowlerScore.bowler.canonical_name}
                            </Link>
                          </TableCell>
                          {Array.from({ length: maxGames }, (_, i) => i + 1).map((gameNum) => {
                            const game = bowlerScore.games.find((g) => g.game_number === gameNum)
                            return (
                              <TableCell key={gameNum} className="text-center">
                                {game ? (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            handleScoreClick(game.id, bowlerScore.bowler.id, gameNum)
                                          }}
                                          className="inline-flex items-center justify-center gap-1.5 w-full cursor-pointer hover:opacity-70 transition-opacity"
                                        >
                                          <span className="font-medium">{game.total_score ?? '—'}</span>
                                    {game.is_partial && (
                                            <TooltipProvider>
                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                  <p>Missing data</p>
                                                </TooltipContent>
                                              </Tooltip>
                                            </TooltipProvider>
                                          )}
                                        </button>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                            )
                          })}
                          <TableCell className="text-center font-semibold">
                            {bowlerScore.series_total}
                          </TableCell>
                          <TableCell className="text-center">
                            {bowlerScore.average_score}
                          </TableCell>
                        </TableRow>
                      ))}
                            {/* Team totals row */}
                            <TableRow className="bg-accent/40 font-semibold border-t-2">
                              <TableCell className="font-bold">Team Total</TableCell>
                              {teamTotals.map((total, i) => (
                                <TableCell key={i} className="text-center">
                                  {total}
                                </TableCell>
                              ))}
                              <TableCell className="text-center">
                                {teamGrandTotal}
                              </TableCell>
                              <TableCell className="text-center text-muted-foreground">—</TableCell>
                            </TableRow>
                    </TableBody>
                  </Table>
                </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ) : (
            /* Fallback: display without teams if no teams exist */
            <Card>
              <CardContent className="pt-6">
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Bowler</TableHead>
                        {Array.from({ length: maxGames }, (_, i) => i + 1).map((gameNum) => (
                          <TableHead key={gameNum} className="text-center">
                            Game {gameNum}
                          </TableHead>
                        ))}
                        <TableHead className="text-center">Series</TableHead>
                        <TableHead className="text-center">Average</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bowlerScores.map((bowlerScore, index) => (
                        <TableRow key={bowlerScore.bowler.id} className={index % 2 === 0 ? 'bg-muted/30' : ''}>
                          <TableCell className="font-medium bg-muted/50">
                            <Link
                              href={`/bowlers/${bowlerScore.bowler.id}`}
                              className="text-primary underline-offset-4 hover:underline"
                            >
                              {bowlerScore.bowler.canonical_name}
                            </Link>
                          </TableCell>
                          {Array.from({ length: maxGames }, (_, i) => i + 1).map((gameNum) => {
                            const game = bowlerScore.games.find((g) => g.game_number === gameNum)
                            return (
                              <TableCell key={gameNum} className="text-center">
                                {game ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleScoreClick(game.id, bowlerScore.bowler.id, gameNum)
                                    }}
                                    className="inline-flex items-center justify-center gap-1.5 w-full cursor-pointer hover:opacity-70 transition-opacity"
                                  >
                                    <span className="font-medium">{game.total_score ?? '—'}</span>
                                    {game.is_partial && (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>Missing data</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}
                                  </button>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                            )
                          })}
                          <TableCell className="text-center font-semibold">
                            {bowlerScore.series_total}
                          </TableCell>
                          <TableCell className="text-center">
                            {bowlerScore.average_score}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
            </CardContent>
          </Card>
          )}
        </section>

        {/* Game-by-Game Breakdown */}
        {bowlerScores.length > 0 && totalGames > 0 && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Game-by-Game Breakdown</h2>
            <Accordion type="multiple" className="w-full">
              {Array.from(uniqueGameNumbers).sort((a, b) => a - b).map((gameNum) => {
                const gameBowlers = bowlerScores
                  .map(bowler => ({
                    bowler: bowler.bowler,
                    game: bowler.games.find(g => g.game_number === gameNum)
                  }))
                  .filter(item => item.game)
                
                const gameHighScore = Math.max(...gameBowlers.map(b => b.game?.total_score || 0))
                
                return (
                  <AccordionItem key={gameNum} value={`game-${gameNum}`}>
                    <AccordionTrigger className="hover:no-underline" data-game-number={gameNum}>
                      <div className="flex items-center justify-between w-full pr-4">
                        <span className="font-semibold">Game {gameNum}</span>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{gameBowlers.length} bowlers</span>
                          <span className="text-foreground font-medium">High: {gameHighScore}</span>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      {(teams.length > 0 && teamViewEnabled) ? (
                        /* Group by teams if teams exist */
                        <div className="space-y-8">
                          {teams.map((team) => {
                            const teamBowlerIds = team.team_bowlers.map(tb => tb.bowler.id)
                            const teamGameBowlers = gameBowlers.filter(gb => teamBowlerIds.includes(gb.bowler.id))
                            
                            if (teamGameBowlers.length === 0) return null
                            
                            return (
                              <div key={team.id}>
                                <div className="flex items-center gap-2 mb-3 px-1">
                                  {editingTeamId === team.id ? (
                                    <>
                                      <Input
                                        value={editedTeamName}
                                        onChange={(e) => setEditedTeamName(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            handleSaveTeamName(team.id)
                                          } else if (e.key === 'Escape') {
                                            setEditingTeamId(null)
                                          }
                                        }}
                                        className="h-7 text-sm font-semibold"
                                        autoFocus
                                      />
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleSaveTeamName(team.id)}
                                        className="h-6 w-6 p-0"
                                      >
                                        <Check className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => setEditingTeamId(null)}
                                        className="h-6 w-6 p-0"
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </Button>
                                    </>
                                  ) : (
                                    <>
                                      <h3 className="text-sm font-semibold text-muted-foreground">{team.name}</h3>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleEditTeamName(team.id, team.name)}
                                        className="h-6 w-6 p-0"
                                      >
                                        <Pencil className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleGenerateTeamName(team.id)}
                                        disabled={generatingTeamName === team.id}
                                        className="h-6 w-6 p-0"
                                      >
                                        {generatingTeamName === team.id ? (
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                          <Sparkles className="h-3 w-3" />
                                        )}
                                      </Button>
                                    </>
                                  )}
                                </div>
                                <div className="overflow-x-auto">
                                  <div className="rounded-md border">
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead className="w-32">Bowler</TableHead>
                                          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((frameNum) => (
                                            <TableHead key={frameNum} className="text-center p-0 w-16 border-l">
                                              <div className="text-xs font-normal">{frameNum}</div>
                                            </TableHead>
                                          ))}
                                          <TableHead className="text-center p-0 w-20 border-l">
                                            <div className="text-xs font-normal">10</div>
                                          </TableHead>
                                          <TableHead className="text-center w-16 border-l">Total</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {teamGameBowlers.map(({ bowler, game }) => {
                                          if (!game) return null
                                          
                                          const frameData = Array.from({ length: 10 }, (_, i) => {
                                            return game.frames?.find(f => f.frame_number === i + 1) || null
                                          })
                                          
                                          const rowKey = `${game.id}-${bowler.id}`
                                          const isHighlighted = highlightedGame?.gameId === game.id && highlightedGame?.bowlerId === bowler.id
                                          
                                          return (
                                            <TableRow 
                                              key={bowler.id}
                                              ref={(el) => { gameRowRefs.current[rowKey] = el }}
                                              className={`transition-all duration-300 ${
                                                isHighlighted 
                                                  ? isFlashing 
                                                    ? 'bg-accent/80 border-l-4 border-accent-foreground/40' 
                                                    : 'bg-accent/50 hover:bg-accent/60 border-l-4 border-accent-foreground/30' 
                                                  : ''
                                              }`}
                                            >
                                              <TableCell className="font-medium">
                                                <Link
                                                  href={`/bowlers/${bowler.id}`}
                                                  className="text-primary hover:underline"
                                                >
                                                  {bowler.canonical_name}
                                                </Link>
                                              </TableCell>
                                              {frameData.slice(0, 9).map((frame, idx) => {
                                                const cumulativeScore = frameData.slice(0, idx + 1).reduce((sum, f) => {
                                                  if (!f) return sum
                                                  return sum + (f.roll_1 || 0) + (f.roll_2 || 0)
                                                }, 0)
                                                
                                                const isSpare = frame && frame.notation === '/'
                                                const calculatedSpare = frame && frame.roll_1 !== 10 && frame.roll_2 !== null && (frame.roll_1 || 0) + (frame.roll_2 || 0) === 10
                                                
                                                return (
                                                  <TableCell key={idx} className="p-0 border-l">
                                                    <div className="flex flex-col h-full">
                                                      <div className="flex h-8 border-b bg-muted/40">
                                                        <div className="flex-1 flex items-center justify-center text-sm border-r">
                                                          {frame ? (
                                                            frame.notation === 'X' ? (
                                                              <Cross1Icon className="h-4 w-4" />
                                                            ) : frame.roll_1 === 0 ? (
                                                              '-'
                                                            ) : (
                                                              frame.roll_1
                                                            )
                                                          ) : (
                                                            ''
                                                          )}
                                                        </div>
                                                        
                                                        <div className="flex-1 flex items-center justify-center text-sm">
                                                          {frame && frame.notation !== 'X' ? (
                                                            isSpare || calculatedSpare ? (
                                                              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                                <path d="M4.10876 14L9.46582 1H10.8178L5.46074 14H4.10876Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
                                                              </svg>
                                                            ) : frame.roll_2 === 0 ? (
                                                              '-'
                                                            ) : frame.roll_2 === null ? (
                                                              ''
                                                            ) : (
                                                              frame.roll_2
                                                            )
                                                          ) : (
                                                            ''
                                                          )}
                                                        </div>
                                                      </div>
                                                      <div className="flex items-center justify-center h-8 text-sm font-bold">
                                                        {frame ? cumulativeScore : ''}
                                                      </div>
                                                    </div>
                                                  </TableCell>
                                                )
                                              })}
                                              {/* 10th Frame */}
                                              <TableCell className="p-0 border-l">
                                                <div className="flex flex-col h-full">
                                                  <div className="flex h-8 border-b bg-muted/40">
                                                    <div className="flex-1 flex items-center justify-center text-sm border-r">
                                                      {frameData[9] ? (
                                                        frameData[9].roll_1 === 10 ? (
                                                          <Cross1Icon className="h-4 w-4" />
                                                        ) : frameData[9].roll_1 === 0 ? (
                                                          '-'
                                                        ) : (
                                                          frameData[9].roll_1
                                                        )
                                                      ) : (
                                                        ''
                                                      )}
                                                    </div>
                                                    <div className="flex-1 flex items-center justify-center text-sm border-r">
                                                      {frameData[9] && frameData[9].roll_2 !== null ? (
                                                        frameData[9].roll_2 === 10 ? (
                                                          <Cross1Icon className="h-4 w-4" />
                                                        ) : frameData[9].roll_1 !== 10 && (frameData[9].roll_1 || 0) + (frameData[9].roll_2 || 0) === 10 ? (
                                                          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                            <path d="M4.10876 14L9.46582 1H10.8178L5.46074 14H4.10876Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
                                                          </svg>
                                                        ) : frameData[9].roll_2 === 0 ? (
                                                          '-'
                                                        ) : (
                                                          frameData[9].roll_2
                                                        )
                                                      ) : (
                                                        ''
                                                      )}
                                                    </div>
                                                    <div className="flex-1 flex items-center justify-center text-sm">
                                                      {frameData[9] && frameData[9].roll_3 !== null ? (
                                                        frameData[9].roll_3 === 10 ? (
                                                          <Cross1Icon className="h-4 w-4" />
                                                        ) : frameData[9].roll_3 === 0 ? (
                                                          '-'
                                                        ) : (
                                                          frameData[9].roll_3
                                                        )
                                                      ) : (
                                                        ''
                                                      )}
                                                    </div>
                                                  </div>
                                                  <div className="flex items-center justify-center h-8 text-sm font-bold">
                                                    {game.total_score || ''}
                                                  </div>
                                                </div>
                                              </TableCell>
                                              <TableCell className="text-center font-bold border-l">
                                                {game.total_score || '—'}
                                              </TableCell>
                                            </TableRow>
                                          )
                                        })}
                                      </TableBody>
                                    </Table>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        /* Fallback: no team grouping */
                      <div className="overflow-x-auto">
                        <div className="rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-32">Bowler</TableHead>
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((frameNum) => (
                                  <TableHead key={frameNum} className="text-center p-0 w-16 border-l">
                                    <div className="text-xs font-normal">{frameNum}</div>
                                  </TableHead>
                                ))}
                                <TableHead className="text-center p-0 w-20 border-l">
                                  <div className="text-xs font-normal">10</div>
                                </TableHead>
                                <TableHead className="text-center w-16 border-l">Total</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {gameBowlers.map(({ bowler, game }) => {
                                if (!game) return null
                                
                                // Create array of 10 frames, filling missing ones with nulls
                                const frameData = Array.from({ length: 10 }, (_, i) => {
                                  return game.frames?.find(f => f.frame_number === i + 1) || null
                                })
                                
                                const rowKey = `${game.id}-${bowler.id}`
                                const isHighlighted = highlightedGame?.gameId === game.id && highlightedGame?.bowlerId === bowler.id
                                
                                return (
                                  <TableRow 
                                    key={bowler.id}
                                    ref={(el) => { gameRowRefs.current[rowKey] = el }}
                                    className={`transition-all duration-300 ${
                                      isHighlighted 
                                        ? isFlashing 
                                          ? 'bg-accent/80 border-l-4 border-accent-foreground/40' 
                                          : 'bg-accent/50 hover:bg-accent/60 border-l-4 border-accent-foreground/30' 
                                        : ''
                                    }`}
                                  >
                                    <TableCell className="font-medium">
                                      <Link
                                        href={`/bowlers/${bowler.id}`}
                                        className="text-primary hover:underline"
                                      >
                                        {bowler.canonical_name}
                                      </Link>
                                    </TableCell>
                                    {frameData.slice(0, 9).map((frame, idx) => {
                                      // Calculate cumulative score up to this frame
                                      const cumulativeScore = frameData.slice(0, idx + 1).reduce((sum, f) => {
                                        if (!f) return sum
                                        return sum + (f.roll_1 || 0) + (f.roll_2 || 0)
                                      }, 0)
                                      
                                      // Check if this frame is a spare
                                      const isSpare = frame && frame.notation === '/'
                                      
                                      // Also calculate spare from rolls if notation not set
                                      const calculatedSpare = frame && frame.roll_1 !== 10 && frame.roll_2 !== null && (frame.roll_1 || 0) + (frame.roll_2 || 0) === 10
                                      
                                      return (
                                        <TableCell key={idx} className="p-0 border-l">
                                          <div className="flex flex-col h-full">
                                            <div className="flex h-8 border-b bg-muted/40">
                                              <div className="flex-1 flex items-center justify-center text-sm border-r">
                                                {frame ? (
                                                  frame.notation === 'X' ? (
                                                    <Cross1Icon className="h-4 w-4" />
                                                  ) : frame.roll_1 === 0 ? (
                                                    '-'
                                                  ) : (
                                                    frame.roll_1
                                                  )
                                                ) : (
                                                  ''
                                                )}
                                              </div>
                                              <div className="flex-1 flex items-center justify-center text-sm">
                                                {frame && frame.notation !== 'X' ? (
                                                  isSpare || calculatedSpare ? (
                                                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                      <path d="M4.10876 14L9.46582 1H10.8178L5.46074 14H4.10876Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
                                                    </svg>
                                                  ) : frame.roll_2 === 0 ? (
                                                    '-'
                                                  ) : frame.roll_2 === null ? (
                                                    ''
                                                  ) : (
                                                    frame.roll_2
                                                  )
                                                ) : (
                                                  ''
                                                )}
                                              </div>
                                            </div>
                                            <div className="flex items-center justify-center h-8 text-sm font-bold">
                                              {frame ? cumulativeScore : ''}
                                            </div>
                                          </div>
                                        </TableCell>
                                      )
                                    })}
                                    {/* 10th Frame */}
                                    <TableCell className="p-0 border-l">
                                      <div className="flex flex-col h-full">
                                        <div className="flex h-8 border-b bg-muted/40">
                                          <div className="flex-1 flex items-center justify-center text-sm border-r">
                                            {frameData[9] ? (
                                              frameData[9].roll_1 === 10 ? (
                                                <Cross1Icon className="h-4 w-4" />
                                              ) : frameData[9].roll_1 === 0 ? (
                                                '-'
                                              ) : (
                                                frameData[9].roll_1
                                              )
                                            ) : (
                                              ''
                                            )}
                                          </div>
                                          <div className="flex-1 flex items-center justify-center text-sm border-r">
                                            {frameData[9] && frameData[9].roll_2 !== null ? (
                                              frameData[9].roll_2 === 10 ? (
                                                <Cross1Icon className="h-4 w-4" />
                                              ) : frameData[9].roll_1 !== 10 && (frameData[9].roll_1 || 0) + (frameData[9].roll_2 || 0) === 10 ? (
                                                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                  <path d="M4.10876 14L9.46582 1H10.8178L5.46074 14H4.10876Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
                                                </svg>
                                              ) : frameData[9].roll_2 === 0 ? (
                                                '-'
                                              ) : (
                                                frameData[9].roll_2
                                              )
                                            ) : (
                                              ''
                                            )}
                                          </div>
                                          <div className="flex-1 flex items-center justify-center text-sm">
                                            {frameData[9] && frameData[9].roll_3 !== null ? (
                                              frameData[9].roll_3 === 10 ? (
                                                <Cross1Icon className="h-4 w-4" />
                                              ) : frameData[9].roll_3 === 0 ? (
                                                '-'
                                              ) : (
                                                frameData[9].roll_3
                                              )
                                            ) : (
                                              ''
                                            )}
                                          </div>
                                        </div>
                                        <div className="flex items-center justify-center h-8 text-sm font-bold">
                                          {game.total_score || ''}
                                        </div>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-center font-bold border-l">
                                      {game.total_score || '—'}
                                    </TableCell>
                                  </TableRow>
                                )
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                )
              })}
            </Accordion>
          </section>
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

      {/* Image Gallery Dialog */}
      <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
        <DialogContent className="max-w-4xl h-[90vh] p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>
              Session Images ({currentImageIndex + 1} of {uploads.length})
            </DialogTitle>
            <DialogDescription>
              {uploads[currentImageIndex]?.original_filename}
            </DialogDescription>
          </DialogHeader>
          <div 
            className="relative flex-1 flex items-center justify-center bg-muted/50 overflow-hidden px-6 pb-6"
            onTouchStart={(e) => {
              const touch = e.touches[0]
              const startX = touch.clientX
              
              const handleTouchEnd = (endEvent: TouchEvent) => {
                const endX = endEvent.changedTouches[0].clientX
                const diff = startX - endX
                
                if (Math.abs(diff) > 50) {
                  if (diff > 0) {
                    handleNextImage()
                  } else {
                    handlePreviousImage()
                  }
                }
                
                document.removeEventListener('touchend', handleTouchEnd)
              }
              
              document.addEventListener('touchend', handleTouchEnd)
            }}
          >
            {/* Previous Button */}
            {uploads.length > 1 && (
              <Button
                size="icon"
                variant="outline"
                className="absolute left-4 top-1/2 -translate-y-1/2 z-10 h-12 w-12 rounded-full bg-background/80 backdrop-blur-sm"
                onClick={handlePreviousImage}
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
            )}

            {/* Image */}
            {uploads[currentImageIndex] && (
              <img
                src={`/api/uploads/${uploads[currentImageIndex].id}/image`}
                alt={uploads[currentImageIndex].original_filename}
                className="max-h-[calc(90vh-200px)] max-w-full object-contain rounded-lg"
              />
            )}

            {/* Next Button */}
            {uploads.length > 1 && (
              <Button
                size="icon"
                variant="outline"
                className="absolute right-4 top-1/2 -translate-y-1/2 z-10 h-12 w-12 rounded-full bg-background/80 backdrop-blur-sm"
                onClick={handleNextImage}
              >
                <ChevronRight className="h-6 w-6" />
              </Button>
            )}
          </div>
          <DialogFooter className="p-6 pt-0">
            <div className="flex items-center justify-between w-full">
              <div className="text-sm text-muted-foreground">
                Use arrow keys or swipe to navigate
              </div>
              <Button variant="outline" onClick={handleCloseGallery}>
                Close
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
