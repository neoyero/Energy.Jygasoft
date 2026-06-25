import {
  Globe,
  Megaphone,
  MessageCircle,
  MoreHorizontal,
  Users,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Mapa lead_canal -> icono lucide. Cubre EXACTAMENTE leadCanal.enumValues:
 * youtube, facebook, instagram, whatsapp, organico, directo, referido, otro.
 * Fallback a MoreHorizontal ante canales nuevos/nulos.
 */
const CANAL_ICON: Record<string, LucideIcon> = {
  youtube: Megaphone,
  facebook: Megaphone,
  instagram: Megaphone,
  whatsapp: MessageCircle,
  organico: Globe,
  directo: Globe,
  referido: Users,
  otro: MoreHorizontal,
}

/** Resuelve el icono del canal; fallback a MoreHorizontal. */
function iconForCanal(canal: string | null | undefined): LucideIcon {
  if (!canal) return MoreHorizontal
  return CANAL_ICON[canal] ?? MoreHorizontal
}

export interface CanalIconProps {
  /** Valor crudo del enum lead_canal (o null). */
  canal: string | null | undefined
  className?: string
}

/**
 * Icono pequeno por canal de adquisicion del lead. Componente puro (sin hooks):
 * util junto a <StatusBadge value={canal} /> en tablas y tarjetas.
 */
export function CanalIcon({ canal, className }: CanalIconProps) {
  const Icon = iconForCanal(canal)
  return (
    <Icon
      className={cn("size-4 text-stone-500 dark:text-muted-foreground", className)}
      aria-hidden
    />
  )
}
