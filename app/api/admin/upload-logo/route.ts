import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Client Supabase avec service role (bypass RLS)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const competitionId = formData.get('competitionId') as string
    const type = formData.get('type') as 'white' | 'color'

    if (!file || !competitionId || !type) {
      return NextResponse.json(
        { error: 'Paramètres manquants' },
        { status: 400 }
      )
    }

    // Vérifier le type de fichier
    const allowedTypes = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Type de fichier non autorisé. Utilisez SVG, PNG, JPG ou WEBP.' },
        { status: 400 }
      )
    }

    // Vérifier la taille (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Fichier trop volumineux. Maximum 5MB.' },
        { status: 400 }
      )
    }

    // Nom du fichier unique
    const fileExt = file.name.split('.').pop()
    const fileName = `${competitionId}_${type}_${Date.now()}.${fileExt}`
    const filePath = `${fileName}`

    // Convertir le File en ArrayBuffer puis en Buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload vers Supabase Storage avec service role
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('competition-logos')
      .upload(filePath, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      console.error('Erreur upload:', uploadError)
      return NextResponse.json(
        { error: uploadError.message },
        { status: 500 }
      )
    }

    // Récupérer l'URL publique
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('competition-logos')
      .getPublicUrl(filePath)

    // Mettre à jour la base de données
    const columnName = type === 'white' ? 'custom_emblem_white' : 'custom_emblem_color'
    const { error: updateError } = await supabaseAdmin
      .from('competitions')
      .update({ [columnName]: publicUrl })
      .eq('id', parseInt(competitionId))

    if (updateError) {
      console.error('Erreur update DB:', updateError)
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      publicUrl,
      message: `Logo ${type === 'white' ? 'blanc' : 'couleur'} uploadé avec succès !`
    })

  } catch (error: any) {
    console.error('Erreur API:', error)
    return NextResponse.json(
      { error: error.message || 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}
