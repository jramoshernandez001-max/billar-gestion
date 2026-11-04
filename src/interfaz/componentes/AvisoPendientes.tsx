/**
 * Aviso de registros pendientes de enviar.
 *
 * Qué hace: muestra cuántos registros hechos sin conexión faltan por llegar
 * a la base, con un botón para enviarlos ya, y las operaciones que la base
 * rechazó con su motivo y los botones Reintentar y Descartar.
 * Cómo lo hace: lee el estado del servicio de sincronización con
 * `useSyncExternalStore`; no muestra nada si no hay pendientes ni rechazadas.
 * Por qué: lo registrado sin internet todavía no está en la base ni en los
 * cierres. La persona debe verlo, poder enviarlo y enterarse si algo fue
 * rechazado (por ejemplo, un abono que superaba la deuda) para decidir.
 */
import { useSyncExternalStore } from 'react'
import { CloudUpload, CircleAlert } from 'lucide-react'
import type { ServicioSincronizacion } from '../../sincronizacion/servicioSincronizacion'

type Servicio = Pick<ServicioSincronizacion, 'estado' | 'suscribir' | 'sincronizar' | 'reintentar' | 'descartar'>

/** Nombre legible de cada operación. */
const NOMBRES: Record<string, string> = {
  registrar_venta: 'La venta',
  registrar_compra: 'La compra',
  registrar_traslado: 'El traslado',
  registrar_ajuste: 'El ajuste de inventario',
  registrar_deuda: 'La deuda',
  registrar_abono: 'El abono',
}

export function AvisoPendientes({ servicio }: { servicio: Servicio }) {
  const estado = useSyncExternalStore(servicio.suscribir, servicio.estado)
  if (estado.pendientes === 0 && estado.rechazadas.length === 0) return null
  return (
    <>
      {estado.pendientes > 0 && (
        <div role="status" className="aviso">
          <CloudUpload size={18} strokeWidth={1.5} aria-hidden="true" />
          <div className="aviso__mensaje">
            <span className="aviso__titulo">
              {estado.pendientes} {estado.pendientes === 1 ? 'registro pendiente' : 'registros pendientes'} de enviar
            </span>
            <span>Están guardados en este teléfono y se envían solos al volver internet.</span>
          </div>
          <button type="button" className="enlace" disabled={estado.sincronizando} onClick={() => void servicio.sincronizar(true)}>
            {estado.sincronizando ? 'Enviando…' : 'Enviar ahora'}
          </button>
        </div>
      )}
      {estado.rechazadas.map((operacion) => (
        <div key={operacion.clave} role="alert" className="aviso aviso--error">
          <CircleAlert size={18} strokeWidth={1.5} aria-hidden="true" />
          <div className="aviso__mensaje">
            <span className="aviso__titulo">{NOMBRES[operacion.funcion] ?? 'Un registro'} no se pudo guardar</span>
            <span>{operacion.error}</span>
          </div>
          <button type="button" className="enlace" onClick={() => servicio.reintentar(operacion.clave)}>Reintentar</button>
          <button type="button" className="enlace" onClick={() => servicio.descartar(operacion.clave)}>Descartar</button>
        </div>
      ))}
    </>
  )
}
