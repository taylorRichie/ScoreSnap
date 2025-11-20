-- Make r@wu.ly admin and link to Richie
UPDATE public.user_profiles
SET 
  is_admin = true,
  claimed_bowler_id = (SELECT id FROM public.bowlers WHERE canonical_name = 'Richie')
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'r@wu.ly');

-- Update Richie to show claimed
UPDATE public.bowlers
SET 
  claimed_by_user_id = (SELECT id FROM auth.users WHERE email = 'r@wu.ly'),
  claimed_at = NOW()
WHERE canonical_name = 'Richie';

