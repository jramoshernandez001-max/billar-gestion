/**
 * Pantalla "Productos" (catálogo).
 *
 * Qué hace: lista los productos con su presentación y precios, permite buscar
 * por nombre y lleva a crear uno nuevo o a editar uno existente.
 * Cómo lo hace: carga los productos y `resumirProductos` (aplicacion) filtra y
 * describe; las acciones cambian de ruta.
 * Por qué: el catálogo es el origen de ventas y compras; cambiar un precio
 * aquí no altera ventas pasadas porque cada venta guarda su precio cobrado.
 */
import { useCallback, useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { resumirProductos } from '../../aplicacion/resumenProductos'
import type { FiltroCategoria } from '../../domain/inventario/categorias'
import { FiltroDeCategoria } from '../componentes/FiltroDeCategoria'
import type { RepositorioInventario } from '../../datos/inventario'
import { CabeceraInterna } from '../componentes/CabeceraInterna'
import { EstadoDeCarga } from '../componentes/EstadoDeCarga'
import { formatoPesos } from '../formato'
import { useCarga } from '../useCarga'

/** Servicios que necesita la pantalla. */
export interface ServiciosProductos {
  inventario: Pick<RepositorioInventario, 'listarProductos'>
}

interface Propiedades {
  servicios: ServiciosProductos
  alIr: (ruta: string) => void
}

export function Productos({ servicios, alIr }: Propiedades) {
  const cargar = useCallback(() => servicios.inventario.listarProductos(), [servicios])
  const { estado, datos, error, recargar } = useCarga(cargar)
  const [busqueda, setBusqueda] = useState('')
  const [categoria, setCategoria] = useState<FiltroCategoria>('todas')
  const filas = useMemo(() => (datos === null ? null : resumirProductos(datos, busqueda, categoria)), [datos, busqueda, categoria])

  const cabecera = <CabeceraInterna titulo="Productos" subtitulo="Catálogo y precios" alVolver={() => alIr('mas')} />
  if (filas === null) {
    return (
      <>
        {cabecera}
        <div className="marco__contenido">
          <EstadoDeCarga estado={estado === 'error' ? 'error' : 'cargando'} error={error} que="los productos" reintentar={recargar} />
        </div>
      </>
    )
  }

  return (
    <>
      {cabecera}
      <div className="marco__contenido">
        <button type="button" className="boton boton--primario" onClick={() => alIr('mas/productos/nuevo')}>
          <Plus size={18} strokeWidth={1.5} aria-hidden="true" /> Nuevo producto
        </button>
        <label className="entrada entrada--busqueda">
          <Search size={18} strokeWidth={1.5} className="entrada__icono" aria-hidden="true" />
          <input
            type="search"
            className="entrada__control"
            placeholder="Buscar producto"
            aria-label="Buscar producto"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </label>

        <FiltroDeCategoria valor={categoria} alCambiar={setCategoria} />

        {filas.length === 0 && <p className="estado">{datos?.length === 0 ? 'Todavía no hay productos.' : 'No hay productos con ese nombre o categoría.'}</p>}
        {filas.map((f) => (
          <article key={f.id} className="tarjeta" aria-label={f.nombre}>
            <p className="renglones__descripcion">{f.nombre}</p>
            <p className="texto-suave">{f.detalle}</p>
            <div className="dato">
              <span className="dato__etiqueta">{f.categoria === 'licor' ? 'Botella' : 'Unidad'}</span>
              <span className="dato__valor">{formatoPesos(f.precioUnidad)}</span>
            </div>
            {f.categoria !== 'licor' && (
              <div className="dato">
                <span className="dato__etiqueta">Caja</span>
                <span className="dato__valor">{formatoPesos(f.precioCaja)}</span>
              </div>
            )}
            <button type="button" className="boton" onClick={() => alIr(`mas/productos/editar/${f.id}`)}>Editar</button>
          </article>
        ))}
      </div>
    </>
  )
}
