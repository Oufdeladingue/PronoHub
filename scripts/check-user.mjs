import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://txpmihreaxmtsxlgmdko.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const EMAIL = 'oussamatamon494@gmail.com'

async function check() {
  // 1. Check auth.users
  const { data: authUsers } = await supabase.auth.admin.listUsers()
  const user = authUsers?.users?.find(u => u.email === EMAIL)

  if (!user) {
    console.log('AUTH: Aucun compte trouvé pour', EMAIL)
    return
  }

  console.log('AUTH USER:')
  console.log('  id:', user.id)
  console.log('  email:', user.email)
  console.log('  created_at:', user.created_at)
  console.log('  email_confirmed_at:', user.email_confirmed_at)
  console.log('  last_sign_in_at:', user.last_sign_in_at)
  console.log('  provider:', user.app_metadata?.provider)
  console.log('  providers:', user.app_metadata?.providers)

  // 2. Check profiles
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profile) {
    console.log('\nPROFILE:')
    console.log('  username:', profile.username)
    console.log('  has_chosen_username:', profile.has_chosen_username)
    console.log('  role:', profile.role)
    console.log('  last_seen_at:', profile.last_seen_at)
    console.log('  country:', profile.country)
    console.log('  created_at:', profile.created_at)
  } else {
    console.log('\nPROFILE: Aucun profil trouvé -', profileErr?.message)
  }

  // 3. Check notification_logs
  const { data: logs } = await supabase
    .from('notification_logs')
    .select('type, channel, status, sent_at')
    .eq('user_id', user.id)
    .order('sent_at', { ascending: false })
    .limit(10)

  console.log('\nNOTIFICATION LOGS:', logs?.length || 0, 'entries')
  if (logs) {
    for (const l of logs) {
      console.log(' ', l.type, l.channel, l.status, l.sent_at)
    }
  }
}

check().catch(console.error)
