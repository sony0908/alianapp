-- Bichito: bóveda familiar privada para el emparejamiento por QR.
-- Ejecutar una sola vez en Supabase > SQL Editor. No elimina las tablas antiguas.

create table if not exists public.bichito_vaults (
  id text primary key check (id = 'bichito-family'),
  token_hash text not null,
  ciphertext text,
  iv text,
  version bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.bichito_vaults enable row level security;

-- No hay acceso desde el navegador: solo la API de Vercel usa la clave secreta.
revoke all on table public.bichito_vaults from anon, authenticated;

-- La función de Vercel usa la clave secreta con rol de servicio;
-- es el único proceso autorizado a leer o cambiar la bóveda.
grant usage on schema public to service_role;
grant select, insert, update on table public.bichito_vaults to service_role;
