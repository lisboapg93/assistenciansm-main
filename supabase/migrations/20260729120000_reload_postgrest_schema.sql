-- Make newly created RPC functions available to the PostgREST API immediately.
NOTIFY pgrst, 'reload schema';
