# FocusFlow Supabase database

The migration in `migrations/` creates the V2 `public.tasks` table, its indexes,
timestamp trigger, and row-level security (RLS) policies. It is the source of
truth for database changes; do not recreate the schema only through the
Supabase dashboard.

## Apply the migration

With the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started)
installed, either:

```sh
# Apply to a local Supabase stack
supabase start
supabase db reset

# Or, after explicitly linking the intended cloud project
supabase link --project-ref <project-ref>
supabase db push
```

Review the target project before `db push`. This repository intentionally does
not contain a project reference, database password, API key, or other secret.

## Security model

`tasks.user_id` references `auth.users(id)` and uses `on delete cascade`, so
deleting an Auth user deletes that user's tasks. RLS is enabled and separate
`SELECT`, `INSERT`, `UPDATE`, and `DELETE` policies compare `user_id` with
`auth.uid()`:

- reads, updates, and deletes can target only the signed-in user's rows;
- `INSERT ... WITH CHECK` rejects a different user's `user_id`;
- `UPDATE ... WITH CHECK` prevents changing ownership to another user;
- anonymous clients have no table privileges.

The frontend should use only the project URL and the publishable/`anon` key.
Never put the `service_role` key, a database password, or a personal access
token in client code, environment files committed to Git, logs, or GitHub.
The `service_role` key bypasses RLS and belongs only in a trusted server-side
environment when one is genuinely required.

## Reproducible RLS verification

After applying the migration to a real Supabase project, create two disposable
email/password users (A and B) and use each user's access token with the normal
Supabase client (project URL plus publishable/`anon` key). Verify all of the
following through the Data API, not with the SQL editor's database-owner role:

1. A and B can each insert a task whose `user_id` is their own ID.
2. A's `SELECT` returns A's task and never B's; B observes the inverse.
3. A can update and delete A's task.
4. A cannot update or delete B's task (no row is affected).
5. A receives an RLS error when inserting with B's `user_id`.
6. A receives an RLS error when changing A's task `user_id` to B's ID.
7. A request with no user access token cannot select, insert, update, or delete
   tasks.

The SQL editor and `service_role` key can bypass RLS, so they are not valid ways
to prove the client-facing isolation checks above.
