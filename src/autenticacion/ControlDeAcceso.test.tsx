// @vitest-environment jsdom
/**
 * Pruebas de la pantalla de control de acceso.
 *
 * Qué hace: verifica qué ve cada persona: carga, botón de entrar con Google,
 * aviso de no autorizado, error, o la app si está autorizada.
 * Cómo lo hace: renderiza el componente con un servicio de acceso falso que
 * emite el estado que se quiere probar.
 * Por qué: el contenido de la app solo debe aparecer para un usuario
 * autorizado; en cualquier otro estado no se debe renderizar.
 */
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ControlDeAcceso } from './ControlDeAcceso'
import type { EstadoAcceso, ServicioAcceso } from './servicioAcceso'

afterEach(cleanup)

/** Servicio falso que emite un solo estado. */
function servicioCon(estado: EstadoAcceso): ServicioAcceso {
  return {
    resolverEstado: vi.fn(async () => estado),
    suscribir: vi.fn((alCambiar) => {
      alCambiar(estado)
      return () => {}
    }),
    iniciarSesion: vi.fn(async () => {}),
    cerrarSesion: vi.fn(async () => {}),
  }
}

const hijos = vi.fn(({ correo }: { correo: string }) => <p>Contenido de la app para {correo}</p>)

describe('ControlDeAcceso', () => {
  it('cargando: avisa y no muestra la app', () => {
    render(<ControlDeAcceso servicio={servicioCon({ tipo: 'cargando' })} redirigirA="/">{hijos}</ControlDeAcceso>)
    expect(screen.getByRole('status').textContent).toMatch(/cargando/i)
    expect(screen.queryByText(/Contenido de la app/)).toBeNull()
  })

  it('sin sesión: ofrece entrar con Google y manda a dónde volver', async () => {
    const servicio = servicioCon({ tipo: 'sin-sesion' })
    render(<ControlDeAcceso servicio={servicio} redirigirA="https://ejemplo.com/">{hijos}</ControlDeAcceso>)
    fireEvent.click(screen.getByRole('button', { name: /google/i }))
    await waitFor(() => expect(servicio.iniciarSesion).toHaveBeenCalledWith('https://ejemplo.com/'))
    expect(screen.queryByText(/Contenido de la app/)).toBeNull()
  })

  it('si Google falla al entrar, muestra el motivo', async () => {
    const servicio = servicioCon({ tipo: 'sin-sesion' })
    vi.mocked(servicio.iniciarSesion).mockRejectedValueOnce(new Error('proveedor desactivado'))
    render(<ControlDeAcceso servicio={servicio} redirigirA="/">{hijos}</ControlDeAcceso>)
    fireEvent.click(screen.getByRole('button', { name: /google/i }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/proveedor desactivado/)
  })

  it('no autorizado: dice el correo, no muestra la app y permite cerrar sesión', async () => {
    const servicio = servicioCon({ tipo: 'no-autorizado', correo: 'intruso@ejemplo.com' })
    render(<ControlDeAcceso servicio={servicio} redirigirA="/">{hijos}</ControlDeAcceso>)
    expect(screen.getByText('Esta cuenta no tiene acceso')).toBeTruthy()
    expect(screen.getByText('intruso@ejemplo.com')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toMatch(/No autorizado/)
    expect(screen.queryByText(/Contenido de la app/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /cerrar sesión/i }))
    await waitFor(() => expect(servicio.cerrarSesion).toHaveBeenCalled())
  })

  it('error: muestra el mensaje, no muestra la app y permite cerrar sesión', () => {
    render(<ControlDeAcceso servicio={servicioCon({ tipo: 'error', mensaje: 'sin red' })} redirigirA="/">{hijos}</ControlDeAcceso>)
    expect(screen.getByRole('alert').textContent).toMatch(/sin red/)
    expect(screen.queryByText(/Contenido de la app/)).toBeNull()
    expect(screen.getByRole('button', { name: /cerrar sesión/i })).toBeTruthy()
  })

  it('sin sesión: muestra la bienvenida del diseño con el botón de Google', () => {
    render(<ControlDeAcceso servicio={servicioCon({ tipo: 'sin-sesion' })} redirigirA="/">{hijos}</ControlDeAcceso>)
    expect(screen.getByText(/Tu negocio,/)).toBeTruthy()
    expect(screen.getByText('Usa la cuenta autorizada por tu negocio.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Entrar con Google' })).toBeTruthy()
  })

  it('autorizado: el contenido recibe también el nombre cuando existe', () => {
    const servicio = servicioCon({ tipo: 'autorizado', correo: 'ana@ejemplo.com', nombre: 'Ana' })
    render(<ControlDeAcceso servicio={servicio} redirigirA="/">{({ nombre }) => <p>Hola {nombre}</p>}</ControlDeAcceso>)
    expect(screen.getByText('Hola Ana')).toBeTruthy()
  })

  it('autorizado: muestra la app con el correo y la acción de cerrar sesión', async () => {
    const servicio = servicioCon({ tipo: 'autorizado', correo: 'ana@ejemplo.com' })
    render(
      <ControlDeAcceso servicio={servicio} redirigirA="/">
        {({ correo, cerrarSesion }) => (
          <button type="button" onClick={cerrarSesion}>
            Salir {correo}
          </button>
        )}
      </ControlDeAcceso>,
    )
    fireEvent.click(screen.getByRole('button', { name: /salir ana@ejemplo\.com/i }))
    await waitFor(() => expect(servicio.cerrarSesion).toHaveBeenCalled())
  })

  it('al desmontarse cancela la suscripción', () => {
    const cancelar = vi.fn()
    const servicio = servicioCon({ tipo: 'sin-sesion' })
    vi.mocked(servicio.suscribir).mockImplementation((alCambiar) => {
      alCambiar({ tipo: 'sin-sesion' })
      return cancelar
    })
    const { unmount } = render(<ControlDeAcceso servicio={servicio} redirigirA="/">{hijos}</ControlDeAcceso>)
    unmount()
    expect(cancelar).toHaveBeenCalled()
  })
})
