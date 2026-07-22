-- 1. Create enum for roles
CREATE TYPE public.app_role AS ENUM ('viewer', 'editor');

-- 2. Create profiles table for user display info
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    display_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'viewer',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- 4. Enable RLS on new tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 5. Create security definer function to check roles (prevents infinite recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 6. Create function to check if user is authenticated (for viewer access)
CREATE OR REPLACE FUNCTION public.is_authenticated()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
$$;

-- 7. Trigger to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  
  -- Default role is viewer
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'viewer');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8. RLS Policies for profiles table
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- 9. RLS Policies for user_roles table (only editors can see roles)
CREATE POLICY "Editors can view all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'editor'));

CREATE POLICY "Editors can manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'editor'));

-- 10. Update existing tables RLS policies

-- DROP existing permissive policies on members
DROP POLICY IF EXISTS "Allow public insert members" ON public.members;
DROP POLICY IF EXISTS "Allow public read members" ON public.members;
DROP POLICY IF EXISTS "Allow public update members" ON public.members;

-- New policies for members (authenticated can read, editors can write)
CREATE POLICY "Authenticated users can read members"
  ON public.members FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Editors can insert members"
  ON public.members FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'editor'));

CREATE POLICY "Editors can update members"
  ON public.members FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'editor'));

CREATE POLICY "Editors can delete members"
  ON public.members FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'editor'));

-- DROP existing permissive policies on session
DROP POLICY IF EXISTS "Allow public delete session" ON public.session;
DROP POLICY IF EXISTS "Allow public insert session" ON public.session;
DROP POLICY IF EXISTS "Allow public read session" ON public.session;
DROP POLICY IF EXISTS "Allow public update session" ON public.session;

-- New policies for session
CREATE POLICY "Authenticated users can read sessions"
  ON public.session FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Editors can insert sessions"
  ON public.session FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'editor'));

CREATE POLICY "Editors can update sessions"
  ON public.session FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'editor'));

CREATE POLICY "Editors can delete sessions"
  ON public.session FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'editor'));

-- DROP existing permissive policies on vegetal
DROP POLICY IF EXISTS "Allow public delete vegetal" ON public.vegetal;
DROP POLICY IF EXISTS "Allow public insert vegetal" ON public.vegetal;
DROP POLICY IF EXISTS "Allow public read vegetal" ON public.vegetal;
DROP POLICY IF EXISTS "Allow public update vegetal" ON public.vegetal;

-- New policies for vegetal
CREATE POLICY "Authenticated users can read vegetal"
  ON public.vegetal FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Editors can insert vegetal"
  ON public.vegetal FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'editor'));

CREATE POLICY "Editors can update vegetal"
  ON public.vegetal FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'editor'));

CREATE POLICY "Editors can delete vegetal"
  ON public.vegetal FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'editor'));

-- DROP existing permissive policies on stock_movement
DROP POLICY IF EXISTS "Allow public insert stock_movement" ON public.stock_movement;
DROP POLICY IF EXISTS "Allow public read stock_movement" ON public.stock_movement;

-- New policies for stock_movement
CREATE POLICY "Authenticated users can read stock_movement"
  ON public.stock_movement FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Editors can insert stock_movement"
  ON public.stock_movement FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'editor'));

CREATE POLICY "Editors can update stock_movement"
  ON public.stock_movement FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'editor'));

CREATE POLICY "Editors can delete stock_movement"
  ON public.stock_movement FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'editor'));