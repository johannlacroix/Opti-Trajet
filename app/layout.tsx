import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Opti-Trajet - Optimisation de trajets',
  description: 'Application d\'optimisation de trajets pour chauffeurs accompagnateurs',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}
