/**
 * Pantalla "Abonar".
 *
 * Qué hace: registra un pago (parcial o total) de una deuda con monto y
 * descripción, mostrando cuánto se debe antes de abonar.
 * Cómo lo hace: carga deudas y abonos; `detalleDeuda` da el saldo y si recibe
 * abonos; `validarAbono` (aplicacion) avisa si el monto supera el saldo. Al
 * guardar vuelve al detalle de la deuda.
 * Por qué: la base rechaza un abono mayor a lo que se debe; avisar antes
 * evita el error. Una deuda pagada o anulada no recibe abonos.
 */
import { useCallback, useState } from 'react'
import { validarAbono, type EntradaAbono } from '../../aplicacion/formulariosDeuda'
import { detalleDeuda } from '../../aplicacion/listaDeudas'
import type { RepositorioDeudas } from '../../datos/deudas'
import { CabeceraInterna } from '../componentes/CabeceraInterna'
import { EstadoDeCarga } from '../componentes/EstadoDeCarga'
import { formatoPesos } from '../formato'
import { useCarga } from '../useCarga'

/** Servicios que necesita la pantalla. */
export interface ServiciosAbonar {
  deudas: Pick<RepositorioDeudas, 'listarDeudas' | 'listarAbonos' | 'registrarAbono'>
}

interface Propiedades {
  servicios: ServiciosAbonar
  deudaId: string | undefined
  hoy: string
  alIr: (ruta: string) => void
}

export function Abonar({ servicios, deudaId, hoy, alIr }: Propiedades) {
  const cargar = useCallback(async () => {
    const [deudas, abonos] = await Promise.all([servicios.deudas.listarDeudas(), servicios.deudas.listarAbonos()])
    return { deudas, abonos }
  }, [servicios])
  const { estado, datos, error, recargar } = useCarga(cargar)
  const [entrada, setEntrada] = useState<EntradaAbono>({ monto: '', descripcion: '' })
  const [tocados, setTocados] = useState<Partial<Record<keyof EntradaAbono, true>>>({})
  const [enviando, setEnviando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  const volver = () => alIr(deudaId === undefined ? 'deudas' : `deudas/${deudaId}`)
  const cabecera = <CabeceraInterna titulo="Abonar" subtitulo="Registrar un pago" alVolver={volver} />
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

  const deuda = deudaId === undefined ? null : detalleDeuda({ ...datos, hoy, deudaId, anulaciones: new Map() })
  if (deuda === null || !deuda.puedeAbonar || deudaId === undefined) {
    return (
      <>
        {cabecera}
        <div className="marco__contenido">
          <span role="alert" className="texto-error">
            {deuda === null ? 'Esa deuda no existe.' : 'Esta deuda ya no recibe abonos.'}
          </span>
          <button type="button" className="boton" onClick={() => alIr('deudas')}>Volver a deudas</button>
        </div>
      </>
    )
  }

  const resultado = validarAbono(entrada, deudaId, deuda.saldo, hoy)
  const cambiar = (campo: keyof EntradaAbono, valor: string) => {
    setEntrada((e) => ({ ...e, [campo]: campo === 'monto' ? valor.replace(/\D/g, '') : valor }))
    setTocados((t) => ({ ...t, [campo]: true }))
  }
  const errorDe = (campo: keyof EntradaAbono) => (tocados[campo] ? resultado.errores[campo] : undefined)

  const guardar = async () => {
    if (resultado.datos === null) return
    setEnviando(true)
    setFallo(null)
    try {
      await servicios.deudas.registrarAbono(resultado.datos)
      volver()
    } catch (causa) {
      setFallo(causa instanceof Error ? causa.message : String(causa))
      setEnviando(false)
    }
  }

  return (
    <>
      {cabecera}
      <div className="marco__contenido">
        <article className="tarjeta">
          <p className="renglones__descripcion">{deuda.cliente}</p>
          <p className="texto-suave">{deuda.descripcion}</p>
          <div className="dato">
            <span className="dato__etiqueta">Se debe</span>
            <span className="dato__total">{formatoPesos(deuda.saldo)}</span>
          </div>
        </article>

        <div className="campo">
          <label className="campo__etiqueta" htmlFor="monto-abono">Monto del abono</label>
          <div className="entrada">
            <input id="monto-abono" type="text" inputMode="numeric" className="entrada__control" placeholder="$ 0" value={entrada.monto} onChange={(e) => cambiar('monto', e.target.value)} />
          </div>
          {errorDe('monto') !== undefined && <span className="texto-error">{errorDe('monto')}</span>}
        </div>
        <div className="campo">
          <label className="campo__etiqueta" htmlFor="descripcion-abono">Descripción</label>
          <textarea id="descripcion-abono" className="entrada entrada--texto" rows={3} value={entrada.descripcion} onChange={(e) => cambiar('descripcion', e.target.value)} />
          {errorDe('descripcion') !== undefined && <span className="texto-error">{errorDe('descripcion')}</span>}
        </div>

        {fallo !== null && <span role="alert" className="texto-error">{fallo}</span>}
        <button type="button" className="boton boton--primario" disabled={!resultado.puedeGuardar || enviando} onClick={guardar}>
          Registrar abono
        </button>
      </div>
    </>
  )
}
