-- ═══════════════════════════════════════════════════════════════════════════
-- Schema inicial do AJA Agendamentos
-- Consolidação das migrations 005, 006, 007, 008, 010, 011, 012 do forms-aja
-- (que viviam misturadas com migrations de Forms — aqui só o necessário).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── user_profiles (replicado do forms-aja) ────────────────────────────────
-- Espelhada do projeto forms-aja. Cada app mantém sua própria cópia (auth
-- replicado). Sincronização manual via script.
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'sdr', 'comercial', 'cs', 'eventos', 'closer')),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_profiles_email_idx ON user_profiles(email);
CREATE INDEX IF NOT EXISTS user_profiles_role_idx ON user_profiles(role);

-- ─── closers (profissionais que recebem agendamentos) ─────────────────────
CREATE TABLE IF NOT EXISTS closers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  photo_url TEXT,
  active BOOLEAN DEFAULT true,
  duration_options JSONB DEFAULT '[30, 60]'::jsonb,
  working_hours JSONB DEFAULT '{"start":"09:00","end":"19:00","lunch_start":"12:00","lunch_end":"13:00","days":[1,2,3,4,5]}'::jsonb,
  buffer_minutes INTEGER DEFAULT 15,
  -- routing fields (era migration 010)
  weight INTEGER DEFAULT 1 CHECK (weight >= 0),
  slack_user_id TEXT,
  accepts_products TEXT[] DEFAULT '{}',
  -- routing por qualificação (era migration 012)
  accepts_scores TEXT[] DEFAULT '{}',
  last_assigned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS closers_last_assigned_idx
  ON closers(last_assigned_at NULLS FIRST)
  WHERE active = true;

-- ─── bookings (agendamentos) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  closer_id UUID NOT NULL REFERENCES closers(id),
  -- Lead info (Zoho CRM)
  lead_name TEXT NOT NULL,
  lead_email TEXT,
  lead_phone TEXT,
  lead_produto TEXT,
  zoho_id TEXT,
  sdr_name TEXT,
  sdr_user_id UUID REFERENCES user_profiles(id),
  sdr_note TEXT,
  lead_score TEXT,
  lead_registered_at DATE,
  funnel TEXT DEFAULT 'Sessão',
  observations TEXT,
  -- Slot
  date DATE NOT NULL,
  time_start TIME NOT NULL,
  time_end TIME NOT NULL,
  duration INTEGER NOT NULL,
  -- Status + tracking
  status TEXT DEFAULT 'confirmed'
    CHECK (status IN ('confirmed', 'completed', 'no_show', 'cancelled', 'rescheduled', 'lost')),
  status_marked_at TIMESTAMPTZ,
  status_marked_by UUID,
  lost_reason TEXT,
  rescheduled_from_id UUID REFERENCES bookings(id),
  -- Google Calendar
  google_event_id TEXT,
  meet_link TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bookings_closer_date ON bookings(closer_id, date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS bookings_pending_review_idx
  ON bookings(date, status)
  WHERE status = 'confirmed';
CREATE INDEX IF NOT EXISTS bookings_sdr_user_idx
  ON bookings(sdr_user_id, date DESC)
  WHERE sdr_user_id IS NOT NULL;
