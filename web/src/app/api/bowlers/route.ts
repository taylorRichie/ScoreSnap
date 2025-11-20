import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerSupabaseClient } from '@/lib/supabase'

interface DeleteBowlerRequest {
  id: string
}

export async function GET(request: NextRequest) {
  try {
    // TEMPORARY: Use service role client to bypass auth issues for testing
    const supabase = createServerSupabaseClient()

    // Get all bowlers
    const { data: bowlers, error } = await supabase
      .from('bowlers')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch bowlers' },
        { status: 500 }
      )
    }

    return NextResponse.json({ bowlers: bowlers || [] })

  } catch (error) {
    console.error('Fetch bowlers error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()

    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    const body: DeleteBowlerRequest = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Bowler ID is required' },
        { status: 400 }
      )
    }

    // Check if the user can delete this bowler (they created it or own it)
    const { data: bowler, error: fetchError } = await supabase
      .from('bowlers')
      .select('created_by_user_id, primary_user_id')
      .eq('id', id)
      .single()

    if (fetchError) {
      console.error('Error fetching bowler:', fetchError)
      return NextResponse.json(
        { error: 'Bowler not found' },
        { status: 404 }
      )
    }

    // Check permissions
    const canDelete = bowler.created_by_user_id === user.id || bowler.primary_user_id === user.id

    if (!canDelete) {
      return NextResponse.json(
        { error: 'You do not have permission to delete this bowler' },
        { status: 403 }
      )
    }

    // Delete the bowler (cascade will handle related records)
    const { error: deleteError } = await supabase
      .from('bowlers')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Error deleting bowler:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete bowler' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Delete bowler error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
