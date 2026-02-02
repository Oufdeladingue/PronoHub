import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import path from 'path'

config({ path: path.join(process.cwd(), '.env.local') })

console.log('Starting script...')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

console.log('Supabase client created')

async function test() {
  console.log('Testing connection...')

  const { data, error, count } = await supabase
    .from('tournaments')
    .select('id, name, status', { count: 'exact' })
    .in('status', ['active', 'warmup'])
    .limit(5)

  console.log('Query executed')
  console.log('Count:', count)
  console.log('Error:', error)
  console.log('Data:', data)
}

test()
  .then(() => {
    console.log('Done')
    process.exit(0)
  })
  .catch(err => {
    console.error('Error:', err)
    process.exit(1)
  })
