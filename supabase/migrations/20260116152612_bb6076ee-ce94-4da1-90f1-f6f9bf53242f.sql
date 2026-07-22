-- Remove the policy that allows editors to view all roles (not needed)
DROP POLICY IF EXISTS "Editors can view all roles" ON public.user_roles;