-- Add claimed_by_user_id to bowlers table
ALTER TABLE public.bowlers
ADD COLUMN IF NOT EXISTS claimed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMP WITH TIME ZONE;

-- Add index for fast lookups
CREATE INDEX IF NOT EXISTS idx_bowlers_claimed_by_user_id ON public.bowlers(claimed_by_user_id);

-- Add comment
COMMENT ON COLUMN public.bowlers.claimed_by_user_id IS 'User who has claimed this bowler profile as their own';
COMMENT ON COLUMN public.bowlers.claimed_at IS 'Timestamp when the bowler was claimed';

-- Ensure only one bowler per user can be claimed
CREATE UNIQUE INDEX IF NOT EXISTS idx_bowlers_one_claim_per_user ON public.bowlers(claimed_by_user_id) WHERE claimed_by_user_id IS NOT NULL;

-- Create user_profiles table for user-specific data (admin status, claimed bowler)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    is_admin BOOLEAN DEFAULT FALSE,
    claimed_bowler_id UUID REFERENCES public.bowlers(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON public.user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_claimed_bowler_id ON public.user_profiles(claimed_bowler_id);

-- Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_profiles
-- Users can view all profiles (for seeing who claimed which bowler)
CREATE POLICY "Anyone can view user profiles" ON public.user_profiles
    FOR SELECT USING (true);

-- Users can only insert their own profile
CREATE POLICY "Users can create their own profile" ON public.user_profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can only update their own profile (except is_admin - only admins can change that)
CREATE POLICY "Users can update their own profile" ON public.user_profiles
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (
        auth.uid() = user_id AND
        (
            -- Regular users cannot change their admin status
            is_admin = (SELECT is_admin FROM public.user_profiles WHERE user_id = auth.uid())
            OR
            -- Admins can change anything
            EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND is_admin = true)
        )
    );

-- Function to automatically create user profile on first login
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (user_id, is_admin)
    VALUES (NEW.id, false)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update existing users to have profiles (run once)
INSERT INTO public.user_profiles (user_id, is_admin)
SELECT id, false FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

