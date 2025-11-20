'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { useTheme } from '@/components/theme-provider'
import { usePathname } from 'next/navigation'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Menu, Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose
} from '@/components/ui/sheet'
import { supabase } from '@/lib/supabase'

interface UserProfile {
  claimed_bowler_id: string | null
  is_admin: boolean
}

export default function Header() {
  const { user, signOut } = useAuth()
  const { theme, setTheme } = useTheme()
  const pathname = usePathname()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)

  useEffect(() => {
    if (user) {
      fetchUserProfile()
    } else {
      setUserProfile(null)
    }
  }, [user])

  const fetchUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('claimed_bowler_id, is_admin')
        .eq('user_id', user!.id)
        .maybeSingle()

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching user profile:', error)
      }

      // If no profile exists, create one
      if (!data) {
        console.log('No user profile found, creating one...')
        const { data: newProfile, error: createError } = await supabase
          .from('user_profiles')
          .upsert({
            user_id: user!.id,
            is_admin: false,
            claimed_bowler_id: null
          }, {
            onConflict: 'user_id'
          })
          .select('claimed_bowler_id, is_admin')
          .single()

        if (createError) {
          console.error('Error creating user profile:', createError)
          setUserProfile({ claimed_bowler_id: null, is_admin: false })
        } else {
          setUserProfile(newProfile)
        }
      } else {
        setUserProfile(data)
      }
    } catch (err) {
      console.error('Error in fetchUserProfile:', err)
      setUserProfile({ claimed_bowler_id: null, is_admin: false })
    }
  }

  // Build navigation dynamically
  const navigation = [
    { name: 'Bowlers', href: '/bowlers', requiresAuth: false },
    { name: 'Sessions', href: '/sessions', requiresAuth: false },
    { name: 'Alleys', href: '/alleys', requiresAuth: false },
    ...(user && userProfile?.claimed_bowler_id ? [{ name: 'My Profile', href: `/bowlers/${userProfile.claimed_bowler_id}`, requiresAuth: true }] : []),
    ...(user ? [{ name: 'Upload', href: '/upload', requiresAuth: true }] : []),
    ...(user && userProfile?.is_admin === true ? [{ name: 'Debug', href: '/debug/upload', requiresAuth: true }] : []),
  ]

  // Debug logging
  useEffect(() => {
    if (user) {
      console.log('Header - User:', user.email)
      console.log('Header - User Profile:', userProfile)
      console.log('Header - Is Admin:', userProfile?.is_admin)
      console.log('Header - Claimed Bowler:', userProfile?.claimed_bowler_id)
      console.log('Header - Navigation items:', navigation.map(n => n.name))
    }
  }, [user, userProfile])

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === href
    }
    return pathname.startsWith(href)
  }

  const handleSignOut = async () => {
    await signOut()
  }

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="text-base font-semibold tracking-tight text-foreground">
          ScoreSnap
        </Link>

        <nav className="hidden items-center gap-2 md:flex">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                buttonVariants({
                  variant: isActive(item.href) ? 'secondary' : 'ghost',
                  size: 'sm'
                }),
                'font-medium'
              )}
            >
              {item.name}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span className="sr-only">Toggle theme</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setTheme('light')}>
                Light
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('dark')}>
                Dark
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('system')}>
                System
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      {user.email?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">Account</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Open navigation</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-sm">
              <SheetHeader>
                <SheetTitle>Navigation</SheetTitle>
              </SheetHeader>
              <div className="mt-6 flex flex-col gap-2">
                {navigation.map((item) => (
                  <SheetClose asChild key={item.name}>
                    <Link
                      href={item.href}
                      className={cn(
                        buttonVariants({
                          variant: isActive(item.href) ? 'secondary' : 'ghost',
                          size: 'lg'
                        }),
                        'justify-start'
                      )}
                    >
                      {item.name}
                    </Link>
                  </SheetClose>
                ))}
              </div>
              {user && (
                <div className="mt-6 space-y-2 border-t pt-4">
                  <div className="text-sm text-muted-foreground">
                    {user.email}
                  </div>
                  <SheetClose asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={handleSignOut}
                    >
                      Sign out
                    </Button>
                  </SheetClose>
                </div>
              )}
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
