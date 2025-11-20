import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { email, isAdmin, bowlerId } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Get auth user by email
    const { data: { users }, error: userError } = await supabase.auth.admin.listUsers()
    
    if (userError) throw userError

    const targetUser = users.find(u => u.email === email)
    
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Update user_profiles
    const updateData: any = {}
    if (isAdmin !== undefined) updateData.is_admin = isAdmin
    if (bowlerId !== undefined) updateData.claimed_bowler_id = bowlerId

    const { data: profile, error: updateError } = await supabase
      .from('user_profiles')
      .update(updateData)
      .eq('user_id', targetUser.id)
      .select()
      .single()

    if (updateError) throw updateError

    // If setting a claimed bowler, also update the bowlers table
    if (bowlerId) {
      const { error: bowlerError } = await supabase
        .from('bowlers')
        .update({ 
          claimed_by_user_id: targetUser.id,
          claimed_at: new Date().toISOString()
        })
        .eq('id', bowlerId)

      if (bowlerError) {
        console.error('Error updating bowler:', bowlerError)
      }
    }

    return NextResponse.json({
      message: 'Profile updated successfully',
      profile
    })

  } catch (error) {
    console.error('Fix profile error:', error)
    return NextResponse.json({ 
      error: 'Failed to update profile',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

