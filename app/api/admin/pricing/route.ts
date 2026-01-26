import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET: Recuperer tous les prix
export async function GET() {
  try {
    const supabase = await createClient()

    const { data: pricing, error } = await supabase
      .from('pricing_config')
      .select('*')
      .eq('is_active', true)
      .order('category')
      .order('sort_order')

    if (error) throw error

    // Grouper par categorie
    const grouped = (pricing || []).reduce((acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = []
      }
      acc[item.category].push(item)
      return acc
    }, {} as Record<string, typeof pricing>)

    return NextResponse.json({
      success: true,
      pricing,
      grouped
    })
  } catch (error: any) {
    console.error('Error fetching pricing:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// POST: Mettre a jour les prix
export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Verifier l'authentification
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Non authentifie' },
        { status: 401 }
      )
    }

    // Verifier que l'utilisateur est super admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'super_admin') {
      return NextResponse.json(
        { success: false, error: 'Acces refuse - Super admin requis' },
        { status: 403 }
      )
    }

    // Recuperer les prix a mettre a jour
    const body = await request.json()
    const { updates } = body

    if (!updates || !Array.isArray(updates)) {
      return NextResponse.json(
        { success: false, error: 'Format de donnees invalide' },
        { status: 400 }
      )
    }

    // Mettre a jour chaque prix
    const results = []
    for (const update of updates) {
      const { config_key, config_value } = update

      if (!config_key || config_value === undefined) {
        results.push({ config_key, success: false, error: 'Donnees manquantes' })
        continue
      }

      const { error } = await supabase
        .from('pricing_config')
        .update({
          config_value: parseFloat(config_value),
          updated_at: new Date().toISOString()
        })
        .eq('config_key', config_key)

      if (error) {
        results.push({ config_key, success: false, error: error.message })
      } else {
        results.push({ config_key, success: true })
      }
    }

    const allSuccess = results.every(r => r.success)

    return NextResponse.json({
      success: allSuccess,
      message: allSuccess
        ? 'Prix mis a jour avec succes'
        : 'Certains prix n\'ont pas pu etre mis a jour',
      results
    })
  } catch (error: any) {
    console.error('Error updating pricing:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
