/**
 * Pantalla "Detalle del cierre".
 *
 * Qué hace: muestra un cierre guardado con su resultado y los productos que
 * se vendieron en su día o semana, avisa si está desactualizado, y permite
 * recalcularlo o corregir el efectivo y las transferencias contados.
 * Cómo lo hace: carga el cierre, la lista de desactualizados, los productos y
 * las ventas; `describirCierre` arma el resultado y `resumirProductosVendidos`
 * la lista de productos vendidos del periodo. Recalcular y corregir llaman a los
 * servicios y recargan.
 * Por qué: recalcular lo pide un usuario, nunca es automático, y tanto
 * recalcular como corregir el dinero quedan en la bitácora. Corregir el
 * dinero deja el cierre desactualizado hasta que se recalcule.
 */
import { useCallback, useMemo, useState } from 'react'
import type { DetectorDesactualizados } from '../../aplicacion/cierresDesactualizados'
import type { ServicioCierres } from '../../aplicacion/servicioCierres'
import { resumirProductosVendidos } from '../../aplicacion/productosVendidos'
import { describirCierre } from '../../aplicacion/vistaCierre'
import type { RepositorioCierres } from '../../datos/cierres'
import type { RepositorioInventario } from '../../datos/inventario'
import type { RepositorioVentas } from '../../datos/ventas'
import { CabeceraInterna } from '../componentes/CabeceraInterna'
import { EstadoDeCarga } from '../componentes/EstadoDeCarga'
import { ProductosVendidos } from '../componentes/ProductosVendidos'
import { ResumenCierre } from '../componentes/ResumenCierre'
import { fechaCorta } from '../formato'
import { useCarga } from '../useCarga'

/** Servicios que necesita la pantalla. */
export interface ServiciosDetalleCierre {
  cierres: Pick<RepositorioCierres, 'listarCierres' | 'corregirDineroCierre'>
  desactualizados: DetectorDesactualizados
  servicioCierres: Pick<ServicioCierres, 'recalcularCierre'>
  inventario: Pick<RepositorioInventario, 'listarProductos'>
  ventas: Pick<RepositorioVentas, 'listarVentas'>
}

interface Propiedades {
  servicios: ServiciosDetalleCierre
  cierreId: string | undefined
  alIr: (ruta: string) => void
}

export function DetalleCierre({ servicios, cierreId, alIr }: Propiedades) {
  const cargar = useCallback(async () => {
    const [cierres, ids, productos, ventas] = await Promise.all([
      servicios.cierres.listarCierres(),
      servicios.desactualizados.idsDesactualizados(),
      servicios.inventario.listarProductos(),
      servicios.ventas.listarVentas(),
    ])
    return { cierres, ids, productos, ventas }
  }, [servicios])
  const { estado, datos, error, recargar } = useCarga(cargar)
  const [corrigiendo, setCorrigiendo] = useState(false)
  const [efectivo, setEfectivo] = useState<string | null>(null)
  const [transferencias, setTransferencias] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  const cierre = datos?.cierres.find((c) => c.id === cierreId)
  const vista = useMemo(() => {
    if (datos === null || cierre === undefined) return null
    return describirCierre(cierre.tipo, cierre.resultado, { efectivo: cierre.efectivo, transferencias: cierre.transferencias }, new Map(datos.productos.map((p) => [p.id, p.nombre])))
  }, [datos, cierre])

  const vendidos = useMemo(() => {
    if (datos === null || cierre === undefined) return null
    const nombres = new Map(datos.productos.map((p) => [p.id, { nombre: p.nombre, categoria: p.categoria }]))
    return resumirProductosVendidos(datos.ventas, cierre.desde, cierre.hasta, nombres)
  }, [datos, cierre])

  const cabecera = <CabeceraInterna titulo="Cierre" subtitulo="Resultado y correcciones" alVolver={() => alIr('mas/cierres')} />
  if (estado !== 'listo' || datos === null) {
    return (
      <>
        {cabecera}
        <div className="marco__contenido">
          <EstadoDeCarga estado={estado === 'error' ? 'error' : 'cargando'} error={error} que="el cierre" reintentar={recargar} />
        </div>
      </>
    )
  }
  if (cierre === undefined || vista === null || vendidos === null) {
    return (
      <>
        {cabecera}
        <div className="marco__contenido">
          <span role="alert" className="texto-error">Ese cierre no existe.</span>
          <button type="button" className="boton" onClick={() => alIr('mas/cierres')}>Volver a cierres</button>
        </div>
      </>
    )
  }

  const desactualizado = datos.ids.includes(cierre.id)
  /** Ejecuta una acción, muestra su error y recarga al terminar. */
  const ejecutar = async (accion: () => Promise<void>) => {
    setEnviando(true)
    setFallo(null)
    try {
      await accion()
      setCorrigiendo(false)
      setEfectivo(null)
      setTransferencias(null)
      recargar()
    } catch (causa) {
      setFallo(causa instanceof Error ? causa.message : String(causa))
    } finally {
      setEnviando(false)
    }
  }
  const efectivoNuevo = Number(efectivo ?? cierre.efectivo)
  const transferenciasNuevas = Number(transferencias ?? cierre.transferencias)
  const hayCambio = efectivoNuevo !== cierre.efectivo || transferenciasNuevas !== cierre.transferencias
  const solo = (set: (v: string) => void) => (e: { target: { value: string } }) => set(e.target.value.replace(/\D/g, ''))

  return (
    <>
      {cabecera}
      <div className="marco__contenido">
        <div className="tarjeta__cabecera">
          <span className="renglones__descripcion">{cierre.tipo === 'diario' ? 'Cierre diario' : 'Cierre semanal'}</span>
          <span className="texto-suave">{cierre.tipo === 'diario' ? fechaCorta(cierre.desde) : `${fechaCorta(cierre.desde)} – ${fechaCorta(cierre.hasta)}`}</span>
        </div>

        {desactualizado && (
          <div className="aviso">
            <div className="aviso__mensaje">
              <span className="aviso__titulo">Cierre desactualizado</span>
              <span>Cambiaron datos que usó este cierre. Recálculalo para ver el resultado al día.</span>
            </div>
          </div>
        )}

        <ResumenCierre vista={vista} />

        <ProductosVendidos datos={vendidos} mostrarCajas={cierre.tipo === 'semanal'} />

        {fallo !== null && <span role="alert" className="texto-error">{fallo}</span>}
        <button type="button" className="boton boton--primario" disabled={enviando} onClick={() => ejecutar(() => servicios.servicioCierres.recalcularCierre(cierre.id))}>
          Recalcular cierre
        </button>

        {!corrigiendo && <button type="button" className="boton" onClick={() => setCorrigiendo(true)}>Corregir dinero</button>}
        {corrigiendo && (
          <>
            <div className="campo">
              <label className="campo__etiqueta" htmlFor="efectivo-corregido">Efectivo</label>
              <div className="entrada"><input id="efectivo-corregido" type="text" inputMode="numeric" className="entrada__control" value={efectivo ?? String(cierre.efectivo)} onChange={solo(setEfectivo)} /></div>
            </div>
            <div className="campo">
              <label className="campo__etiqueta" htmlFor="transferencias-corregidas">Transferencias</label>
              <div className="entrada"><input id="transferencias-corregidas" type="text" inputMode="numeric" className="entrada__control" value={transferencias ?? String(cierre.transferencias)} onChange={solo(setTransferencias)} /></div>
            </div>
            <p className="texto-suave">La corrección queda en la bitácora y deja el cierre desactualizado hasta que lo recalcules.</p>
            <div className="acciones">
              <button type="button" className="boton" onClick={() => setCorrigiendo(false)}>Cancelar</button>
              <button
                type="button"
                className="boton boton--primario"
                disabled={!hayCambio || enviando}
                onClick={() => ejecutar(() => servicios.cierres.corregirDineroCierre(cierre.id, efectivoNuevo, transferenciasNuevas))}
              >
                Guardar corrección
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}
