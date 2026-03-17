-- Run this in Supabase SQL Editor (Dashboard → SQL Editor) to create tables.

-- Users (id, username, password_hash, email, balance, created_at)
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  password_hash text not null,
  email text,
  balance numeric default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists users_username_lower on public.users (lower(trim(username)));
create unique index if not exists users_email_lower on public.users (lower(trim(email))) where trim(email) <> '';

-- Fantasy teams per user per major
create table if not exists public.fantasy_teams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  major_key text not null check (major_key in ('masters', 'pga', 'usopen', 'open')),
  name text not null,
  golfers jsonb not null default '[]',
  captain_rank integer,
  substitute jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, major_key)
);

create index if not exists fantasy_teams_user_id on public.fantasy_teams (user_id);
create index if not exists fantasy_teams_major_key on public.fantasy_teams (major_key);

-- Password reset tokens
create table if not exists public.password_resets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  token_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  used_at timestamptz
);

create index if not exists password_resets_token_hash on public.password_resets (token_hash);
