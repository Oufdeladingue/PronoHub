import { NextRequest, NextResponse } from 'next/server'
import { isAllowedImageUrl } from '@/lib/safe-image-fetch'
import { loadOgFont } from '@/lib/og-fonts'
import satori from 'satori'
import sharp from 'sharp'
import path from 'path'
import fs from 'fs/promises'
import React from 'react'

// Police Inter mutualisée + mise en cache (lib/og-fonts) — évite de re-télécharger à chaque rendu
const loadFont = loadOgFont

// Télécharger une image et la convertir en base64 data URL
async function fetchImageAsBase64(url: string): Promise<string | null> {
  if (!url || !isAllowedImageUrl(url)) return null

  try {
    const response = await fetch(url, { redirect: 'manual', next: { revalidate: 3600 } })
    if (!response.ok) return null

    const buffer = await response.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const contentType = response.headers.get('content-type') || 'image/png'
    return `data:${contentType};base64,${base64}`
  } catch (e) {
    console.error('[OG-Badge] Error fetching image:', url, e)
    return null
  }
}

// Charger une image locale en base64
async function loadLocalImageAsBase64(relativePath: string): Promise<string | null> {
  try {
    const fullPath = path.join(process.cwd(), 'public', relativePath)
    const buffer = await fs.readFile(fullPath)
    const base64 = buffer.toString('base64')
    return `data:image/png;base64,${base64}`
  } catch (e) {
    console.error('[OG-Badge] Error loading local image:', relativePath, e)
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Paramètres
    const badgeName = searchParams.get('badgeName') || 'Trophée'
    const badgeDescription = searchParams.get('badgeDescription') || ''
    const badgeImagePath = searchParams.get('badgeImage') || '/trophy/default.png'
    const homeTeam = searchParams.get('home') || ''
    const awayTeam = searchParams.get('away') || ''
    const homeLogoUrl = searchParams.get('homeLogo') || ''
    const awayLogoUrl = searchParams.get('awayLogo') || ''
    const homeScore = searchParams.get('homeScore') || '0'
    const awayScore = searchParams.get('awayScore') || '0'
    const predictedHome = searchParams.get('predHome') || '0'
    const predictedAway = searchParams.get('predAway') || '0'
    const matchDate = searchParams.get('matchDate') || ''

    // Charger les polices
    let fontDataRegular: ArrayBuffer
    let fontDataBold: ArrayBuffer
    let fontDataBlack: ArrayBuffer
    try {
      ;[fontDataRegular, fontDataBold, fontDataBlack] = await Promise.all([
        loadFont(400),
        loadFont(700),
        loadFont(900),
      ])
    } catch (e) {
      return NextResponse.json({ error: 'Font loading failed' }, { status: 500 })
    }

    // Charger l'image de fond
    const bgPath = path.join(process.cwd(), 'public', 'images', 'og-badge-bg.png')
    let bgBuffer: Buffer
    try {
      bgBuffer = await fs.readFile(bgPath)
    } catch (e) {
      console.error('[OG-Badge] Background image not found:', bgPath)
      return NextResponse.json({ error: 'Background image not found' }, { status: 500 })
    }

    // Charger les images en parallèle
    const [badgeImageBase64, homeLogoBase64, awayLogoBase64] = await Promise.all([
      loadLocalImageAsBase64(badgeImagePath),
      homeLogoUrl ? fetchImageAsBase64(homeLogoUrl) : Promise.resolve(null),
      awayLogoUrl ? fetchImageAsBase64(awayLogoUrl) : Promise.resolve(null),
    ])

    // Formater la date du match
    let formattedDate = ''
    if (matchDate) {
      try {
        const d = new Date(matchDate)
        formattedDate = d.toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'short',
          timeZone: 'Europe/Paris',
        })
      } catch {
        formattedDate = ''
      }
    }

    const hasMatchInfo = homeTeam && awayTeam

    // Construire le layout
    const children: any[] = []

    children.push({
      type: 'div',
      props: {
        style: {
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px 40px',
          fontFamily: 'Inter',
          position: 'relative',
        },
        children: [
          // === BADGE SECTION (haut) ===
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                marginBottom: hasMatchInfo ? '12px' : '0',
              },
              children: [
                // Badge icon
                badgeImageBase64
                  ? {
                      type: 'img',
                      props: {
                        src: badgeImageBase64,
                        width: hasMatchInfo ? 160 : 220,
                        height: hasMatchInfo ? 160 : 220,
                      },
                    }
                  : {
                      type: 'div',
                      props: {
                        style: {
                          width: '160px',
                          height: '160px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '90px',
                        },
                        children: '🏅',
                      },
                    },
                // Badge name
                {
                  type: 'span',
                  props: {
                    style: {
                      fontSize: '48px',
                      fontWeight: 900,
                      color: '#f5b800',
                      textShadow: '0px 0px 20px rgba(245,184,0,0.5), 2px 2px 6px rgba(0,0,0,0.9)',
                      textAlign: 'center',
                    },
                    children: badgeName,
                  },
                },
                // Badge description
                badgeDescription
                  ? {
                      type: 'span',
                      props: {
                        style: {
                          fontSize: '26px',
                          fontWeight: 400,
                          color: '#e0e0e0',
                          textShadow: '1px 1px 4px rgba(0,0,0,0.8)',
                          textAlign: 'center',
                          maxWidth: '700px',
                        },
                        children: badgeDescription,
                      },
                    }
                  : null,
              ].filter(Boolean),
            },
          },
          // === MATCH SECTION (bas) ===
          ...(hasMatchInfo
            ? [
                {
                  type: 'div',
                  props: {
                    style: {
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '28px',
                      background: 'rgba(0,0,0,0.6)',
                      borderRadius: '16px',
                      padding: '18px 36px',
                    },
                    children: [
                      // Équipe domicile
                      {
                        type: 'div',
                        props: {
                          style: {
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '6px',
                          },
                          children: [
                            homeLogoBase64
                              ? {
                                  type: 'img',
                                  props: { src: homeLogoBase64, width: 64, height: 64 },
                                }
                              : {
                                  type: 'div',
                                  props: {
                                    style: { width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px' },
                                    children: '⚽',
                                  },
                                },
                            {
                              type: 'span',
                              props: {
                                style: {
                                  fontSize: '20px',
                                  fontWeight: 700,
                                  color: '#ffffff',
                                  maxWidth: '160px',
                                  textAlign: 'center',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  textShadow: '1px 1px 3px rgba(0,0,0,0.8)',
                                },
                                children: homeTeam,
                              },
                            },
                          ],
                        },
                      },
                      // Scores
                      {
                        type: 'div',
                        props: {
                          style: {
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '4px',
                          },
                          children: [
                            // Score réel
                            {
                              type: 'span',
                              props: {
                                style: {
                                  fontSize: '44px',
                                  fontWeight: 900,
                                  color: '#ffffff',
                                  textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                                },
                                children: `${homeScore} - ${awayScore}`,
                              },
                            },
                            // Pronostic
                            {
                              type: 'div',
                              props: {
                                style: {
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                },
                                children: [
                                  {
                                    type: 'span',
                                    props: {
                                      style: {
                                        fontSize: '18px',
                                        fontWeight: 400,
                                        color: '#94a3b8',
                                      },
                                      children: 'Prono :',
                                    },
                                  },
                                  {
                                    type: 'span',
                                    props: {
                                      style: {
                                        fontSize: '26px',
                                        fontWeight: 700,
                                        color: '#f5b800',
                                      },
                                      children: `${predictedHome} - ${predictedAway}`,
                                    },
                                  },
                                ],
                              },
                            },
                            // Date
                            formattedDate
                              ? {
                                  type: 'span',
                                  props: {
                                    style: {
                                      fontSize: '18px',
                                      fontWeight: 400,
                                      color: '#64748b',
                                    },
                                    children: formattedDate,
                                  },
                                }
                              : null,
                          ].filter(Boolean),
                        },
                      },
                      // Équipe extérieur
                      {
                        type: 'div',
                        props: {
                          style: {
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '6px',
                          },
                          children: [
                            awayLogoBase64
                              ? {
                                  type: 'img',
                                  props: { src: awayLogoBase64, width: 64, height: 64 },
                                }
                              : {
                                  type: 'div',
                                  props: {
                                    style: { width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px' },
                                    children: '⚽',
                                  },
                                },
                            {
                              type: 'span',
                              props: {
                                style: {
                                  fontSize: '20px',
                                  fontWeight: 700,
                                  color: '#ffffff',
                                  maxWidth: '160px',
                                  textAlign: 'center',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  textShadow: '1px 1px 3px rgba(0,0,0,0.8)',
                                },
                                children: awayTeam,
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              ]
            : []),
        ],
      },
    })

    // Générer le SVG avec satori
    const svg = await satori(
      {
        type: 'div',
        props: {
          style: {
            width: '100%',
            height: '100%',
            display: 'flex',
          },
          children: children,
        },
      } as React.ReactElement,
      {
        width: 1024,
        height: 512,
        fonts: [
          { name: 'Inter', data: fontDataRegular, weight: 400, style: 'normal' as const },
          { name: 'Inter', data: fontDataBold, weight: 700, style: 'normal' as const },
          { name: 'Inter', data: fontDataBlack, weight: 900, style: 'normal' as const },
        ],
      }
    )

    // Composer : fond + overlay
    const overlayPng = await sharp(Buffer.from(svg)).png().toBuffer()

    const finalImage = await sharp(bgBuffer)
      .resize(1024, 512, { fit: 'cover' })
      .composite([
        {
          input: overlayPng,
          top: 0,
          left: 0,
        },
      ])
      .png()
      .toBuffer()

    return new NextResponse(new Uint8Array(finalImage), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=60',
      },
    })
  } catch (error) {
    console.error('[OG-Badge] Error generating image:', error)
    return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 })
  }
}
