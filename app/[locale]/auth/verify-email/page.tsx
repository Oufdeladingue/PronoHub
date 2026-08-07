import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

export default async function VerifyEmailPage() {
  const t = await getTranslations('Auth')
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50 auth-page">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md text-center">
        <div className="mb-6">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
        </div>

        <h1 className="text-3xl font-bold mb-4 text-gray-900">
          {t('verifyEmail.title')}
        </h1>

        <p className="text-gray-600 mb-6">
          {t('verifyEmail.body')}
        </p>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            <strong>{t('verifyEmail.importantLabel')}</strong> {t('verifyEmail.importantBody')}
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            {t('verifyEmail.notReceived')}
          </p>
          <Link
            href="/auth/signup"
            className="inline-block px-4 py-2 text-sm text-green-600 hover:text-green-700 hover:underline"
          >
            {t('verifyEmail.resendLink')}
          </Link>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <Link
            href="/"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            {t('verifyEmail.backHome')}
          </Link>
        </div>
      </div>
    </div>
  )
}
