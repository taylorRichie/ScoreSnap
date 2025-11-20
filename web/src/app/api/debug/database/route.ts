import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
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

    // Only allow admin user
    if (user.email !== 'r@wu.ly') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Get database statistics
    const [
      { count: sessionsCount },
      { count: bowlersCount },
      { count: seriesCount },
      { count: gamesCount },
      { count: framesCount },
      { count: uploadsCount }
    ] = await Promise.all([
      supabase.from('sessions').select('*', { count: 'exact', head: true }),
      supabase.from('bowlers').select('*', { count: 'exact', head: true }),
      supabase.from('series').select('*', { count: 'exact', head: true }),
      supabase.from('games').select('*', { count: 'exact', head: true }),
      supabase.from('frames').select('*', { count: 'exact', head: true }),
      supabase.from('uploads').select('*', { count: 'exact', head: true })
    ])

    // Get recent sessions with their data
    const { data: recentSessions, error: sessionsError } = await supabase
      .from('sessions')
      .select(`
        id,
        date_time,
        bowling_alley_name,
        lane,
        created_at,
        series (
          id,
          bowler_id,
          bowlers (
            canonical_name
          ),
          games (
            id,
            game_number,
            total_score
          )
        )
      `)
      .order('created_at', { ascending: false })
      .limit(5)

    if (sessionsError) {
      console.error('Error fetching recent sessions:', sessionsError)
    }

    return NextResponse.json({
      statistics: {
        sessions: sessionsCount || 0,
        bowlers: bowlersCount || 0,
        series: seriesCount || 0,
        games: gamesCount || 0,
        frames: framesCount || 0,
        uploads: uploadsCount || 0
      },
      recentSessions: recentSessions || []
    })

  } catch (error) {
    console.error('Database debug error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
