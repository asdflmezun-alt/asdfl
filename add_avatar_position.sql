-- Add avatar_position column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_position TEXT DEFAULT '50% 50%';

-- Update the new user trigger function to handle the new avatar_position column (capturing default center position)
-- This ensures that when a new user signs up, the avatar_position is initialized.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    name,
    email,
    role,
    grad_year,
    class_section,
    city,
    phone,
    job,
    company,
    university,
    github_url,
    avatar_url,
    avatar_position
  )
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', 'Yeni Üye'),
    new.email,
    COALESCE(new.raw_user_meta_data->>'role', 'Öğrenci'),
    (new.raw_user_meta_data->>'gradYear')::integer,
    new.raw_user_meta_data->>'classSection',
    new.raw_user_meta_data->>'city',
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'job',
    new.raw_user_meta_data->>'company',
    new.raw_user_meta_data->>'university',
    new.raw_user_meta_data->>'github_url',
    new.raw_user_meta_data->>'avatar_url',
    '50% 50%'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
