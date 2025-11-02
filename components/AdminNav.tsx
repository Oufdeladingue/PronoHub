'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function AdminNav() {
  const pathname = usePathname()

  const navItems = [
    { name: 'Général', href: '/admin' },
    { name: 'Import', href: '/admin/import' },
    { name: 'Réglages', href: '/admin/settings' },
  ]

  return (
    <div className="bg-purple-600 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4">
        {/* Badge Super Admin */}
        <div className="py-2 border-b border-purple-500">
          <span className="text-sm font-medium bg-purple-500 px-3 py-1 rounded-full">
            Connecté en tant que SuperAdmin
          </span>
        </div>

        {/* Menu de navigation */}
        <nav className="flex space-x-1 py-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/admin' && pathname?.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-4 py-2 rounded-lg transition ${
                  isActive
                    ? 'bg-purple-700 font-semibold'
                    : 'hover:bg-purple-500'
                }`}
              >
                {item.name}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
