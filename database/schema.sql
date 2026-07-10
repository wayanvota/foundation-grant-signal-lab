create extension if not exists pgcrypto;

create table if not exists grant_reviews (
  id uuid primary key default gen_random_uuid(),
  applicant text not null,
  proposal text not null,
  foundation_strategy text not null,
  score numeric not null check (score >= 0 and score <= 100),
  model_route text not null check (model_route in ('Sol', 'Terra', 'Luna')),
  verdict text not null,
  board_line text not null,
  strongest_evidence jsonb not null default '[]'::jsonb,
  donor_risks jsonb not null default '[]'::jsonb,
  next_actions jsonb not null default '[]'::jsonb,
  model_used text not null,
  response_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists grant_reviews_created_at_idx
  on grant_reviews (created_at desc);

create index if not exists grant_reviews_score_idx
  on grant_reviews (score desc);
