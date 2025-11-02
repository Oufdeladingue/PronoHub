import { UserRole } from '@/types'

// Vérifier si l'utilisateur a un rôle spécifique ou supérieur
export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  const roleHierarchy: Record<UserRole, number> = {
    user: 0,
    admin: 1,
    super_admin: 2,
  }

  return roleHierarchy[userRole] >= roleHierarchy[requiredRole]
}

// Vérifier si l'utilisateur est admin (admin ou super_admin)
export function isAdmin(userRole: UserRole): boolean {
  return hasRole(userRole, 'admin')
}

// Vérifier si l'utilisateur est super admin
export function isSuperAdmin(userRole: UserRole): boolean {
  return userRole === 'super_admin'
}

// Obtenir le libellé du rôle en français
export function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    user: 'Utilisateur',
    admin: 'Administrateur',
    super_admin: 'Super Administrateur',
  }

  return labels[role]
}

// Obtenir le badge de couleur pour le rôle
export function getRoleBadgeColor(role: UserRole): string {
  const colors: Record<UserRole, string> = {
    user: 'bg-gray-100 text-gray-800',
    admin: 'bg-blue-100 text-blue-800',
    super_admin: 'bg-purple-100 text-purple-800',
  }

  return colors[role]
}
