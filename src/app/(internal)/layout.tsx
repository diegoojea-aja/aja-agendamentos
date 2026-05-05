import { AppShell } from '@/components/AppShell'

/**
 * Layout das rotas internas (autenticadas) do AJA.
 * Inclui sidebar role-aware com Formulários, Agendamentos e admin geral.
 */
export default function InternalLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}
