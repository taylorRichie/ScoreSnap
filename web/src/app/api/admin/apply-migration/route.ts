import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

/**
 * Admin endpoint to apply the user_profiles migration
 * This creates the necessary tables and structures
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()

    console.log('📝 Applying user_profiles migration...')

    // Create user_profiles table
    await supabase.rpc('exec_sql', {
      sql: `
        -- Add claimed_by_user_id to bowlers table if not exists
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'bowlers' AND column_name = 'claimed_by_user_id'
          ) THEN
            ALTER TABLE public.bowlers
            ADD COLUMN claimed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
            ADD COLUMN claimed_at TIMESTAMP WITH TIME ZONE;
            
            CREATE INDEX idx_bowlers_claimed_by_user_id ON public.bowlers(claimed_by_user_id);
            CREATE UNIQUE INDEX idx_bowlers_one_claim_per_user ON public.bowlers(claimed_by_user_id) WHERE claimed_by_user_id IS NOT NULL;
          END IF;
        END $$;

        -- Create user_profiles table if not exists
        CREATE TABLE IF NOT EXISTS public.user_profiles (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
          is_admin BOOLEAN DEFAULT FALSE,
          claimed_bowler_id UUID REFERENCES public.bowlers(id) ON DELETE SET NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Create indexes
        CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON public.user_profiles(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_profiles_claimed_bowler_id ON public.user_profiles(claimed_bowler_id);

        -- Enable RLS
        ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

        -- Drop existing policies if they exist
        DROP POLICY IF EXISTS "Anyone can view user profiles" ON public.user_profiles;
        DROP POLICY IF EXISTS "Users can create their own profile" ON public.user_profiles;
        DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;

        -- RLS Policies
        CREATE POLICY "Anyone can view user profiles" ON public.user_profiles
          FOR SELECT USING (true);

        CREATE POLICY "Users can create their own profile" ON public.user_profiles
          FOR INSERT WITH CHECK (auth.uid() = user_id);

        CREATE POLICY "Users can update their own profile" ON public.user_profiles
          FOR UPDATE USING (auth.uid() = user_id);
      `
    })

    return NextResponse.json({
      message: 'Migration applied successfully!',
      success: true
    })

  } catch (error) {
    console.error('❌ Migration error:', error)
    
    // If exec_sql doesn't exist, return the SQL for manual execution
    return NextResponse.json({ 
      error: 'Could not apply migration automatically',
      details: error instanceof Error ? error.message : 'Unknown error',
      manualSql: `
-- Run this SQL in your Supabase SQL Editor:

-- Add claimed_by_user_id to bowlers table
ALTER TABLE public.bowlers
ADD COLUMN IF NOT EXISTS claimed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_bowlers_claimed_by_user_id ON public.bowlers(claimed_by_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bowlers_one_claim_per_user ON public.bowlers(claimed_by_user_id) WHERE claimed_by_user_id IS NOT NULL;

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  is_admin BOOLEAN DEFAULT FALSE,
  claimed_bowler_id UUID REFERENCES public.bowlers(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON public.user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_claimed_bowler_id ON public.user_profiles(claimed_bowler_id);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view user profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can create their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;

CREATE POLICY "Anyone can view user profiles" ON public.user_profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can create their own profile" ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- Insert profiles for existing users
INSERT INTO public.user_profiles (user_id, is_admin)
SELECT id, false FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
      `
    }, { status: 500 })
  }
}

