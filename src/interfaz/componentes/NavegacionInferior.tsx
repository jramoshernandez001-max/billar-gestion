/**
 * Navegación inferior.
 *
 * Qué hace: muestra las cinco pestañas (Inicio, Vender, Inventario, Deudas,
 * Más), resalta la activa y avisa a qué ruta ir al tocar una.
 * Cómo lo hace: una lista de destinos fija con su ícono (Lucide, como en el
 * diseño de Figma); la pestaña activa recibe `aria-current="page"`.
 * Por qué: es la forma de moverse por la app con una mano en el celular.
 */
import { CirclePlus, Ellipsis, House, Package, Wallet, type LucideIcon } from 'lucide-react'
import type { Pestana } from '../ruta'

interface Destino {
  pestana: Pestana
  nombre: string
  Icono: LucideIcon
}

const DESTINOS: readonly Destino[] = [
  { pestana: 'inicio', nombre: 'Inicio', Icono: House },
  { pestana: 'vender', nombre: 'Vender', Icono: CirclePlus },
  { pestana: 'inventario', nombre: 'Inventario', Icono: Package },
  { pestana: 'deudas', nombre: 'Deudas', Icono: Wallet },
  { pestana: 'mas', nombre: 'Más', Icono: Ellipsis },
]

interface Propiedades {
  /** Pestaña resaltada; null si la pantalla no pertenece a ninguna. */
  activa: Pestana | null
  alIr: (ruta: string) => void
}

export function NavegacionInferior({ activa, alIr }: Propiedades) {
  return (
    <nav className="navegacion" aria-label="Principal">
      <div className="navegacion__destinos">
        {DESTINOS.map(({ pestana, nombre, Icono }) => (
          <button
            key={pestana}
            type="button"
            className={`destino${pestana === activa ? ' destino--activo' : ''}`}
            aria-current={pestana === activa ? 'page' : undefined}
            onClick={() => alIr(pestana)}
          >
            <span className="destino__indicador">
              <Icono size={20} strokeWidth={1.5} aria-hidden="true" />
            </span>
            {nombre}
          </button>
        ))}
      </div>
      <div className="navegacion__barra" aria-hidden="true" />
    </nav>
  )
}
