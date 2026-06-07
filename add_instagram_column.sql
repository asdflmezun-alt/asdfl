-- Add instagram_url column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS instagram_url TEXT;
