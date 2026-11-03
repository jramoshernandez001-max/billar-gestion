/**
 * Hook que sigue el estado de acceso.
 *
 * Qué hace: devuelve el estado de acceso actual (cargando, sin sesión, no
 * autorizado, autorizado o error) y lo mantiene al día.
 * Cómo lo hace: se suscribe al servicio al montarse el componente y cancela
 * la suscripción al desmontarse.
 * Por qué: el componente solo dibuja; la lógica de acceso vive en el servicio.
 */
import { useEffect, useState } from 'react'
import type { EstadoAcceso, ServicioAcceso } from './servicioAcceso'

export function useEstadoAcceso(servicio: ServicioAcceso): EstadoAcceso {
  const [estado, setEstado] = useState<EstadoAcceso>({ tipo: 'cargando' })
  useEffect(() => servicio.suscribir(setEstado), [servicio])
  return estado
}
