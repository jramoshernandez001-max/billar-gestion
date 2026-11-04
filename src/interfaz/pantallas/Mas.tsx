/**
 * Pantalla "Más".
 *
 * Qué hace: reúne las secciones que no caben en la barra inferior (Ventas,
 * Compras, Productos, Cierres, Bitácora, Resúmenes) y muestra la cuenta con
 * la acción de cerrar sesión.
 * Cómo lo hace: una lista de botones que cambian de ruta.
 * Por qué: la barra inferior tiene cinco destinos; el resto vive aquí.
 */
import { BookOpen, ChartColumn, ChevronRight, ClipboardList, Package, Receipt, ShoppingCart } from 'lucide-react'
import type { ReactNode } from 'react'
import { Cabecera } from '../componentes/Cabecera'

interface Propiedades {
  correo: string
  alIr: (ruta: string) => void
  cerrarSesion: () => void
}

const SECCIONES: readonly { nombre: string; detalle: string; ruta: string; icono: ReactNode }[] = [
  { nombre: 'Ventas', detalle: 'Movimientos del negocio', ruta: 'mas/ventas', icono: <Receipt size={20} strokeWidth={1.5} aria-hidden="true" /> },
  { nombre: 'Compras', detalle: 'Historial de abastecimiento', ruta: 'mas/compras', icono: <ShoppingCart size={20} strokeWidth={1.5} aria-hidden="true" /> },
  { nombre: 'Productos', detalle: 'Catálogo y precios', ruta: 'mas/productos', icono: <Package size={20} strokeWidth={1.5} aria-hidden="true" /> },
  { nombre: 'Cierres', detalle: 'Cuadre diario y semanal', ruta: 'mas/cierres', icono: <ClipboardList size={20} strokeWidth={1.5} aria-hidden="true" /> },
  { nombre: 'Bitácora', detalle: 'Quién cambió qué', ruta: 'mas/bitacora', icono: <BookOpen size={20} strokeWidth={1.5} aria-hidden="true" /> },
  { nombre: 'Resúmenes', detalle: 'Próximamente', ruta: 'mas/resumenes', icono: <ChartColumn size={20} strokeWidth={1.5} aria-hidden="true" /> },
]

export function Mas({ correo, alIr, cerrarSesion }: Propiedades) {
  return (
    <>
      <Cabecera titulo="Más" subtitulo="Secciones y cuenta" />
      <div className="marco__contenido">
        {SECCIONES.map((s) => (
          <button key={s.ruta} type="button" className="tarjeta tarjeta--boton fila-menu" onClick={() => alIr(s.ruta)}>
            {s.icono}
            <span className="fila-menu__texto">
              <span className="renglones__descripcion">{s.nombre}</span>
              <span className="texto-suave">{s.detalle}</span>
            </span>
            <ChevronRight size={18} strokeWidth={1.5} aria-hidden="true" />
          </button>
        ))}
        <article className="tarjeta">
          <span className="campo__etiqueta">Cuenta</span>
          <span>{correo}</span>
        </article>
        <button type="button" className="boton boton--peligro-texto" onClick={cerrarSesion}>Cerrar sesión</button>
      </div>
    </>
  )
}
