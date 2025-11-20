import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  console.log('📋 API /sessions called')

  try {
    // Get JWT token from cookies
    const cookieStore = cookies()
    let sessionToken = null
    const possibleCookieNames = [
      'sb-access-token',
      'supabase-auth-token',
      'sb-localhost-auth-token',
      'sb-127-0-0-1-auth-token'
    ]

    for (const cookieName of possibleCookieNames) {
      const cookieValue = cookieStore.get(cookieName)?.value
      if (cookieValue) {
        sessionToken = cookieValue
        break
      }
    }

    // If no cookies found, try Authorization header as fallback
    if (!sessionToken) {
      const authHeader = request.headers.get('authorization')
      if (authHeader?.startsWith('Bearer ')) {
        sessionToken = authHeader.substring(7)
      }
    }

    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Unauthorized - No session token found' },
        { status: 401 }
      )
    }

    // Create Supabase client with the session token
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${sessionToken}`
          }
        }
      }
    )

    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid session' },
        { status: 401 }
      )
    }

    // Get sessions in two ways:
    // 1. Sessions the user uploaded images for
    // 2. Sessions where bowlers claimed by the user appear

    const sessionIds = new Set<string>()

    // Method 1: Sessions from user's uploads
    const { data: uploads, error: uploadsError } = await supabase
      .from('uploads')
      .select('session_id')
      .eq('user_id', user.id)
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
      .eq('primary_user_id', user.id)

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

    // Fetch the actual session data with completion status
    let sessions = []
    if (sessionIds.size > 0) {
      const { data: sessionData, error: sessionsError } = await supabase
        .from('sessions')
        .select(`
          *,
          bowling_alleys (
            id,
            name,
            address,
            city,
            state,
            zip_code,
            phone,
            website
          ),
          series (
            id,
            bowler_id,
            bowlers (
              canonical_name
            ),
            games (
              id,
              total_score,
              is_partial
            )
          ),
          uploads (
            id,
            exif_location_lat,
            exif_location_lng,
            exif_datetime
          )
        `)
        .in('id', Array.from(sessionIds))
        .order('date_time', { ascending: false })

      if (sessionsError) {
        console.error('Sessions error:', sessionsError)
        return NextResponse.json(
          { error: 'Failed to fetch sessions' },
          { status: 500 }
        )
      }

      // Calculate completion status for each session
      sessions = (sessionData || []).map(session => {
        const series = session.series || []
        let totalGames = 0
        let completedGames = 0
        let hasPartialGames = false
        const bowlerNames = new Set<string>()

        series.forEach((serie: any) => {
          // Collect bowler names
          if (serie.bowlers?.canonical_name) {
            bowlerNames.add(serie.bowlers.canonical_name)
          }
          
          const games = serie.games || []
          totalGames += games.length
          games.forEach((game: any) => {
            if (game.total_score !== null) {
              completedGames++
            }
            if (game.is_partial) {
              hasPartialGames = true
            }
          })
        })

        // Session is complete if all games have scores (no null scores)
        // Session has incomplete data if some games are complete but not all, or if there are partial games
        const isComplete = totalGames > 0 && completedGames === totalGames && !hasPartialGames
        const isInProgress = completedGames > 0 && (completedGames < totalGames || hasPartialGames)
        const isNotStarted = completedGames === 0

        let status = 'Active'
        let statusColor = 'bg-green-100 text-green-800'

        if (isComplete) {
          status = 'Completed'
          statusColor = 'bg-blue-100 text-blue-800'
        } else if (isInProgress) {
          status = 'Incomplete data'
          statusColor = 'bg-yellow-100 text-yellow-800'
        } else if (isNotStarted) {
          status = 'Not Started'
          statusColor = 'bg-gray-100 text-gray-800'
        }

        // Process GPS location data
        const uploads = session.uploads || []
        let locationInfo = null

        // Find upload with GPS data (prefer the most recent one)
        const uploadWithLocation = uploads
          .filter((u: any) => u.exif_location_lat !== null && u.exif_location_lng !== null)
          .sort((a: any, b: any) => new Date(b.exif_datetime || 0).getTime() - new Date(a.exif_datetime || 0).getTime())[0]

        if (uploadWithLocation) {
          locationInfo = {
            latitude: uploadWithLocation.exif_location_lat,
            longitude: uploadWithLocation.exif_location_lng,
            // For now, just show coordinates. In the future, we could add geocoding
            displayName: `${uploadWithLocation.exif_location_lat.toFixed(4)}, ${uploadWithLocation.exif_location_lng.toFixed(4)}`
          }
        }

        return {
          ...session,
          bowling_alley_name: session.bowling_alleys?.name || null,
          bowling_alley_address: session.bowling_alleys?.address || null,
          bowling_alley_city: session.bowling_alleys?.city || null,
          bowling_alley_state: session.bowling_alleys?.state || null,
          bowler_names: Array.from(bowlerNames),
          status,
          statusColor,
          locationInfo,
          completionStats: {
            totalGames,
            completedGames,
            hasPartialGames,
            isComplete,
            isInProgress,
            isNotStarted
          }
        }
      })
    }

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error('Fetch sessions error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
