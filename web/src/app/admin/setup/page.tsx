'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

export default function AdminSetupPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<'idle' | 'checking' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [profileData, setProfileData] = useState<any>(null)

  useEffect(() => {
    if (user) {
      checkProfile()
    }
  }, [user])

  const checkProfile = async () => {
    if (!user) return

    try {
      setStatus('checking')
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      setProfileData(data)
      setStatus('idle')
    } catch (err) {
      console.error('Error checking profile:', err)
      setStatus('idle')
    }
  }

  const handleCreateProfile = async () => {
    if (!user) return

    setLoading(true)
    setStatus('idle')

    try {
      // Get Richie's bowler ID
      const { data: richie, error: richieError } = await supabase
        .from('bowlers')
        .select('id')
        .eq('canonical_name', 'Richie')
        .single()

      if (richieError) throw richieError

      // Try to create user profile
      const { data, error } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: user.id,
          is_admin: true, // Set yourself as admin
          claimed_bowler_id: richie.id
        }, {
          onConflict: 'user_id'
        })
        .select()
        .single()

      if (error) throw error

      // Update bowlers table
      const { error: bowlerError } = await supabase
        .from('bowlers')
        .update({ 
          claimed_by_user_id: user.id,
          claimed_at: new Date().toISOString()
        })
        .eq('id', richie.id)

      if (bowlerError) throw bowlerError

      setStatus('success')
      setMessage('User profile created! You are now an admin with Richie claimed.')
      setProfileData(data)
      
      // Refresh after 2 seconds
      setTimeout(() => {
        window.location.reload()
      }, 2000)
    } catch (err: any) {
      console.error('Error creating profile:', err)
      setStatus('error')
      setMessage(err.message || 'Failed to create user profile')
    } finally {
      setLoading(false)
    }
  }

  const handleMakeAdmin = async () => {
    if (!user) return

    setLoading(true)
    setStatus('idle')

    try {
      // Get Richie's bowler ID
      const { data: richie, error: richieError } = await supabase
        .from('bowlers')
        .select('id')
        .eq('canonical_name', 'Richie')
        .single()

      if (richieError) throw richieError

      // Update user profile
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ 
          is_admin: true,
          claimed_bowler_id: richie.id
        })
        .eq('user_id', user.id)

      if (updateError) throw updateError

      // Update bowlers table
      const { error: bowlerError } = await supabase
        .from('bowlers')
        .update({ 
          claimed_by_user_id: user.id,
          claimed_at: new Date().toISOString()
        })
        .eq('id', richie.id)

      if (bowlerError) throw bowlerError

      setStatus('success')
      setMessage('You are now an admin and Richie is claimed!')
      
      // Refresh after 2 seconds
      setTimeout(() => {
        window.location.reload()
      }, 2000)
    } catch (err: any) {
      console.error('Error updating profile:', err)
      setStatus('error')
      setMessage(err.message || 'Failed to update profile')
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="container mx-auto max-w-2xl p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>You must be logged in to access this page.</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-2xl p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Admin Setup</CardTitle>
          <CardDescription>
            Initialize your user profile and set admin permissions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              <strong>Email:</strong> {user.email}
            </p>
            <p className="text-sm text-muted-foreground">
              <strong>User ID:</strong> {user.id}
            </p>
          </div>

          {status === 'checking' && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Checking profile...</span>
            </div>
          )}

          {profileData && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <p><strong>Profile exists!</strong></p>
                  <p className="text-sm">Is Admin: {profileData.is_admin ? 'Yes' : 'No'}</p>
                  <p className="text-sm">Claimed Bowler: {profileData.claimed_bowler_id || 'None'}</p>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {!profileData && (
            <Button 
              onClick={handleCreateProfile} 
              disabled={loading}
              size="lg"
              className="w-full"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Setup Admin Profile & Claim Richie
            </Button>
          )}

          {profileData && !profileData.is_admin && (
            <Button 
              onClick={handleMakeAdmin} 
              disabled={loading}
              size="lg"
              className="w-full"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Make Me Admin & Claim Richie Profile
            </Button>
          )}
          
          {profileData && profileData.is_admin && !profileData.claimed_bowler_id && (
            <Button 
              onClick={handleMakeAdmin} 
              disabled={loading}
              size="lg"
              className="w-full"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Claim Richie Profile
            </Button>
          )}

          {status === 'success' && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}

          {status === 'error' && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}

          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              After setup, the "Debug" link will appear in the navigation and you can claim a bowler profile to get "My Profile" link.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

