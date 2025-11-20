import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

/**
 * Public API endpoint for dashboard statistics
 * No authentication required - all data is read-only
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()

    // Get total sessions
    const { count: totalSessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })

    if (sessionsError) throw sessionsError

    // Get total games
    const { count: totalGames, error: gamesError } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })

    if (gamesError) throw gamesError

    // Get total bowlers (with at least one game)
    const { count: totalBowlers, error: bowlersError } = await supabase
      .from('bowlers')
      .select('id, games!inner(id)', { count: 'exact', head: true })

    if (bowlersError) throw bowlersError

    // Get total bowling alleys
    const { count: totalAlleys, error: alleysError } = await supabase
      .from('bowling_alleys')
      .select('*', { count: 'exact', head: true })

    if (alleysError) throw alleysError

    // Get highest game score
    const { data: highestGame, error: highestGameError } = await supabase
      .from('games')
      .select('total_score, bowlers(canonical_name), series(sessions(id, date_time))')
      .not('total_score', 'is', null)
      .order('total_score', { ascending: false })
      .limit(1)
      .single()

    if (highestGameError && highestGameError.code !== 'PGRST116') throw highestGameError

    // Get highest series
    const { data: highestSeries, error: highestSeriesError } = await supabase
      .from('series')
      .select('series_total, bowlers(canonical_name), sessions(id, date_time)')
      .order('series_total', { ascending: false })
      .limit(1)
      .single()

    if (highestSeriesError && highestSeriesError.code !== 'PGRST116') throw highestSeriesError

    // Get recent sessions (last 5)
    const { data: recentSessions, error: recentSessionsError } = await supabase
      .from('sessions')
      .select(`
        id,
        name,
        date_time,
        bowling_alleys(name),
        bowling_alley_name,
        series(
          bowlers(canonical_name)
        )
      `)
      .order('date_time', { ascending: false })
      .limit(5)

    if (recentSessionsError) throw recentSessionsError

    // Calculate average score across all games
    const { data: avgScoreData, error: avgScoreError } = await supabase
      .rpc('calculate_average_score')

    // If the function doesn't exist, calculate manually
    let averageScore = 0
    if (avgScoreError || !avgScoreData) {
      const { data: allGames, error: allGamesError } = await supabase
        .from('games')
        .select('total_score')
        .not('total_score', 'is', null)

      if (!allGamesError && allGames && allGames.length > 0) {
        const sum = allGames.reduce((acc, game) => acc + (game.total_score || 0), 0)
        averageScore = Math.round(sum / allGames.length)
      }
    } else {
      averageScore = avgScoreData
    }

    // Get top bowlers by average
    const { data: topBowlers, error: topBowlersError } = await supabase
      .rpc('get_top_bowlers', { limit_count: 5 })

    // If function doesn't exist, fetch manually
    let topBowlersList = []
    if (topBowlersError || !topBowlers) {
      const { data: bowlersData, error: bowlersDataError } = await supabase
        .from('bowlers')
        .select(`
          id,
          canonical_name,
          games(total_score)
        `)
        .limit(100)

      if (!bowlersDataError && bowlersData) {
        topBowlersList = bowlersData
          .map((bowler: any) => {
            const validGames = bowler.games.filter((g: any) => g.total_score !== null)
            if (validGames.length === 0) return null

            const avg = validGames.reduce((sum: number, g: any) => sum + g.total_score, 0) / validGames.length
            return {
              id: bowler.id,
              name: bowler.canonical_name,
              average_score: Math.round(avg),
              game_count: validGames.length
            }
          })
          .filter(Boolean)
          .sort((a: any, b: any) => b.average_score - a.average_score)
          .slice(0, 5)
      }
    } else {
      topBowlersList = topBowlers
    }

    return NextResponse.json({
      stats: {
        totalSessions: totalSessions || 0,
        totalGames: totalGames || 0,
        totalBowlers: totalBowlers || 0,
        totalAlleys: totalAlleys || 0,
        averageScore,
        highestGame: highestGame ? {
          score: highestGame.total_score,
          bowler: (highestGame.bowlers as any)?.canonical_name,
          sessionId: (highestGame.series as any)?.sessions?.id,
          date: (highestGame.series as any)?.sessions?.date_time
        } : null,
        highestSeries: highestSeries ? {
          score: highestSeries.series_total,
          bowler: (highestSeries.bowlers as any)?.canonical_name,
          sessionId: (highestSeries.sessions as any)?.id,
          date: (highestSeries.sessions as any)?.date_time
        } : null
      },
      recentSessions: recentSessions?.map((session: any) => ({
        id: session.id,
        name: session.name,
        date: session.date_time,
        alley: session.bowling_alleys?.name || session.bowling_alley_name,
        bowlerCount: new Set(session.series?.map((s: any) => s.bowlers?.canonical_name)).size
      })) || [],
      topBowlers: topBowlersList
    })

  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch dashboard statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

