/**
 * Pantalla "Inventario".
 *
 * Qué hace: lista los productos con lo que hay en bodega, en nevera y en
 * total, marca los de stock negativo y da acceso a trasladar, ajustar,
 * comprar y editar cada producto. Se puede buscar por nombre.
 * Cómo lo hace: carga productos y stock, los combina con `resumirInventario`
 * (aplicacion) y dibuja una tarjeta por producto; las acciones llevan a la
 * ruta del producto (`inventario/<acción>/<id>`).
 * Por qué: el stock nunca se edita, es la suma de movimientos; un negativo
 * señala un registro faltante y no se oculta. El diseño muestra además "Stock
 * bajo" y el tamaño ("330 ml"), pero la base no guarda stock mínimo ni
 * tamaño: por ahora se muestra el equivalente en cajas, sixpacks y sueltas.
 */
import { useCallback, useMemo, useState } from 'react'
import { CircleAlert, Search } from 'lucide-react'
import { resumirInventario, type FilaInventario } from '../../aplicacion/resumenInventario'
import type { RepositorioInventario } from '../../datos/inventario'
import { filtrarPorCategoria, type FiltroCategoria } from '../../domain/inventario/categorias'
import { FiltroDeCategoria } from '../componentes/FiltroDeCategoria'
import { NOMBRE_NEGOCIO } from '../../configuracion/negocio'
import { Cabecera } from '../componentes/Cabecera'
import { describirEquivalente, horaLocal } from '../formato'
import { useCarga } from '../useCarga'

/** Servicios que necesita la pantalla. */
export interface ServiciosInventario {
  inventario: Pick<RepositorioInventario, 'listarProductos' | 'obtenerStock'>
}

interface Propiedades {
  servicios: ServiciosInventario
  alIr: (ruta: string) => void
}

const ACCIONES = [
  { nombre: 'Trasladar', ruta: 'trasladar' },
  { nombre: 'Ajustar', ruta: 'ajustar' },
  { nombre: 'Comprar', ruta: 'comprar' },
  { nombre: 'Editar', ruta: 'editar' },
] as const

/** Texto en minúsculas y sin tildes, para comparar nombres al buscar. */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()
}

/** Una cantidad de una ubicación; en rojo si es negativa. */
function Existencia({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <div className="existencia">
      <span className="existencia__etiqueta">{etiqueta}</span>
      <span className={`existencia__valor${valor < 0 ? ' existencia__valor--negativo' : ''}`}>{valor}</span>
    </div>
  )
}

function Tarjeta({ fila, alIr }: { fila: FilaInventario; alIr: (ruta: string) => void }) {
  return (
    <article className="tarjeta" aria-label={fila.nombre}>
      <div className="producto-fila">
        <div className="producto-fila__identificacion">
          <span className="producto-fila__nombre">{fila.nombre}</span>
          {fila.equivalente !== null && <span className="texto-suave">{describirEquivalente(fila.equivalente)}</span>}
        </div>
        {fila.negativo && <span className="estado-etiqueta estado-etiqueta--negativo">Negativo</span>}
      </div>
      <div className="existencias">
        <Existencia etiqueta="Bodega" valor={fila.bodega} />
        <Existencia etiqueta="Nevera" valor={fila.nevera} />
        <Existencia etiqueta="Total" valor={fila.total} />
      </div>
      <div className="division" />
      <div className="acciones-producto">
        {ACCIONES.map((a) => (
          <button key={a.ruta} type="button" className="enlace" onClick={() => alIr(`inventario/${a.ruta}/${fila.productoId}`)}>
            {a.nombre}
          </button>
        ))}
      </div>
    </article>
  )
}

export function Inventario({ servicios, alIr }: Propiedades) {
  const cargar = useCallback(async () => {
    const [productos, stock] = await Promise.all([
      servicios.inventario.listarProductos(),
      servicios.inventario.obtenerStock(),
    ])
    return { productos, stock, cargadoEn: new Date().toISOString() }
  }, [servicios])
  const { estado, datos, error, recargar } = useCarga(cargar)
  const [busqueda, setBusqueda] = useState('')
  const [categoria, setCategoria] = useState<FiltroCategoria>('todas')

  const filas = useMemo(
    () => (datos === null ? [] : resumirInventario(datos.productos, datos.stock)),
    [datos],
  )

  if (estado !== 'listo' || datos === null) {
    return (
      <>
        <Cabecera titulo="Inventario" subtitulo={NOMBRE_NEGOCIO} />
        <div className="marco__contenido">
          {estado === 'cargando' ? (
            <p role="status" className="estado">Cargando…</p>
          ) : (
            <>
              <div className="aviso aviso--error">
                <div className="aviso__mensaje">
                  <span className="aviso__titulo">No se pudo cargar el inventario</span>
                  <span role="alert">{error}</span>
                </div>
              </div>
              <button type="button" className="boton" onClick={recargar}>Reintentar</button>
            </>
          )}
        </div>
      </>
    )
  }

  const buscado = normalizar(busqueda)
  const visibles = filtrarPorCategoria(filas, categoria).filter((f) => normalizar(f.nombre).includes(buscado))
  const negativos = filas.filter((f) => f.negativo).length

  return (
    <>
      <Cabecera
        titulo="Inventario"
        subtitulo={`${filas.length} ${filas.length === 1 ? 'producto' : 'productos'} · Stock en unidades`}
      />
      <div className="marco__contenido">
        <div className="campo">
          <label className="campo__etiqueta" htmlFor="buscar-inventario">Buscar</label>
          <div className="entrada">
            <input
              id="buscar-inventario"
              type="search"
              className="entrada__control"
              placeholder="Nombre del producto"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              autoComplete="off"
            />
            <Search size={18} strokeWidth={1.5} className="entrada__icono" aria-hidden="true" />
          </div>
        </div>

        <FiltroDeCategoria valor={categoria} alCambiar={setCategoria} />

        {negativos > 0 && (
          <div className="aviso">
            <CircleAlert size={18} strokeWidth={1.5} aria-hidden="true" />
            <div className="aviso__mensaje">
              <span className="aviso__titulo">
                {negativos} {negativos === 1 ? 'producto necesita' : 'productos necesitan'} atención
              </span>
              <span>Revisa las existencias negativas.</span>
            </div>
          </div>
        )}

        {visibles.length === 0 && <p className="estado">No hay productos con ese nombre o categoría.</p>}
        {visibles.map((fila) => <Tarjeta key={fila.productoId} fila={fila} alIr={alIr} />)}

        <p className="texto-suave texto-pie">Actualizado hoy a las {horaLocal(datos.cargadoEn)}</p>
      </div>
    </>
  )
}
