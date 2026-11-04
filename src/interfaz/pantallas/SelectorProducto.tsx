/**
 * Pantalla "Elegir producto" (para un renglón de la venta).
 *
 * Qué hace: lista los productos con su precio por unidad, las unidades por
 * caja y lo que hay en la nevera; permite buscar por nombre y elegir uno.
 * Cómo lo hace: filtra la lista con un texto sin mayúsculas ni tildes, marca
 * el producto ya elegido y avisa cuál se toca; no sabe nada de la venta.
 * Por qué: es solo la presentación; la venta decide qué hacer con el
 * producto. El diseño muestra el tamaño ("330 ml"), pero la base aún no lo
 * guarda; por eso solo se muestran las unidades por caja.
 * El color del stock: rojo si es negativo (falta un registro), ámbar si es
 * cero, normal en los demás casos (no hay stock mínimo por producto).
 */
import { useId, useState } from 'react'
import { Beer, Circle, CircleCheck, Search } from 'lucide-react'
import { CabeceraInterna } from '../componentes/CabeceraInterna'
import { formatoPesos } from '../formato'

/** Un producto elegible, con lo que hay en la nevera. */
export interface OpcionProducto {
  id: string
  nombre: string
  unidadesPorCaja: number
  precioUnidad: number
  /** Unidades en la nevera (puede ser negativo si falta un registro). */
  enNevera: number
}

interface Propiedades {
  opciones: readonly OpcionProducto[]
  /** Producto ya elegido en el renglón, si lo hay. */
  seleccionado: string | null
  alElegir: (productoId: string) => void
  alVolver: () => void
}

/** Texto en minúsculas y sin tildes, para comparar nombres al buscar. */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()
}

/** "4 en nevera" o "−2 en nevera" (con el signo menos tipográfico). */
function textoNevera(unidades: number): string {
  return `${unidades < 0 ? '−' : ''}${Math.abs(unidades)} en nevera`
}

/** Clase de color del stock según su valor. */
function claseStock(unidades: number): string {
  if (unidades < 0) return 'producto__stock producto__stock--negativo'
  if (unidades === 0) return 'producto__stock producto__stock--cero'
  return 'producto__stock'
}

export function SelectorProducto({ opciones, seleccionado, alElegir, alVolver }: Propiedades) {
  const [busqueda, setBusqueda] = useState('')
  const idBusqueda = useId()
  const buscado = normalizar(busqueda)
  const resultados = opciones.filter((o) => normalizar(o.nombre).includes(buscado))

  return (
    <>
      <CabeceraInterna titulo="Elegir producto" subtitulo="Para tu nueva venta" alVolver={alVolver} />
      <div className="marco__contenido">
        <div className="campo">
          <label className="campo__etiqueta" htmlFor={idBusqueda}>Buscar producto</label>
          <div className="entrada">
            <input
              id={idBusqueda}
              type="search"
              className="entrada__control"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              autoComplete="off"
            />
            <Search size={18} strokeWidth={1.5} className="entrada__icono" aria-hidden="true" />
          </div>
        </div>
        <p className="texto-suave">
          {resultados.length} {resultados.length === 1 ? 'resultado' : 'resultados'} · Precios por unidad
        </p>
        {resultados.length === 0 ? (
          <p className="estado">No hay productos con ese nombre.</p>
        ) : (
          <div className="tarjeta" role="radiogroup" aria-label="Productos">
            {resultados.map((o) => (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={o.id === seleccionado}
                className="producto"
                onClick={() => alElegir(o.id)}
              >
                <span className={`producto__simbolo${o.id === seleccionado ? ' producto__simbolo--activo' : ''}`}>
                  <Beer size={20} strokeWidth={1.5} />
                </span>
                <span className="producto__info">
                  <span className="producto__nombre">{o.nombre}</span>
                  <span className="producto__detalle">{o.unidadesPorCaja} unid/caja</span>
                  <span className={claseStock(o.enNevera)}>{textoNevera(o.enNevera)}</span>
                </span>
                <span className="producto__seleccion">
                  <span className="producto__precio">{formatoPesos(o.precioUnidad)}</span>
                  {o.id === seleccionado ? (
                    <CircleCheck size={20} strokeWidth={1.5} className="producto__marca--activa" />
                  ) : (
                    <Circle size={20} strokeWidth={1.5} className="producto__marca" />
                  )}
                </span>
              </button>
            ))}
          </div>
        )}
        <p className="texto-suave">Elige un producto para volver al renglón. La presentación se selecciona en la venta.</p>
      </div>
    </>
  )
}
