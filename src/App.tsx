/**
 * Pantalla principal de la app.
 *
 * Qué hace: envuelve todo en el control de acceso (solo un usuario autorizado
 * ve algo) y, dentro, elige la pantalla según la ruta y dibuja la navegación
 * inferior.
 * Cómo lo hace: recibe el servicio de acceso y los servicios de datos ya
 * construidos; lee la ruta con useRuta y muestra la pantalla que le toca (las
 * que aún no están listas muestran "en construcción").
 * Por qué: recibir los servicios por propiedad evita que App conozca a
 * Supabase y permite probarla con servicios falsos.
 */
import { useState } from 'react'
import { ControlDeAcceso } from './autenticacion/ControlDeAcceso'
import type { ServicioAcceso } from './autenticacion/servicioAcceso'
import type { ServiciosInicio } from './aplicacion/cargarInicio'
import { NavegacionInferior } from './interfaz/componentes/NavegacionInferior'
import { fechaLocalIso } from './interfaz/formato'
import { Inicio } from './interfaz/pantallas/Inicio'
import { Proximamente } from './interfaz/pantallas/Proximamente'
import { pestanaDe } from './interfaz/ruta'
import { useRuta } from './interfaz/useRuta'

/** Servicios de datos que usan las pantallas (crece con cada pantalla). */
export type ServiciosApp = ServiciosInicio

interface Propiedades {
  servicio: ServicioAcceso
  servicios: ServiciosApp
}

/** Contenido de la app para un usuario autorizado: pantalla + navegación. */
function Contenido({ nombre, servicios }: { nombre?: string; servicios: ServiciosApp }) {
  const { ruta, ir } = useRuta()
  const [hoy] = useState(() => fechaLocalIso(new Date()))
  return (
    <>
      {ruta === 'inicio' ? (
        <Inicio servicios={servicios} nombre={nombre} hoy={hoy} alIr={ir} />
      ) : (
        <Proximamente ruta={ruta} />
      )}
      <NavegacionInferior activa={pestanaDe(ruta)} alIr={ir} />
    </>
  )
}

function App({ servicio, servicios }: Propiedades) {
  return (
    <div className="marco">
      <ControlDeAcceso servicio={servicio} redirigirA={window.location.origin}>
        {({ nombre }) => <Contenido nombre={nombre} servicios={servicios} />}
      </ControlDeAcceso>
    </div>
  )
}

export default App
