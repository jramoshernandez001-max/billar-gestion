/**
 * Composición del modo sin conexión.
 *
 * Qué hace: arma la cola, el servicio de sincronización y el cliente de datos
 * con modo sin conexión a partir del cliente real, el almacenamiento del
 * navegador y la ventana.
 * Cómo lo hace: guarda en localStorage (cola y copias de lectura) y envía
 * cada operación con la función `aplicar_operacion_pendiente`, que usa la
 * clave para no repetirla.
 * Por qué: es el único lugar donde se conectan estas piezas (como
 * `crearServicios` lo es para los repositorios); main.tsx solo la llama.
 */
import type { ClienteDatos } from '../datos/clienteDatos'
import { crearAlmacenLocal } from './almacenLocal'
import { crearClienteSincronizado, type ClienteSincronizado } from './clienteSincronizado'
import { crearCola } from './colaPendientes'
import { crearServicioSincronizacion, type ServicioSincronizacion } from './servicioSincronizacion'

interface Opciones {
  /** Cliente real de datos (el de Supabase adaptado). */
  cliente: ClienteDatos
  storage: Storage
  ventana: EventTarget
  estaEnLinea: () => boolean
}

export interface Sincronizacion {
  /** Cliente para los repositorios: encola, exige conexión o usa copias. */
  cliente: ClienteSincronizado
  servicio: ServicioSincronizacion
}

export function crearSincronizacion({ cliente, storage, estaEnLinea }: Opciones): Sincronizacion {
  const almacen = crearAlmacenLocal(storage)
  const cola = crearCola(almacen)
  const servicio = crearServicioSincronizacion({
    cola,
    estaEnLinea,
    enviar: (clave, funcion, argumentos) =>
      cliente.rpc('aplicar_operacion_pendiente', {
        p_clave: clave,
        p_funcion: funcion,
        p_argumentos: argumentos,
      }),
  })
  return { cliente: crearClienteSincronizado({ cliente, servicio, almacen, estaEnLinea }), servicio }
}
