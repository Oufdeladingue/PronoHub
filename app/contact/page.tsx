'use client'

import { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Building2, Send, Check, Loader2 } from 'lucide-react'

function ContactForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const type = searchParams.get('type')

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    participants: '100',
    message: '',
    type: type || 'general',
  })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Pour l'instant, on simule l'envoi
      // TODO: Integrer avec un service d'email (SendGrid, Resend, etc.)
      await new Promise(resolve => setTimeout(resolve, 1500))
      setSuccess(true)
    } catch (error) {
      console.error('Error submitting form:', error)
      alert('Erreur lors de l\'envoi du message')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold mb-4">Message envoye !</h1>
          <p className="text-gray-400 mb-8">
            Merci pour votre message. Notre equipe vous recontactera dans les plus brefs delais.
          </p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-orange-500 hover:bg-orange-400 rounded-lg font-medium transition-colors"
          >
            Retour a l'accueil
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white py-16 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          {type === 'enterprise' && (
            <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-purple-500" />
            </div>
          )}
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            {type === 'enterprise' ? 'Offre Entreprise' : 'Contactez-nous'}
          </h1>
          <p className="text-gray-400 max-w-xl mx-auto">
            {type === 'enterprise'
              ? 'Organisez un tournoi a grande echelle avec votre branding personnalise. Remplissez le formulaire et notre equipe vous contactera.'
              : 'Une question, une suggestion ? N\'hesitez pas a nous contacter.'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2">Nom complet</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition"
                placeholder="Jean Dupont"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition"
                placeholder="jean@entreprise.com"
              />
            </div>
          </div>

          {type === 'enterprise' && (
            <>
              <div>
                <label className="block text-sm font-medium mb-2">Nom de l'entreprise</label>
                <input
                  type="text"
                  required
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition"
                  placeholder="Entreprise SA"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Nombre de participants estime</label>
                <select
                  value={formData.participants}
                  onChange={(e) => setFormData({ ...formData, participants: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition"
                >
                  <option value="50">Moins de 50</option>
                  <option value="100">50 - 100</option>
                  <option value="200">100 - 200</option>
                  <option value="300">200 - 300</option>
                  <option value="500">Plus de 300 (nous contacter)</option>
                </select>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">Message</label>
            <textarea
              required
              rows={5}
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition resize-none"
              placeholder={type === 'enterprise'
                ? 'Decrivez votre projet : competition visee, periode, besoins specifiques...'
                : 'Votre message...'}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 rounded-lg font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Send className="w-5 h-5" />
                Envoyer
              </>
            )}
          </button>
        </form>

        {/* Enterprise features */}
        {type === 'enterprise' && (
          <div className="mt-12 pt-12 border-t border-gray-700">
            <h2 className="text-xl font-bold mb-6 text-center">L'offre Entreprise inclut</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <FeatureItem
                title="Jusqu'a 300 participants"
                description="Gerez un grand nombre de collegues ou clients"
              />
              <FeatureItem
                title="Branding personnalise"
                description="Votre logo et vos couleurs sur le tournoi"
              />
              <FeatureItem
                title="Competition dediee"
                description="Choisissez votre competition (Ligue 1, Euro, etc.)"
              />
              <FeatureItem
                title="Support prioritaire"
                description="Une equipe dediee pour vous accompagner"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function FeatureItem({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-6 h-6 bg-purple-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
        <Check className="w-4 h-4 text-purple-500" />
      </div>
      <div>
        <h3 className="font-medium">{title}</h3>
        <p className="text-sm text-gray-400">{description}</p>
      </div>
    </div>
  )
}

function ContactLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
    </div>
  )
}

export default function ContactPage() {
  return (
    <Suspense fallback={<ContactLoading />}>
      <ContactForm />
    </Suspense>
  )
}
