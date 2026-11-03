/**
 * Pantalla principal de la app.
 *
 * Qué hace: envuelve el contenido de la app en el control de acceso, de modo
 * que solo un usuario autorizado vea algo.
 * Cómo lo hace: recibe el servicio de acceso ya construido y le pasa
 * ControlDeAcceso. Por ahora el contenido es un marcador: las vistas reales
 * (inventario, ventas, cierres, deudas) las diseña el dueño en Figma y se
 * agregan después.
 * Por qué: recibir el servicio por propiedad evita que App conozca a Supabase
 * y permite probarla con uno falso.
 */
import { ControlDeAcceso } from './autenticacion/ControlDeAcceso'
import type { ServicioAcceso } from './autenticacion/servicioAcceso'

interface Propiedades {
  servicio: ServicioAcceso
}

function App({ servicio }: Propiedades) {
  return (
    <ControlDeAcceso servicio={servicio} redirigirA={window.location.origin}>
      {({ correo, cerrarSesion }) => (
        <main>
          <h1>Billar Gestión</h1>
          <p>Sesión iniciada como {correo}.</p>
          <button type="button" onClick={() => void cerrarSesion()}>
            Cerrar sesión
          </button>
        </main>
      )}
    </ControlDeAcceso>
  )
}

export default App
