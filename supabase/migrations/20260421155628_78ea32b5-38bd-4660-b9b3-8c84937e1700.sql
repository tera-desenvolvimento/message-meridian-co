WITH ranked_memberships AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, workspace_id
           ORDER BY created_at ASC, id ASC
         ) AS rn
  FROM public.memberships
)
DELETE FROM public.memberships m
USING ranked_memberships r
WHERE m.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS memberships_user_workspace_unique
ON public.memberships (user_id, workspace_id);