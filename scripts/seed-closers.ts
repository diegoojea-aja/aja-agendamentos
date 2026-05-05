import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const closers = [
  {
    name: 'Elisa Buzi',
    email: 'elisabuzi@ajaeducacao.com.br',
    slug: 'elisa',
    active: true,
    duration_options: [30, 60],
    working_hours: {
      start: '09:00',
      end: '19:00',
      lunch_start: '12:00',
      lunch_end: '13:00',
      days: [1, 2, 3, 4, 5],
    },
    buffer_minutes: 15,
  },
  {
    name: 'Mayara Lopes',
    email: 'mayaralopes@ajaeducacao.com.br',
    slug: 'mayara',
    active: true,
    duration_options: [30, 60],
    working_hours: {
      start: '09:00',
      end: '19:00',
      lunch_start: '12:00',
      lunch_end: '13:00',
      days: [1, 2, 3, 4, 5],
    },
    buffer_minutes: 15,
  },
  {
    name: 'João Vitor Anjos',
    email: 'joao.anjos@ajaeducacao.com.br',
    slug: 'joao',
    active: true,
    duration_options: [30, 60],
    working_hours: {
      start: '09:00',
      end: '19:00',
      lunch_start: '12:00',
      lunch_end: '13:00',
      days: [1, 2, 3, 4, 5],
    },
    buffer_minutes: 15,
  },
]

async function seed() {
  console.log('🌱 Seeding closers...')

  for (const closer of closers) {
    const { data: existing } = await supabase
      .from('closers')
      .select('id')
      .eq('email', closer.email)
      .maybeSingle()

    if (existing) {
      const { error } = await supabase
        .from('closers')
        .update(closer)
        .eq('id', existing.id)
      if (error) {
        console.error(`❌ ${closer.name}:`, error.message)
      } else {
        console.log(`📝 ${closer.name} atualizada`)
      }
    } else {
      const { error } = await supabase.from('closers').insert(closer)
      if (error) {
        console.error(`❌ ${closer.name}:`, error.message)
      } else {
        console.log(`✅ ${closer.name} criada`)
      }
    }
  }

  console.log('\n🔗 Acesse: /agendar')
}

seed()
