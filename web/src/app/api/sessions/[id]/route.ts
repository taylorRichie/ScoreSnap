import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerSupabaseClient } from '@/lib/supabase'
import fs from 'fs'
import path from 'path'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = params.id

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

    // Check if user has access to this session:
    // 1. User uploaded images for this session, OR
    // 2. User has claimed bowlers that appear in this session

    let hasAccess = false

    // Check if user uploaded images for this session
    const { data: uploads, error: uploadsError } = await supabase
      .from('uploads')
      .select('id')
      .eq('user_id', user.id)
      .eq('session_id', sessionId)
      .limit(1)

    if (uploadsError) {
      console.error('Uploads check error:', uploadsError)
    } else if (uploads && uploads.length > 0) {
      hasAccess = true
    }

    // If not from uploads, check if user claimed bowlers in this session
    if (!hasAccess) {
      const { data: claimedBowlers, error: bowlersError } = await supabase
        .from('bowlers')
        .select('id')
        .eq('primary_user_id', user.id)

      if (bowlersError) {
        console.error('Bowlers check error:', bowlersError)
      } else if (claimedBowlers && claimedBowlers.length > 0) {
        const bowlerIds = claimedBowlers.map(b => b.id)

        const { data: series, error: seriesError } = await supabase
          .from('series')
          .select('id')
          .eq('session_id', sessionId)
          .in('bowler_id', bowlerIds)
          .limit(1)

        if (seriesError) {
          console.error('Series check error:', seriesError)
        } else if (series && series.length > 0) {
          hasAccess = true
        }
      }
    }

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied - You do not have permission to view this session' },
        { status: 403 }
      )
    }

    // Get session info with bowling alley details
    const { data: session, error: sessionError } = await supabase
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
        )
      `)
      .eq('id', sessionId)
      .single()

    if (sessionError) {
      console.error('Session error:', sessionError)
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    // Get teams for this session
    const { data: teamsData, error: teamsError } = await supabase
      .from('teams')
      .select(`
        id,
        name,
        team_bowlers: team_bowlers (
          bowler: bowlers (
            id,
            canonical_name
          )
        )
      `)
      .eq('session_id', sessionId)
      .order('created_at')

    if (teamsError) {
      console.error('Teams error:', teamsError)
    }

    // Get all series for this session with bowler and game data
    const { data: seriesData, error: seriesError } = await supabase
      .from('series')
      .select(`
        id,
        bowler_id,
        bowlers: bowler_id (
          id,
          canonical_name
        ),
        games: games (
          id,
          game_number,
          total_score,
          is_partial,
          frames: frames (
            frame_number,
            roll_1,
            roll_2,
            roll_3,
            notation
          )
        )
      `)
      .eq('session_id', sessionId)
      .order('created_at')

    if (seriesError) {
      console.error('Series error:', seriesError)
      return NextResponse.json(
        { error: 'Failed to fetch series data' },
        { status: 500 }
      )
    }

    // Process the data to calculate series totals and averages
    const scores = (seriesData || []).map((series: any) => {
      const games = series.games || []
      const seriesTotal = games.reduce((sum: number, game: any) => sum + (game.total_score || 0), 0)
      const completedGames = games.filter((game: any) => game.total_score !== null)
      const averageScore = completedGames.length > 0
        ? Math.round(seriesTotal / completedGames.length)
        : 0

      return {
        series_id: series.id,
        bowler: series.bowlers,
        games: games.sort((a: any, b: any) => a.game_number - b.game_number),
        series_total: seriesTotal,
        average_score: averageScore
      }
    })

    return NextResponse.json({
      session,
      teams: teamsData || [],
      scores
    })

  } catch (error) {
    console.error('Session detail error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = params.id

    // Get the authorization token from the request
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized - No token provided' },
        { status: 401 }
      )
    }

    const sessionToken = authHeader.substring(7)

    // Create client with the user's session token
    const { createClient } = await import('@supabase/supabase-js')
    const userClient = createClient(
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

    // Authenticate the user
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      )
    }

    // Use service role client for database operations
    const supabase = createServerSupabaseClient()

    // Verify user has permission to delete this session
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('created_by_user_id')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    if (session.created_by_user_id !== user.id) {
      return NextResponse.json(
        { error: 'You do not have permission to delete this session' },
        { status: 403 }
      )
    }

    console.log(`🗑️ Deleting session ${sessionId}...`)

    // 1. Get all uploads associated with this session (to delete files)
    const { data: uploads, error: uploadsError } = await supabase
      .from('uploads')
      .select('id, storage_path')
      .eq('session_id', sessionId)

    if (uploadsError) {
      console.error('Error fetching uploads:', uploadsError)
    }

    console.log(`🗑️ Found ${uploads?.length || 0} uploads to delete`)

    // 2. Delete upload files from filesystem
    if (uploads && uploads.length > 0) {
      for (const upload of uploads) {
        if (upload.storage_path) {
          const filePath = path.join(process.cwd(), upload.storage_path)
          try {
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath)
              console.log(`🗑️ Deleted file: ${upload.storage_path}`)
            }
          } catch (fileError) {
            console.error(`Failed to delete file ${upload.storage_path}:`, fileError)
            // Continue anyway - don't fail the whole operation
          }
        }
      }
    }

    // 3. Delete uploads from database
    const { error: deleteUploadsError } = await supabase
      .from('uploads')
      .delete()
      .eq('session_id', sessionId)

    if (deleteUploadsError) {
      console.error('Error deleting uploads:', deleteUploadsError)
    } else {
      console.log('🗑️ Deleted upload records')
    }

    // 4. Get all series for this session
    const { data: seriesToDelete, error: seriesError } = await supabase
      .from('series')
      .select('id')
      .eq('session_id', sessionId)

    console.log(`🗑️ Found ${seriesToDelete?.length || 0} series to delete`)

    if (seriesError) {
      console.error('Error fetching series:', seriesError)
    }

    if (seriesToDelete && seriesToDelete.length > 0) {
      const seriesIds = seriesToDelete.map(s => s.id)

      // Get all game IDs first
      const { data: gamesToDelete, error: gamesQueryError } = await supabase
        .from('games')
        .select('id')
        .in('series_id', seriesIds)

      if (gamesQueryError) {
        console.error('Error fetching games:', gamesQueryError)
      }

      const gameIds = gamesToDelete?.map(g => g.id) || []

      // Delete frames
      if (gameIds.length > 0) {
        const { error: framesError } = await supabase
          .from('frames')
          .delete()
          .in('game_id', gameIds)

        if (framesError) {
          console.error('Error deleting frames:', framesError)
        } else {
          console.log('🗑️ Deleted frames')
        }
      }

      // Delete games
      const { error: gamesError } = await supabase
        .from('games')
        .delete()
        .in('series_id', seriesIds)

      if (gamesError) {
        console.error('Error deleting games:', gamesError)
      } else {
        console.log('🗑️ Deleted games')
      }

      // Delete series
      const { error: seriesDeleteError } = await supabase
        .from('series')
        .delete()
        .eq('session_id', sessionId)

      if (seriesDeleteError) {
        console.error('Error deleting series:', seriesDeleteError)
      } else {
        console.log('🗑️ Deleted series')
      }
    }

    // 5. Delete team_bowlers associations
    const { data: teams, error: teamsQueryError } = await supabase
      .from('teams')
      .select('id')
      .eq('session_id', sessionId)

    if (teamsQueryError) {
      console.error('Error fetching teams:', teamsQueryError)
    }

    if (teams && teams.length > 0) {
      const teamIds = teams.map(t => t.id)

      const { error: teamBowlersError } = await supabase
        .from('team_bowlers')
        .delete()
        .in('team_id', teamIds)

      if (teamBowlersError) {
        console.error('Error deleting team_bowlers:', teamBowlersError)
      } else {
        console.log('🗑️ Deleted team_bowlers')
      }
    }

    // 6. Delete teams
    const { error: teamsError } = await supabase
      .from('teams')
      .delete()
      .eq('session_id', sessionId)

    if (teamsError) {
      console.error('Error deleting teams:', teamsError)
    } else {
      console.log('🗑️ Deleted teams')
    }

    // 7. Finally delete the session
    const { error: deleteError } = await supabase
      .from('sessions')
      .delete()
      .eq('id', sessionId)

    if (deleteError) {
      console.error('Error deleting session:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete session' },
        { status: 500 }
      )
    }

    console.log(`✅ Successfully deleted session ${sessionId}`)
    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Delete session error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
