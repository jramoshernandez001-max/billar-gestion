/**
 * Pantalla "Corregir costo" de una compra.
 *
 * Qué hace: muestra una compra con su costo actual y deja escribir el costo
 * total correcto, mostrando el costo por unidad nuevo y la diferencia.
 * Cómo lo hace: carga compras y productos; `resumirCompras` describe la compra
 * y `calcularCorreccionCosto` (aplicacion) calcula costo por unidad,
 * diferencia y si se puede guardar. La compra viaja en la ruta
 * (`mas/compras/corregir/<id>`).
 * Por qué: si era la última compra del producto, la utilidad semanal usa el
 * costo nuevo. Una compra anulada no se corrige. La base no guarda un motivo
 * para esta corrección (solo el antes y el después), por eso no se pide.
 */
import { useCallback, useState } from 'react'
import { calcularCorreccionCosto } from '../../aplicacion/calculoCompra'
import { resumirCompras } from '../../aplicacion/resumenCompras'
import type { RepositorioInventario } from '../../datos/inventario'
import { CabeceraInterna } from '../componentes/CabeceraInterna'
import { EstadoDeCarga } from '../componentes/EstadoDeCarga'
import { formatoPesos } from '../formato'
import { useCarga } from '../useCarga'

/** Servicios que necesita la pantalla. */
export interface ServiciosCorregirCosto {
  inventario: Pick<RepositorioInventario, 'listarCompras' | 'listarProductos' | 'corregirCostoCompra'>
}

interface Propiedades {
  servicios: ServiciosCorregirCosto
  compraId: string | undefined
  alIr: (ruta: string) => void
}

export function CorregirCosto({ servicios, compraId, alIr }: Propiedades) {
  const cargar = useCallback(async () => {
    const [compras, productos] = await Promise.all([servicios.inventario.listarCompras(), servicios.inventario.listarProductos()])
    return { compras, productos }
  }, [servicios])
  const { estado, datos, error, recargar } = useCarga(cargar)
  const [costoTexto, setCostoTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  const volver = () => alIr('mas/compras')
  const cabecera = <CabeceraInterna titulo="Corregir costo" subtitulo="Solo cambia el costo, no las unidades" alVolver={volver} />
  if (estado !== 'listo' || datos === null) {
    return (
      <>
        {cabecera}
        <div className="marco__contenido">
          <EstadoDeCarga estado={estado === 'cargando' ? 'cargando' : 'error'} error={error} que="la compra" reintentar={recargar} />
        </div>
      </>
    )
  }

  const compra = datos.compras.find((c) => c.id === compraId)
  const tarjeta = compra === undefined
    ? undefined
    : resumirCompras({
        compras: datos.compras,
        nombres: new Map(datos.productos.map((p) => [p.id, p.nombre])),
        anulaciones: new Map(),
        desde: null,
        hasta: null,
        filtro: 'todas',
      }).find((t) => t.id === compra.id)

  if (compra === undefined || tarjeta === undefined || compra.estado === 'anulada') {
    return (
      <>
        {cabecera}
        <div className="marco__contenido">
          <span role="alert" className="texto-error">
            {compra === undefined ? 'Esa compra no existe.' : 'Una compra anulada no se puede corregir.'}
          </span>
          <button type="button" className="boton" onClick={volver}>Volver al historial</button>
        </div>
      </>
    )
  }

  const costoNuevo = costoTexto === '' ? null : Number(costoTexto)
  const resultado = calcularCorreccionCosto({ unidades: tarjeta.unidades, costoActual: compra.costoTotal, costoNuevo })

  const guardar = async () => {
    if (costoNuevo === null) return
    setEnviando(true)
    setFallo(null)
    try {
      await servicios.inventario.corregirCostoCompra(compra.id, costoNuevo)
      volver()
    } catch (causa) {
      setFallo(causa instanceof Error ? causa.message : String(causa))
      setEnviando(false)
    }
  }

  const diferencia = resultado.diferencia
  return (
    <>
      {cabecera}
      <div className="marco__contenido">
        <article className="tarjeta">
          <p className="renglones__descripcion">{tarjeta.producto}</p>
          <p className="texto-suave">{tarjeta.cantidadTexto}</p>
          <div className="dato">
            <span className="dato__etiqueta">Costo actual</span>
            <span className="dato__total">{formatoPesos(compra.costoTotal)}</span>
          </div>
        </article>

        <div className="campo">
          <label className="campo__etiqueta" htmlFor="costo-nuevo">Costo total nuevo</label>
          <div className="entrada">
            <input
              id="costo-nuevo"
              type="text"
              inputMode="numeric"
              className="entrada__control"
              placeholder="$ 0"
              value={costoTexto === '' ? '' : formatoPesos(Number(costoTexto))}
              onChange={(e) => setCostoTexto(e.target.value.replace(/\D/g, ''))}
            />
          </div>
        </div>

        <div className="tarjeta tarjeta--destacada">
          <div className="dato">
            <span className="dato__etiqueta">Costo por unidad</span>
            <span className="dato__total">{resultado.costoPorUnidad === null ? '—' : formatoPesos(resultado.costoPorUnidad)}</span>
          </div>
          <div className="dato">
            <span className="dato__etiqueta">Diferencia</span>
            <span className={`dato__valor${diferencia !== null && diferencia < 0 ? ' dato__valor--negativo' : ''}`}>
              {diferencia === null ? '—' : `${diferencia > 0 ? '+' : '−'}${formatoPesos(Math.abs(diferencia))}`}
            </span>
          </div>
        </div>

        {resultado.problema !== null && <p className="texto-suave">{resultado.problema}</p>}
        {fallo !== null && <span role="alert" className="texto-error">{fallo}</span>}

        <button type="button" className="boton boton--primario" disabled={!resultado.puedeGuardar || enviando} onClick={guardar}>
          Guardar corrección
        </button>
        <p className="texto-suave">La corrección queda en la bitácora con el costo anterior y el nuevo.</p>
      </div>
    </>
  )
}
