/**
 * Composición de los servicios de datos.
 *
 * Qué hace: arma, a partir de un cliente de datos, los cuatro repositorios y
 * el servicio de cierres, la bitácora y el detector de cierres desactualizados ya conectados entre sí.
 * Cómo lo hace: crea cada repositorio con el mismo cliente y se los entrega
 * al servicio de cierres.
 * Por qué: es el único lugar donde se conectan estas piezas; la app pide sus
 * servicios aquí y no sabe cómo se construyen.
 */
import { crearRepositorioBitacora, type RepositorioBitacora } from '../datos/bitacora'
import { crearRepositorioCierres, type RepositorioCierres } from '../datos/cierres'
import type { ClienteDatos } from '../datos/clienteDatos'
import { crearRepositorioDeudas, type RepositorioDeudas } from '../datos/deudas'
import { crearRepositorioInventario, type RepositorioInventario } from '../datos/inventario'
import { crearRepositorioVentas, type RepositorioVentas } from '../datos/ventas'
import { crearDetectorDesactualizados, type DetectorDesactualizados } from './cierresDesactualizados'
import { crearServicioCierres, type ServicioCierres } from './servicioCierres'

/** Todo lo que la app necesita para trabajar con los datos. */
export interface Servicios {
  inventario: RepositorioInventario
  ventas: RepositorioVentas
  deudas: RepositorioDeudas
  cierres: RepositorioCierres
  servicioCierres: ServicioCierres
  bitacora: RepositorioBitacora
  desactualizados: DetectorDesactualizados
}

/** Crea los repositorios y el servicio de cierres sobre un cliente de datos. */
export function crearServicios(cliente: ClienteDatos): Servicios {
  const inventario = crearRepositorioInventario(cliente)
  const ventas = crearRepositorioVentas(cliente)
  const deudas = crearRepositorioDeudas(cliente)
  const cierres = crearRepositorioCierres(cliente)
  const bitacora = crearRepositorioBitacora(cliente)
  return {
    inventario,
    ventas,
    deudas,
    cierres,
    servicioCierres: crearServicioCierres({ ventas, deudas, inventario, cierres }),
    bitacora,
    desactualizados: crearDetectorDesactualizados({ cierres, bitacora }),
  }
}
