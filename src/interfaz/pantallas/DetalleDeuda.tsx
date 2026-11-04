/**
 * Pantalla "Detalle de deuda".
 *
 * Qué hace: muestra una deuda (cliente, fecha, descripción, monto, abonado y
 * saldo) con sus abonos, y permite abonar, anular la deuda o anular un abono.
 * Cómo lo hace: carga deudas, abonos y bitácora; `detalleDeuda` (aplicacion)
 * calcula el saldo y qué acciones se permiten; las anulaciones piden motivo
 * con `FormularioAnulacion` y recargan.
 * Por qué: nada se borra; una deuda con abonos vigentes no se puede anular
 * (primero se anulan sus abonos) y lo anulado se ve distinto, con su motivo.
 */
import { useCallback, useMemo, useState } from 'react'
import { anulacionesDe } from '../../aplicacion/anulaciones'
import { detalleDeuda } from '../../aplicacion/listaDeudas'
import type { RepositorioBitacora } from '../../datos/bitacora'
import type { RepositorioDeudas } from '../../datos/deudas'
import { CabeceraInterna } from '../componentes/CabeceraInterna'
import { EstadoDeCarga } from '../componentes/EstadoDeCarga'
import { FormularioAnulacion } from '../componentes/FormularioAnulacion'
import { fechaCompleta, formatoPesos } from '../formato'
import { useCarga } from '../useCarga'

/** Servicios que necesita la pantalla. */
export interface ServiciosDetalleDeuda {
  deudas: Pick<RepositorioDeudas, 'listarDeudas' | 'listarAbonos' | 'anularDeuda' | 'anularAbono'>
  bitacora: Pick<RepositorioBitacora, 'listarBitacora'>
}

interface Propiedades {
  servicios: ServiciosDetalleDeuda
  deudaId: string | undefined
  hoy: string
  alIr: (ruta: string) => void
}

/** Qué se está anulando: la deuda o uno de sus abonos. */
type Anulando = { tipo: 'deuda' } | { tipo: 'abono'; id: string } | null

export function DetalleDeuda({ servicios, deudaId, hoy, alIr }: Propiedades) {
  const cargar = useCallback(async () => {
    const [deudas, abonos, entradas] = await Promise.all([
      servicios.deudas.listarDeudas(),
      servicios.deudas.listarAbonos(),
      servicios.bitacora.listarBitacora(),
    ])
    return { deudas, abonos, entradas }
  }, [servicios])
  const { estado, datos, error, recargar } = useCarga(cargar)
  const [anulando, setAnulando] = useState<Anulando>(null)

  const detalle = useMemo(() => {
    if (datos === null || deudaId === undefined) return null
    return detalleDeuda({ deudas: datos.deudas, abonos: datos.abonos, hoy, deudaId, anulaciones: anulacionesDe(datos.entradas, 'deudas') })
  }, [datos, deudaId, hoy])
  const anulacionesAbonos = useMemo(() => (datos === null ? new Map() : anulacionesDe(datos.entradas, 'abonos_deuda')), [datos])

  const cabecera = <CabeceraInterna titulo="Detalle de deuda" subtitulo="Abonos y saldo" alVolver={() => alIr('deudas')} />
  if (estado !== 'listo' || datos === null) {
    return (
      <>
        {cabecera}
        <div className="marco__contenido">
          <EstadoDeCarga estado={estado === 'error' ? 'error' : 'cargando'} error={error} que="la deuda" reintentar={recargar} />
        </div>
      </>
    )
  }
  if (detalle === null) {
    return (
      <>
        {cabecera}
        <div className="marco__contenido">
          <span role="alert" className="texto-error">Esa deuda no existe.</span>
          <button type="button" className="boton" onClick={() => alIr('deudas')}>Volver a deudas</button>
        </div>
      </>
    )
  }

  const anularDeuda = async (motivo: string) => {
    await servicios.deudas.anularDeuda(detalle.id, motivo)
    alIr('deudas')
  }
  const anularAbono = async (abonoId: string, motivo: string) => {
    await servicios.deudas.anularAbono(abonoId, motivo)
    setAnulando(null)
    recargar()
  }

  return (
    <>
      {cabecera}
      <div className="marco__contenido">
        <article className="tarjeta">
          <div className="tarjeta__cabecera">
            <span className="renglones__descripcion">{detalle.cliente}</span>
            <span className={`estado-etiqueta estado-etiqueta--${detalle.estado === 'anulada' ? 'anulada' : 'vigente'}`}>
              {detalle.estado === 'pendiente' ? 'Pendiente' : detalle.estado === 'pagada' ? 'Pagada' : 'Anulada'}
            </span>
          </div>
          <p className="texto-suave">{fechaCompleta(detalle.fecha)}</p>
          <p>{detalle.descripcion}</p>
          <div className="dato"><span className="dato__etiqueta">Monto</span><span className="dato__valor">{formatoPesos(detalle.monto)}</span></div>
          <div className="dato"><span className="dato__etiqueta">Abonado</span><span className="dato__valor">{formatoPesos(detalle.abonado)}</span></div>
          <div className="division" />
          <div className="dato"><span className="dato__etiqueta">Saldo</span><span className="dato__total">{formatoPesos(detalle.saldo)}</span></div>
          {detalle.anulacion !== null && <p className="texto-suave">Motivo: {detalle.anulacion.motivo}</p>}
        </article>

        {detalle.abonos.length > 0 && <h2 className="seccion__titulo">Abonos</h2>}
        {detalle.abonos.map((a) => {
          const vigente = a.estado === 'vigente'
          const motivo = anulacionesAbonos.get(a.id)?.motivo
          return (
            <article key={a.id} className="tarjeta">
              <div className="tarjeta__cabecera">
                <span className="tarjeta__identificacion">{fechaCompleta(a.fecha)}</span>
                <span className={`estado-etiqueta estado-etiqueta--${vigente ? 'vigente' : 'anulada'}`}>{vigente ? 'Vigente' : 'Anulado'}</span>
              </div>
              <p>{a.descripcion}</p>
              <div className="dato"><span className="dato__etiqueta">Abono</span><span className="dato__valor">{formatoPesos(a.monto)}</span></div>
              {!vigente && motivo !== undefined && <p className="texto-suave">Motivo: {motivo}</p>}
              {vigente && detalle.estado !== 'anulada' && !(anulando?.tipo === 'abono' && anulando.id === a.id) && (
                <button type="button" className="boton boton--peligro-texto" onClick={() => setAnulando({ tipo: 'abono', id: a.id })}>Anular abono</button>
              )}
              {anulando?.tipo === 'abono' && anulando.id === a.id && (
                <FormularioAnulacion alConfirmar={(m) => anularAbono(a.id, m)} alCancelar={() => setAnulando(null)} />
              )}
            </article>
          )
        })}

        {detalle.puedeAbonar && <button type="button" className="boton boton--primario" onClick={() => alIr(`deudas/abonar/${detalle.id}`)}>Abonar</button>}
        {detalle.puedeAnular && anulando?.tipo !== 'deuda' && (
          <button type="button" className="boton boton--peligro-texto" onClick={() => setAnulando({ tipo: 'deuda' })}>Anular deuda</button>
        )}
        {anulando?.tipo === 'deuda' && <FormularioAnulacion alConfirmar={anularDeuda} alCancelar={() => setAnulando(null)} />}
        {!detalle.puedeAnular && detalle.estado !== 'anulada' && detalle.abonos.some((a) => a.estado === 'vigente') && (
          <p className="texto-suave">Para anular la deuda primero anula sus abonos.</p>
        )}
      </div>
    </>
  )
}
