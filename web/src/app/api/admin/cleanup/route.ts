import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  console.log('🧹 API /admin/cleanup called')

  try {
    // Check if user is admin
    const supabase = createServerSupabaseClient()

    // For now, allow cleanup without authentication since we're in development
    // TODO: Add proper admin authentication check

    console.log('🧹 Starting database cleanup...')

    // Get current record counts
    const tables = ['sessions', 'bowlers', 'series', 'games', 'frames', 'uploads', 'teams', 'team_bowlers']
    const beforeCounts: { [key: string]: number } = {}

    for (const table of tables) {
      const { count, error } = await supabase
        .from(table as any)
        .select('*', { count: 'exact', head: true })

      if (error) {
        console.error(`Error counting ${table}:`, error)
        beforeCounts[table] = 0
      } else {
        beforeCounts[table] = count || 0
      }
    }

    console.log('📊 Before cleanup counts:', beforeCounts)

    // Find duplicate bowlers
    const { data: bowlerGroups, error: bowlerError } = await supabase
      .from('bowlers')
      .select('canonical_name, id, created_at')
      .order('canonical_name', { ascending: true })
      .order('created_at', { ascending: false })

    if (bowlerError) {
      throw new Error(`Failed to fetch bowlers: ${bowlerError.message}`)
    }

    // Group bowlers by canonical_name
    const bowlerMap: { [name: string]: Array<{ id: string, created_at: string }> } = {}
    bowlerGroups?.forEach(bowler => {
      if (!bowlerMap[bowler.canonical_name]) {
        bowlerMap[bowler.canonical_name] = []
      }
      bowlerMap[bowler.canonical_name].push({ id: bowler.id, created_at: bowler.created_at })
    })

    let duplicateBowlersRemoved = 0
    let duplicateSessionsRemoved = 0

    // Process duplicates for each bowler name
    for (const [name, bowlers] of Object.entries(bowlerMap)) {
      if (bowlers.length > 1) {
        console.log(`🔄 Processing ${bowlers.length} duplicates for bowler: ${name}`)

        // Keep the most recent bowler (first in array since ordered by created_at DESC)
        const keepBowler = bowlers[0]
        const deleteBowlers = bowlers.slice(1)

        console.log(`✅ Keeping bowler ${keepBowler.id}, deleting ${deleteBowlers.length} older duplicates`)

        // Update all references to point to the kept bowler
        for (const deleteBowler of deleteBowlers) {
          // Update series
          const { error: seriesError } = await supabase
            .from('series')
            .update({ bowler_id: keepBowler.id })
            .eq('bowler_id', deleteBowler.id)

          if (seriesError) {
            console.warn(`Warning: Failed to update series for bowler ${deleteBowler.id}: ${seriesError.message}`)
          }

          // Update games
          const { error: gamesError } = await supabase
            .from('games')
            .update({ bowler_id: keepBowler.id })
            .eq('bowler_id', deleteBowler.id)

          if (gamesError) {
            console.warn(`Warning: Failed to update games for bowler ${deleteBowler.id}: ${gamesError.message}`)
          }

          // Update team_bowlers
          const { error: teamBowlerError } = await supabase
            .from('team_bowlers')
            .update({ bowler_id: keepBowler.id })
            .eq('bowler_id', deleteBowler.id)

          if (teamBowlerError) {
            console.warn(`Warning: Failed to update team_bowlers for bowler ${deleteBowler.id}: ${teamBowlerError.message}`)
          }

          // Delete the duplicate bowler
          const { error: deleteError } = await supabase
            .from('bowlers')
            .delete()
            .eq('id', deleteBowler.id)

          if (deleteError) {
            console.error(`Error deleting bowler ${deleteBowler.id}: ${deleteError.message}`)
          } else {
            duplicateBowlersRemoved++
          }
        }
      }
    }

    // Find and remove duplicate sessions
    console.log('🔄 Finding duplicate sessions...')
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('id, date_time, created_at, bowling_alley_id, location')
      .order('date_time', { ascending: true })
      .order('created_at', { ascending: false })

    if (sessionsError) {
      console.warn(`Warning: Failed to fetch sessions: ${sessionsError.message}`)
    } else if (sessions) {
      // Group sessions by date_time (within 1 hour window) and location
      const sessionGroups: { [key: string]: Array<{ id: string, created_at: string }> } = {}
      
      sessions.forEach(session => {
        // Round to nearest hour for grouping
        const dateTime = new Date(session.date_time)
        const roundedHour = new Date(dateTime)
        roundedHour.setMinutes(0, 0, 0)
        
        // Create a key combining time and location
        const locationKey = session.bowling_alley_id || session.location || 'unknown'
        const groupKey = `${roundedHour.toISOString()}_${locationKey}`
        
        if (!sessionGroups[groupKey]) {
          sessionGroups[groupKey] = []
        }
        sessionGroups[groupKey].push({ id: session.id, created_at: session.created_at })
      })

      // Process duplicate sessions
      for (const [groupKey, sessionList] of Object.entries(sessionGroups)) {
        if (sessionList.length > 1) {
          console.log(`🔄 Processing ${sessionList.length} duplicate sessions for group: ${groupKey}`)
          
          // Keep the most recent session
          const keepSession = sessionList[0]
          const deleteSessions = sessionList.slice(1)
          
          console.log(`✅ Keeping session ${keepSession.id}, deleting ${deleteSessions.length} older duplicates`)
          
          for (const deleteSession of deleteSessions) {
            // Update series to point to the kept session
            const { error: seriesUpdateError } = await supabase
              .from('series')
              .update({ session_id: keepSession.id })
              .eq('session_id', deleteSession.id)
            
            if (seriesUpdateError) {
              console.warn(`Warning: Failed to update series for session ${deleteSession.id}: ${seriesUpdateError.message}`)
            }
            
            // Update uploads to point to the kept session
            const { error: uploadsUpdateError } = await supabase
              .from('uploads')
              .update({ session_id: keepSession.id })
              .eq('session_id', deleteSession.id)
            
            if (uploadsUpdateError) {
              console.warn(`Warning: Failed to update uploads for session ${deleteSession.id}: ${uploadsUpdateError.message}`)
            }
            
            // Delete the duplicate session
            const { error: deleteError } = await supabase
              .from('sessions')
              .delete()
              .eq('id', deleteSession.id)
            
            if (deleteError) {
              console.error(`Error deleting session ${deleteSession.id}: ${deleteError.message}`)
            } else {
              duplicateSessionsRemoved++
            }
          }
        }
      }
    }

    // Clean up orphaned records
    console.log('🧽 Cleaning up orphaned records...')

    // Delete series without bowlers
    const { error: orphanedSeriesError } = await supabase
      .from('series')
      .delete()
      .not('bowler_id', 'in', `(${bowlerGroups?.map(b => b.id).join(',') || ''})`)

    if (orphanedSeriesError) {
      console.warn(`Warning: Failed to clean orphaned series: ${orphanedSeriesError.message}`)
    }

    // Get final counts
    const afterCounts: { [key: string]: number } = {}
    for (const table of tables) {
      const { count, error } = await supabase
        .from(table as any)
        .select('*', { count: 'exact', head: true })

      if (error) {
        console.error(`Error counting ${table}:`, error)
        afterCounts[table] = 0
      } else {
        afterCounts[table] = count || 0
      }
    }

    console.log('📊 After cleanup counts:', afterCounts)

    const result = {
      success: true,
      duplicateBowlersRemoved,
      duplicateSessionsRemoved,
      beforeCounts,
      afterCounts,
      message: `Cleanup completed! Removed ${duplicateBowlersRemoved} duplicate bowlers, ${duplicateSessionsRemoved} duplicate sessions, and cleaned up orphaned records.`
    }

    console.log('✅ Database cleanup completed:', result)
    return NextResponse.json(result)

  } catch (error) {
    console.error('❌ Database cleanup error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
