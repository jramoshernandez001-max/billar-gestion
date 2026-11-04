/**
 * Pantalla "Deudas" (lista).
 *
 * Qué hace: lista las deudas en pestañas Pendientes, Pagadas y Anuladas, con
 * búsqueda por cliente, el total que se debe y el acceso a nueva deuda y al
 * detalle de cada una.
 * Cómo lo hace: carga deudas y abonos; `listarDeudasPorEstado` (aplicacion)
 * calcula saldos, filtra y cuenta.
 * Por qué: el saldo no se guarda, se calcula con los abonos vigentes; las
 * anuladas no deben nada y las pagadas se conservan como historial.
 */
import { useCallback, useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { listarDeudasPorEstado } from '../../aplicacion/listaDeudas'
import type { EstadoCobro } from '../../aplicacion/resumenDeudas'
import type { RepositorioDeudas } from '../../datos/deudas'
import { Cabecera } from '../componentes/Cabecera'
import { EstadoDeCarga } from '../componentes/EstadoDeCarga'
import { Opciones } from '../componentes/Opciones'
import { fechaCorta, formatoPesos } from '../formato'
import { useCarga } from '../useCarga'

/** Servicios que necesita la pantalla. */
export interface ServiciosDeudas {
  deudas: Pick<RepositorioDeudas, 'listarDeudas' | 'listarAbonos'>
}

interface Propiedades {
  servicios: ServiciosDeudas
  /** Día de hoy, AAAA-MM-DD (fecha de corte de los saldos). */
  hoy: string
  alIr: (ruta: string) => void
}

const VACIOS: Record<EstadoCobro, string> = {
  pendiente: 'No hay deudas pendientes.',
  pagada: 'No hay deudas pagadas.',
  anulada: 'No hay deudas anuladas.',
}

export function Deudas({ servicios, hoy, alIr }: Propiedades) {
  const cargar = useCallback(async () => {
    const [deudas, abonos] = await Promise.all([servicios.deudas.listarDeudas(), servicios.deudas.listarAbonos()])
    return { deudas, abonos }
  }, [servicios])
  const { estado, datos, error, recargar } = useCarga(cargar)
  const [pestana, setPestana] = useState<EstadoCobro>('pendiente')
  const [busqueda, setBusqueda] = useState('')

  const lista = useMemo(
    () => (datos === null ? null : listarDeudasPorEstado({ ...datos, hoy, estado: pestana, busqueda })),
    [datos, hoy, pestana, busqueda],
  )

  const cabecera = <Cabecera titulo="Deudas" subtitulo="Quién debe y cuánto" />
  if (lista === null) {
    return (
      <>
        {cabecera}
        <div className="marco__contenido">
          <EstadoDeCarga estado={estado === 'error' ? 'error' : 'cargando'} error={error} que="las deudas" reintentar={recargar} />
        </div>
      </>
    )
  }

  return (
    <>
      {cabecera}
      <div className="marco__contenido">
        <button type="button" className="boton boton--primario" onClick={() => alIr('deudas/nueva')}>
          <Plus size={18} strokeWidth={1.5} aria-hidden="true" /> Nueva deuda
        </button>
        <Opciones
          nombre="Estado de la deuda"
          opciones={[
            { valor: 'pendiente', etiqueta: `Pendientes · ${lista.conteo.pendiente}` },
            { valor: 'pagada', etiqueta: `Pagadas · ${lista.conteo.pagada}` },
            { valor: 'anulada', etiqueta: `Anuladas · ${lista.conteo.anulada}` },
          ]}
          valor={pestana}
          alCambiar={setPestana}
        />
        <label className="entrada entrada--busqueda">
          <Search size={18} strokeWidth={1.5} className="entrada__icono" aria-hidden="true" />
          <input type="search" className="entrada__control" placeholder="Buscar cliente" aria-label="Buscar cliente" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </label>

        {pestana === 'pendiente' && (
          <div className="dato">
            <span className="dato__etiqueta">{lista.cuentas} {lista.cuentas === 1 ? 'cuenta' : 'cuentas'}</span>
            <span className="dato__total">{formatoPesos(lista.total)}</span>
          </div>
        )}

        {lista.filas.length === 0 && <p className="estado">{VACIOS[pestana]}</p>}
        {lista.filas.map((f) => (
          <button key={f.id} type="button" className="tarjeta tarjeta--boton" aria-label={`${f.cliente}, ${formatoPesos(f.saldo)}`} onClick={() => alIr(`deudas/${f.id}`)}>
            <span className="tarjeta__cabecera">
              <span className="renglones__descripcion">{f.cliente}</span>
              <span className="texto-suave">{fechaCorta(f.fecha)}</span>
            </span>
            <span className="texto-suave">{f.descripcion}</span>
            <span className="dato">
              <span className="dato__etiqueta">{f.abonado > 0 ? `Abonado ${formatoPesos(f.abonado)} de ${formatoPesos(f.monto)}` : `Monto ${formatoPesos(f.monto)}`}</span>
              <span className="dato__valor">{pestana === 'pendiente' ? formatoPesos(f.saldo) : formatoPesos(f.monto)}</span>
            </span>
          </button>
        ))}
      </div>
    </>
  )
}
