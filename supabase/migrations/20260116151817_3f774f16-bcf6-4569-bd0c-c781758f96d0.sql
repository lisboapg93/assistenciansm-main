-- Allow users to read their own role
DROP POLICY IF EXISTS "Editors can view all roles" ON public.user_roles;

CREATE POLICY "Users can view own role"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Keep the policy for editors to manage all roles
DROP POLICY IF EXISTS "Editors can manage roles" ON public.user_roles;

CREATE POLICY "Editors can view all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'editor'));

CREATE POLICY "Editors can insert roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'editor'));

CREATE POLICY "Editors can update roles"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'editor'));

CREATE POLICY "Editors can delete roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'editor'));