-- Sansser Links wing: pages, links, people, consent, unlocks and events.
-- Additive only. Nothing here deletes data; rows are archived, never removed.

create extension if not exists citext;

create table if not exists pages (
  id           bigint generated always as identity primary key,
  keyword      citext not null unique,              -- the word people comment, e.g. REPOS
  title        text not null,
  subtitle     text not null default '',
  cover_url    text,
  kind         text not null default 'links' check (kind in ('links', 'guide')),
  status       text not null default 'draft' check (status in ('draft', 'live', 'archived')),
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists page_items (
  id          bigint generated always as identity primary key,
  page_id     bigint not null references pages(id),
  position    int not null default 0,
  name        text not null,
  url         text not null,
  replaces    text not null default '',            -- shown as "Replaces Notion"
  description text not null default '',
  bonus       boolean not null default false,
  hidden_name boolean not null default false,       -- keep the name out of public page data until unlocked
  archived_at timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists page_items_page on page_items(page_id, position);

create table if not exists people (
  id          bigint generated always as identity primary key,
  email       citext not null unique,
  first_seen  timestamptz not null default now(),
  country     text,
  source      text,                                 -- first reel keyword or page
  src_tag     text,                                 -- first ?src= tag
  interests   text[] not null default '{}',
  imported_from text                                -- 'link.sansser.com', 'rohankumar.pro', 'resend' for migrated rows
);

create table if not exists consents (
  id         bigint generated always as identity primary key,
  person_id  bigint not null references people(id),
  given      boolean not null,                      -- true = subscribed, false = withdrawn
  at         timestamptz not null default now(),
  where_     text not null,                         -- page or flow, e.g. 'r/repos popup', 'unsubscribe link'
  wording    text not null,                         -- the exact words the person saw
  pre_ticked boolean not null default false
);
create index if not exists consents_person on consents(person_id, at desc);

create table if not exists unlocks (
  id        bigint generated always as identity primary key,
  person_id bigint not null references people(id),
  page_id   bigint not null references pages(id),
  at        timestamptz not null default now(),
  src_tag   text
);
create index if not exists unlocks_page on unlocks(page_id, at desc);

create table if not exists events (
  id        bigint generated always as identity primary key,
  page_id   bigint references pages(id),
  kind      text not null check (kind in ('view', 'unlock', 'outbound')),
  anon_id   text,
  at        timestamptz not null default now(),
  src_tag   text,
  target    text                                    -- outbound URL for clicks
);
create index if not exists events_page on events(page_id, kind, at desc);

-- Current newsletter state per person: their latest consent record
create or replace view newsletter_status as
  select distinct on (person_id) person_id, given as subscribed, at
  from consents order by person_id, at desc;

-- Only the server (service role) reads and writes; the public has no direct access.
alter table pages enable row level security;
alter table page_items enable row level security;
alter table people enable row level security;
alter table consents enable row level security;
alter table unlocks enable row level security;
alter table events enable row level security;
