'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { NameResolutionModal } from '@/components/NameResolutionModal'
import { toast } from 'sonner'
import { Sparkles, Trash2 } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'

export const dynamic = 'force-dynamic'

interface Upload {
  id: string
  storage_path: string
  original_filename: string
  parsed: boolean
  parsing_error: string | null
  raw_vision_json: any
  exif_datetime: string | null
  exif_location_lat: number | null
  exif_location_lng: number | null
  identified_bowling_alley_id: string | null
  identified_bowling_alley_name: string | null
  created_at: string
  session_id: string | null
  bowling_alley?: {
    name: string
    address: string
    city: string
    state: string
  } | null
}

interface Session {
  id: string
  date_time: string
  location: string | null
  bowling_alley_name: string | null
  lane: number | null
  created_at: string
}

interface BowlerScore {
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

export default function DebugUploadPage() {
  const { user } = useAuth()
  const [uploads, setUploads] = useState<Upload[]>([])
  const [selectedUpload, setSelectedUpload] = useState<Upload | null>(null)
  const [processingUploads, setProcessingUploads] = useState<Set<string>>(new Set())
  const [processing, setProcessing] = useState(false) // For admin operations like cleanup
  const [loading, setLoading] = useState(true)
  const [showNameResolution, setShowNameResolution] = useState(false)
  const [currentResolutionData, setCurrentResolutionData] = useState<any>(null)
  const [databaseSession, setDatabaseSession] = useState<Session | null>(null)
  const [databaseScores, setDatabaseScores] = useState<BowlerScore[]>([])
  const [loadingDatabase, setLoadingDatabase] = useState(false)
  const [sessions, setSessions] = useState<Session[]>([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [databaseStats, setDatabaseStats] = useState<any>(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const [allBowlers, setAllBowlers] = useState<any[]>([])
  const [loadingBowlers, setLoadingBowlers] = useState(false)
  const [deletingUpload, setDeletingUpload] = useState<string | null>(null)

  const [isAdmin, setIsAdmin] = useState(false)
  const [forceAdmin, setForceAdmin] = useState(false)

  // Check admin status
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (user?.id) {
        try {
          // Get user profile from database to check email
          const { data: profile, error } = await supabase.auth.getUser()
          const email = profile?.user?.email || user.email
          console.log('🔐 Admin check - user email:', email)
          const adminStatus = email === 'r@wu.ly'
          console.log('🔐 Admin check - is admin:', adminStatus)
          setIsAdmin(adminStatus)
        } catch (error) {
          console.error('Error checking admin status:', error)
          setIsAdmin(false)
        }
      } else {
        setIsAdmin(false)
      }
    }

    checkAdminStatus()
  }, [user]) // Only run when user changes

  const effectiveIsAdmin = isAdmin || forceAdmin

  useEffect(() => {
    fetchUploads()
  }, [])

  const fetchUploads = async () => {
    try {
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.error('No session found')
        setLoading(false)
        return
      }

      const response = await fetch('/api/uploads', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setUploads(data.uploads || [])
      } else {
        toast.error('Failed to fetch uploads')
      }
    } catch (error) {
      console.error('Error fetching uploads:', error)
      toast.error('Error fetching uploads')
    } finally {
      setLoading(false)
    }
  }

  const identifyLocation = async (uploadId: string) => {
    console.log('📍 Frontend: Starting location identification for:', uploadId)
    setProcessingUploads(prev => new Set(prev).add(uploadId))
    try {
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        console.error('❌ Frontend: No session found')
        toast.error('No session found')
        return
      }

      const response = await fetch(`/api/uploads/${uploadId}/identify-location`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (response.ok) {
        const result = await response.json()
        console.log('📍 Location identification result:', result)
        
        if (result.bowlingAlley) {
          const alley = result.bowlingAlley
          const details = []
          if (alley.distanceMiles) details.push(`${alley.distanceMiles.toFixed(2)} mi away`)
          if (alley.confidence) details.push(`${Math.round(alley.confidence * 100)}% confidence`)
          
          const message = details.length > 0 
            ? `${alley.name} (${details.join(', ')})`
            : alley.name
          
          toast.success(`Location identified: ${message}`, { duration: 5000 })
          
          // Show additional info in console
          if (alley.address) console.log('📍 Address:', alley.address, alley.city, alley.state)
          if (alley.phone) console.log('📞 Phone:', alley.phone)
          if (alley.website) console.log('🌐 Website:', alley.website)
          if (alley.placeId) console.log('🆔 Google Place ID:', alley.placeId)
        } else {
          const coords = result.coordinates
          const coordsStr = coords ? ` (${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)})` : ''
          toast.warning(
            result.message || 'Could not identify bowling alley at this location' + coordsStr,
            { duration: 6000 }
          )
          console.log('⚠️ No bowling alley found at coordinates:', coords)
          console.log('💡 Tip: Try searching these coordinates in Google Maps to verify if there is a bowling alley nearby')
        }
        
        fetchUploads() // Refresh the list
      } else {
        const error = await response.json()
        console.error('❌ API error:', error)
        toast.error(error.error || 'Location identification failed')
      }
    } catch (error) {
      console.error('Error identifying location:', error)
      toast.error('Error identifying location')
    } finally {
      setProcessingUploads(prev => {
        const next = new Set(prev)
        next.delete(uploadId)
        return next
      })
    }
  }

  const processUpload = async (uploadId: string) => {
    console.log('🎯 Frontend: Starting process upload for:', uploadId)
    setProcessingUploads(prev => new Set(prev).add(uploadId))
    try {
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        console.error('❌ Frontend: No session found')
        toast.error('No session found')
        return
      }

      console.log('🎯 Frontend: Got session token, making API call')
      const response = await fetch(`/api/uploads/${uploadId}/process`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      console.log('🎯 Frontend: API response status:', response.status)

      if (response.ok) {
        const result = await response.json()
        console.log('🎯 Frontend: API result:', result)
        console.log('🎯 Frontend: needsNameResolution?', result.needsNameResolution)

        if (result.needsNameResolution) {
          // Modal will show automatically
          setCurrentResolutionData({
            uploadId,
            parsedData: result.parsedData,
            unresolvedNames: result.unresolvedNames,
            resolvedMappings: result.resolvedMappings
          })
          setShowNameResolution(true)
          setSelectedUpload(prev => prev?.id === uploadId ? {
            ...prev!,
            parsed: true,
            raw_vision_json: result.rawResponse
          } : prev)
        } else {
          toast.success('Processing completed')
          fetchUploads() // Refresh the list

          if (result.success) {
            setSelectedUpload(prev => prev?.id === uploadId ? { ...prev!, parsed: true, raw_vision_json: result.rawResponse } : prev)
          }
        }
      } else {
        const error = await response.json()
        toast.error(error.error || 'Processing failed')
      }
    } catch (error) {
      console.error('Error processing upload:', error)
      toast.error('Error processing upload')
    } finally {
      setProcessingUploads(prev => {
        const next = new Set(prev)
        next.delete(uploadId)
        return next
      })
    }
  }

  const handleNameResolution = async (action: 'create' | 'alias', bowlerId?: string, alias?: string) => {
    if (!currentResolutionData) return

    try {
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.error('No session found')
        return
      }

      const response = await fetch(`/api/bowlers/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          action,
          parsed_name: currentResolutionData.unresolvedNames[0]?.parsedName,
          bowler_id: bowlerId,
          alias
        })
      })

      if (response.ok) {
        const result = await response.json()

        if (action === 'create' && result.bowler_id) {
          // Add to resolved mappings
          currentResolutionData.resolvedMappings[currentResolutionData.unresolvedNames[0].parsedName] = result.bowler_id
        } else if (action === 'alias' && bowlerId) {
          // Add to resolved mappings
          currentResolutionData.resolvedMappings[currentResolutionData.unresolvedNames[0].parsedName] = bowlerId
        }

        // Remove the resolved name from unresolved list
        currentResolutionData.unresolvedNames.shift()

        // If more names to resolve, show next one
        if (currentResolutionData.unresolvedNames.length > 0) {
          setCurrentResolutionData({ ...currentResolutionData })
          toast.success('Name resolved, resolving next name...')
        } else {
          // All names resolved, complete the processing
          await completeProcessing()
        }
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to resolve name')
      }
    } catch (error) {
      console.error('Name resolution error:', error)
      toast.error('Error resolving name')
    }
  }

  const completeProcessing = async () => {
    try {
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.error('No session found')
        return
      }

      const response = await fetch(`/api/uploads/${currentResolutionData.uploadId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          resolvedMappings: currentResolutionData.resolvedMappings,
          parsedData: currentResolutionData.parsedData
        })
      })

      if (response.ok) {
        const result = await response.json()
        toast.success('Processing completed with resolved names!')
        setShowNameResolution(false)
        setCurrentResolutionData(null)
        fetchUploads() // Refresh the list
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to complete processing')
      }
    } catch (error) {
      console.error('Complete processing error:', error)
      toast.error('Error completing processing')
    }
  }

  const deleteUpload = async (uploadId: string) => {
    if (!confirm('Are you sure you want to delete this upload? The image file will be deleted, but associated game data will remain.')) {
      return
    }

    setDeletingUpload(uploadId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.error('No session found')
        return
      }

      const response = await fetch(`/api/uploads/${uploadId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (response.ok) {
        toast.success('Upload deleted successfully')
        fetchUploads() // Refresh the list
        if (selectedUpload?.id === uploadId) {
          setSelectedUpload(null)
        }
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to delete upload')
      }
    } catch (error) {
      console.error('Delete upload error:', error)
      toast.error('Error deleting upload')
    } finally {
      setDeletingUpload(null)
    }
  }

  const fetchDatabaseStats = async () => {
    setLoadingStats(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.error('No session found')
        return
      }

      const response = await fetch('/api/debug/database', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setDatabaseStats(data)
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to fetch database stats')
      }
    } catch (error) {
      console.error('Error fetching database stats:', error)
      toast.error('Error fetching database stats')
    } finally {
      setLoadingStats(false)
    }
  }

  const fetchAllBowlers = async () => {
    setLoadingBowlers(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.error('No session found')
        return
      }

      const response = await fetch('/api/bowlers', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setAllBowlers(data.bowlers || [])
      } else {
        toast.error('Failed to fetch bowlers')
      }
    } catch (error) {
      console.error('Error fetching bowlers:', error)
      toast.error('Error fetching bowlers')
    } finally {
      setLoadingBowlers(false)
    }
  }

  const fetchDatabaseData = async (sessionId: string) => {
    setLoadingDatabase(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.error('No session found')
        return
      }

      // Get session info
      const sessionResponse = await fetch(`/api/sessions/${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (sessionResponse.ok) {
        const sessionData = await sessionResponse.json()
        setDatabaseSession(sessionData.session)
        setDatabaseScores(sessionData.scores || [])
      } else {
        toast.error('Failed to fetch session data')
      }
    } catch (error) {
      console.error('Error fetching database data:', error)
      toast.error('Error fetching database data')
    } finally {
      setLoadingDatabase(false)
    }
  }

  const fetchAllSessions = async () => {
    setLoadingSessions(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.error('No session found')
        return
      }

      const response = await fetch('/api/sessions', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setSessions(data.sessions || [])
      } else {
        toast.error('Failed to fetch sessions')
      }
    } catch (error) {
      console.error('Error fetching sessions:', error)
      toast.error('Error fetching sessions')
    } finally {
      setLoadingSessions(false)
    }
  }

  const deleteSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this session? This will permanently remove all associated data.')) {
      return
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.error('No session found')
        return
      }

      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (response.ok) {
        toast.success('Session deleted successfully')
        fetchAllSessions() // Refresh the sessions list
        if (databaseSession?.id === sessionId) {
          setDatabaseSession(null)
          setDatabaseScores([])
        }
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to delete session')
      }
    } catch (error) {
      console.error('Error deleting session:', error)
      toast.error('Error deleting session')
    }
  }

  const purgeAllData = async () => {
    if (!confirm('⚠️ DANGER: This will delete ALL bowling data (sessions, bowlers, games, uploads) while keeping user accounts. This action cannot be undone. Are you sure?')) {
      return
    }

    if (!confirm('🔥 FINAL WARNING: All your bowling data will be permanently lost. Only user accounts will be preserved. Continue?')) {
      return
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.error('No session found')
        return
      }

      toast.loading('Purging all data...', { id: 'purge' })

      const response = await fetch('/api/admin/purge', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (response.ok) {
        toast.success('All data purged successfully!', { id: 'purge' })
        // Refresh all data
        fetchUploads()
        fetchAllSessions()
        setDatabaseSession(null)
        setDatabaseScores([])
        fetchDatabaseStats()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to purge data', { id: 'purge' })
      }
    } catch (error) {
      console.error('Error purging data:', error)
      toast.error('Error purging data', { id: 'purge' })
    }
  }

  const cleanupDatabase = async () => {
    if (!confirm('🧹 This will clean up duplicate records in the database while preserving all uploads. Continue?')) {
      return
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.error('No session found')
        return
      }

      toast.loading('Cleaning up database duplicates...', { id: 'cleanup' })

      const response = await fetch('/api/admin/cleanup', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (response.ok) {
        const result = await response.json()
        toast.success(result.message, { id: 'cleanup' })
        console.log('Cleanup result:', result)

        // Refresh all data
        fetchUploads()
        fetchAllSessions()
        fetchDatabaseStats()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to cleanup database', { id: 'cleanup' })
      }
    } catch (error) {
      console.error('Error cleaning up database:', error)
      toast.error('Error cleaning up database', { id: 'cleanup' })
    }
  }

  const addToDatabase = async (uploadId: string) => {
    console.log('💾 Adding existing parsed data to database for upload:', uploadId)
    setProcessingUploads(prev => new Set(prev).add(uploadId))
    try {
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.error('No session found')
        return
      }

      const response = await fetch(`/api/uploads/${uploadId}/add-to-db`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (response.ok) {
        const result = await response.json()
        toast.success('Data added to database successfully')

        if (result.success) {
          // Refresh the uploads list to show updated status
          fetchUploads()
          fetchAllSessions()
          fetchDatabaseStats()
        }
      } else {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }))

        // Log debug info to browser console
        if (error.debugInfo) {
          console.log('🔍 Debug info for stored vision JSON:')
          console.log('📄 Raw vision JSON type:', error.debugInfo.rawVisionType)
          console.log('📄 Raw vision JSON preview:', error.debugInfo.rawVisionPreview)
          console.log('📄 Data location:', error.debugInfo.dataLocation)
          console.log('📄 Parsed vision JSON keys:', error.debugInfo.parsedKeys)
          console.log('📄 Bowlers count:', error.debugInfo.bowlersCount)
          console.log('📄 Parsed data keys:', error.debugInfo.parsedDataKeys)
          if (error.debugInfo.parseError) {
            console.log('❌ Parse error:', error.debugInfo.parseError)
          }
        }

        toast.error(error.error || 'Failed to add data to database')
      }
    } catch (error) {
      console.error('Error adding to database:', error)
      toast.error('Error adding to database')
    } finally {
      setProcessingUploads(prev => {
        const next = new Set(prev)
        next.delete(uploadId)
        return next
      })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <>
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="mb-8">
              <div className="md:flex md:items-center md:justify-between">
                <div className="flex-1 min-w-0">
                  <h1 className="text-3xl font-bold text-foreground">Upload Debug</h1>
                  <p className="mt-2 text-muted-foreground">
                    Test and debug bowling scoreboard image processing
                  </p>
                </div>
                {effectiveIsAdmin && (
                  <div className="mt-4 md:mt-0">
                    <Button
                      onClick={fetchAllSessions}
                      disabled={loadingSessions}
                      variant="secondary"
                      className="mr-2"
                    >
                      {loadingSessions ? 'Loading...' : 'Load All Sessions'}
                    </Button>
                    <Button
                      onClick={fetchDatabaseStats}
                      disabled={loadingStats}
                      variant="secondary"
                      className="mr-2"
                    >
                      {loadingStats ? 'Loading...' : 'DB Stats'}
                    </Button>
                    <Button
                      onClick={fetchAllBowlers}
                      disabled={loadingBowlers}
                      variant="secondary"
                      className="mr-2"
                    >
                      {loadingBowlers ? 'Loading...' : 'All Bowlers'}
                    </Button>
                    <Button
                      onClick={cleanupDatabase}
                      disabled={processing}
                      variant="destructive"
                      className="mr-2"
                    >
                      🧹 Cleanup Duplicates
                    </Button>
                    <Button
                      onClick={purgeAllData}
                      variant="destructive"
                      className="mr-2"
                    >
                      🔥 Purge All Data
                    </Button>
                  </div>
                )}
                {!effectiveIsAdmin && (
                  <div className="mt-4 md:mt-0">
                    <Button
                      onClick={() => setForceAdmin(true)}
                      variant="secondary"
                      size="sm"
                    >
                      Enable Admin Mode (Debug)
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Uploads List */}
              <div className="bg-card shadow rounded-lg border">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg font-medium text-card-foreground mb-4">Your Uploads</h3>

                  {uploads.length === 0 ? (
                    <p className="text-muted-foreground">No uploads yet. Upload a bowling scoreboard image first.</p>
                  ) : (
                    <div className="space-y-4">
                      {uploads.map((upload) => (
                        <div
                          key={upload.id}
                          className={`border rounded-lg p-4 cursor-pointer transition-colors relative ${
                            selectedUpload?.id === upload.id ? 'border-primary bg-primary/10' : 'border-border hover:bg-accent'
                          }`}
                          onClick={() => setSelectedUpload(upload)}
                        >
                          {processingUploads.has(upload.id) && (
                            <div className="absolute inset-0 bg-background/60 backdrop-blur-[1px] rounded-lg flex items-center justify-center z-10">
                              <Spinner className="size-8" />
                            </div>
                          )}
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h4 className="font-medium text-foreground truncate">
                                {upload.original_filename}
                              </h4>
                              <p className="text-sm text-muted-foreground">
                                {new Date(upload.created_at).toLocaleString()}
                              </p>
                              {upload.exif_datetime && (
                                <p className="text-sm text-muted-foreground">
                                  EXIF: {new Date(upload.exif_datetime).toLocaleString()}
                                </p>
                              )}
                              {(upload.exif_location_lat && upload.exif_location_lng) && (
                                <p className="text-sm text-muted-foreground">
                                  GPS: {upload.exif_location_lat.toFixed(6)}, {upload.exif_location_lng.toFixed(6)}
                                </p>
                              )}
                              {(!upload.exif_location_lat || !upload.exif_location_lng) && (
                                <p className="text-sm text-destructive">
                                  ⚠️ No GPS data in image
                                </p>
                              )}
                              {upload.identified_bowling_alley_name && (
                                <p className="text-sm text-primary font-medium">
                                  📍 {upload.identified_bowling_alley_name}
                                </p>
                              )}
                              {upload.bowling_alley && (
                                <p className="text-xs text-muted-foreground">
                                  {upload.bowling_alley.city}, {upload.bowling_alley.state}
                                </p>
                              )}
                            </div>
                            <div className="ml-4">
                              {upload.parsed ? (
                                <Badge variant="default">Processed</Badge>
                              ) : upload.parsing_error ? (
                                <Badge variant="destructive">Error</Badge>
                              ) : (
                                <Badge variant="secondary">Pending</Badge>
                              )}
                            </div>
                          </div>

                          <div className="mt-4 flex justify-between items-center">
                            <div className="space-x-2">
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  deleteUpload(upload.id)
                                }}
                                disabled={deletingUpload === upload.id || processingUploads.has(upload.id)}
                                variant="ghost"
                                size="icon"
                                aria-label="Delete upload"
                              >
                                <Trash2 className="text-destructive" />
                              </Button>
                            </div>
                            <div className="space-x-2">
                              {/* Show Identify Location if GPS available */}
                              {(upload.exif_location_lat && upload.exif_location_lng) && (
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    identifyLocation(upload.id)
                                  }}
                                  disabled={processingUploads.has(upload.id)}
                                  variant="outline"
                                  size="sm"
                                >
                                  Identify Location
                                </Button>
                              )}
                              
                              {!upload.parsed && (
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    processUpload(upload.id)
                                  }}
                                  disabled={processingUploads.has(upload.id)}
                                  size="sm"
                                >
                                  <Sparkles />
                                  Process with AI
                                </Button>
                              )}
                              
                              {upload.parsed && (
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    processUpload(upload.id)
                                  }}
                                  disabled={processingUploads.has(upload.id)}
                                  variant="secondary"
                                  size="sm"
                                >
                                  Re-analyze
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Debug Details */}
              <div className="bg-card shadow rounded-lg border">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg font-medium text-card-foreground mb-4">Debug Details</h3>

                  {selectedUpload ? (
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium text-card-foreground">Upload Info</h4>
                        <dl className="mt-2 space-y-1">
                          <div>
                            <dt className="text-sm text-muted-foreground inline">ID:</dt>
                            <dd className="text-sm text-card-foreground inline ml-2">{selectedUpload.id}</dd>
                          </div>
                          <div>
                            <dt className="text-sm text-muted-foreground inline">File:</dt>
                            <dd className="text-sm text-card-foreground inline ml-2">{selectedUpload.original_filename}</dd>
                          </div>
                          <div className="flex items-center gap-2">
                            <dt className="text-sm text-muted-foreground">Status:</dt>
                            <dd>
                              {selectedUpload.parsed ? (
                                <Badge variant="default">Processed</Badge>
                              ) : selectedUpload.parsing_error ? (
                                <Badge variant="destructive">Error</Badge>
                              ) : (
                                <Badge variant="secondary">Pending</Badge>
                              )}
                            </dd>
                          </div>
                        </dl>
                      </div>

                      {selectedUpload.parsing_error && (
                        <div className="border border-destructive rounded p-4">
                          <h4 className="font-medium text-destructive">Error</h4>
                          <p className="text-sm text-destructive/80 mt-1">{selectedUpload.parsing_error}</p>
                        </div>
                      )}

                      {selectedUpload.raw_vision_json && (
                        <div>
                          <h4 className="font-medium text-card-foreground mb-2">Raw OpenAI Response</h4>
                          <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-96">
                            {typeof selectedUpload.raw_vision_json === 'string'
                              ? selectedUpload.raw_vision_json
                              : JSON.stringify(selectedUpload.raw_vision_json, null, 2)
                            }
                          </pre>
                        </div>
                      )}

                      {selectedUpload.session_id && (
                        <div className="mt-4">
                          <Button
                            onClick={() => fetchDatabaseData(selectedUpload.session_id!)}
                            disabled={loadingDatabase}
                            variant="secondary"
                          >
                            {loadingDatabase ? 'Loading...' : 'View Database Record'}
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">Select an upload to view debug details</p>
                  )}
                </div>
              </div>
            </div>

            {/* Admin Sessions Section */}
            {effectiveIsAdmin && sessions.length > 0 && (
              <div className="mt-8">
                <div className="bg-card shadow rounded-lg border">
                  <div className="px-4 py-5 sm:p-6">
                    <h3 className="text-lg font-medium text-card-foreground mb-4">Admin: All Sessions</h3>
                    <div className="space-y-4">
                      {sessions.map((session) => (
                        <div key={session.id} className="border border-border rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium text-card-foreground">
                                {session.bowling_alley_name || 'Bowling Session'}
                              </h4>
                              <p className="text-sm text-muted-foreground">
                                {new Date(session.date_time).toLocaleString()} • Lane {session.lane}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                ID: {session.id}
                              </p>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Button
                                onClick={() => fetchDatabaseData(session.id)}
                                variant="secondary"
                                size="sm"
                              >
                                View DB Data
                              </Button>
                              <Button
                                onClick={() => deleteSession(session.id)}
                                variant="destructive"
                                size="sm"
                              >
                                Delete
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Database Stats View */}
            {databaseStats && (
              <div className="mt-8">
                <div className="bg-card shadow rounded-lg border">
                  <div className="px-4 py-5 sm:p-6">
                    <h3 className="text-lg font-medium text-card-foreground mb-4">Database Statistics</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-primary">{databaseStats.statistics.sessions}</div>
                        <div className="text-sm text-muted-foreground">Sessions</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-primary">{databaseStats.statistics.bowlers}</div>
                        <div className="text-sm text-muted-foreground">Bowlers</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-primary">{databaseStats.statistics.series}</div>
                        <div className="text-sm text-muted-foreground">Series</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-primary">{databaseStats.statistics.games}</div>
                        <div className="text-sm text-muted-foreground">Games</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-primary">{databaseStats.statistics.frames}</div>
                        <div className="text-sm text-muted-foreground">Frames</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-primary">{databaseStats.statistics.uploads}</div>
                        <div className="text-sm text-muted-foreground">Uploads</div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-card-foreground mb-2">Recent Sessions</h4>
                      {databaseStats.recentSessions.length === 0 ? (
                        <p className="text-muted-foreground">No sessions found</p>
                      ) : (
                        <div className="space-y-2">
                          {databaseStats.recentSessions.map((session: any) => (
                            <div key={session.id} className="border border-border rounded p-3">
                              <div className="flex justify-between items-start">
                                <div>
                                  <h5 className="font-medium">{session.bowling_alley_name || 'Bowling Session'}</h5>
                                  <p className="text-sm text-muted-foreground">
                                    {new Date(session.date_time).toLocaleString()} • Lane {session.lane}
                                  </p>
                                  <p className="text-xs text-muted-foreground">ID: {session.id}</p>
                                </div>
                                <div className="text-right text-sm">
                                  <div>{session.series?.length || 0} bowlers</div>
                                  <div>{session.series?.reduce((sum: number, s: any) => sum + (s.games?.length || 0), 0) || 0} games</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* All Bowlers View */}
            {allBowlers.length > 0 && (
              <div className="mt-8">
                <div className="bg-card shadow rounded-lg border">
                  <div className="px-4 py-5 sm:p-6">
                    <h3 className="text-lg font-medium text-card-foreground mb-4">All Bowlers ({allBowlers.length})</h3>
                    <div className="space-y-2">
                      {allBowlers.map((bowler: any) => (
                        <div key={bowler.id} className="border border-border rounded p-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <h5 className="font-medium">{bowler.canonical_name}</h5>
                              <p className="text-sm text-muted-foreground">
                                Created: {new Date(bowler.created_at).toLocaleString()}
                              </p>
                              <p className="text-xs text-muted-foreground">ID: {bowler.id}</p>
                            </div>
                            {bowler.primary_user_id && (
                              <div className="text-sm text-primary">
                                Primary User
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Database Data View */}
            {(databaseSession || databaseScores.length > 0) && (
              <div className="mt-8">
                <div className="bg-card shadow rounded-lg border">
                  <div className="px-4 py-5 sm:p-6">
                    <h3 className="text-lg font-medium text-card-foreground mb-4">Database Record</h3>

                    {loadingDatabase ? (
                      <div className="text-center py-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                        <p className="mt-2 text-muted-foreground">Loading database data...</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {databaseSession && (
                          <div>
                            <h4 className="font-medium text-card-foreground mb-2">Session Info</h4>
                            <div className="bg-muted rounded p-4 text-sm">
                              <p><strong>ID:</strong> {databaseSession.id}</p>
                              <p><strong>Date/Time:</strong> {new Date(databaseSession.date_time).toLocaleString()}</p>
                              <p><strong>Location:</strong> {databaseSession.location || 'N/A'}</p>
                              <p><strong>Bowling Alley:</strong> {databaseSession.bowling_alley_name || 'N/A'}</p>
                              <p><strong>Lane:</strong> {databaseSession.lane || 'N/A'}</p>
                            </div>
                          </div>
                        )}

                        <div>
                          <h4 className="font-medium text-card-foreground mb-2">
                            Scores ({databaseScores.length} bowlers)
                          </h4>
                          {databaseScores.length === 0 ? (
                            <p className="text-muted-foreground">No scores found in database</p>
                          ) : (
                            <div className="space-y-4">
                              {databaseScores.map((score, index) => (
                                <div key={score.bowler.id} className="border border-border rounded p-4">
                                  <h5 className="font-medium text-card-foreground">
                                    {score.bowler.canonical_name}
                                  </h5>
                                  <p className="text-sm text-muted-foreground">
                                    Series Total: {score.series_total} • Average: {score.average_score}
                                  </p>
                                  <div className="mt-2 grid grid-cols-3 gap-2">
                                    {score.games.map((game) => (
                                      <div key={game.id} className="text-center">
                                        <div className="text-sm font-medium">
                                          Game {game.game_number}: {game.total_score || '—'}
                                        </div>
                                        {game.is_partial && (
                                          <div className="text-xs text-muted-foreground">Partial</div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Name Resolution Modal */}
      <NameResolutionModal
        isOpen={showNameResolution}
        onClose={() => {
          setShowNameResolution(false)
          setCurrentResolutionData(null)
        }}
        parsedName={currentResolutionData?.unresolvedNames[0]?.parsedName || ''}
        suggestions={currentResolutionData?.unresolvedNames[0]?.suggestions || []}
        onResolve={handleNameResolution}
        isLoading={processing}
      />
    </>
  )
}
