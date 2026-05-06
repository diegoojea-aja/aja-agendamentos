/**
 * Sub-layout do ambiente Agendamentos.
 *
 * Navegação foi consolidada na sidebar global (AppShell). Esse layout
 * é só passthrough hoje — mantido pra preservar o segmento da rota
 * e permitir adições futuras (ex: breadcrumbs específicos).
 */
export default function AgendamentosLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
