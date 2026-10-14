import { ListSection, LoadingState } from 'wallet-web-ui';

/*
 * Estados de carga de las pantallas rediseñadas: esqueletos y un anuncio para lectores de pantalla.
 * Las listas cargan dentro de su ListSection (Movimientos, "Últimos movimientos" de Inicio); las
 * tarjetas y Beneficiarios, directo sobre el lienzo.
 */

export const Lines = () => (
  <div className="max-w-xl bg-surface-canvas p-5">
    <ListSection>
      <LoadingState label="Cargando movimientos" count={4} />
    </ListSection>
  </div>
);

export const Cards = () => (
  <div className="max-w-xl bg-surface-canvas p-5">
    <LoadingState label="Cargando tus cuentas" variant="card" count={2} />
  </div>
);

export const LongList = () => (
  <div className="max-w-xl bg-surface-canvas p-5">
    <LoadingState label="Cargando tus beneficiarios" count={6} />
  </div>
);

/** Inicio: los últimos movimientos de la cuenta elegida cargan por su cuenta, con su título. */
export const HomeLatest = () => (
  <div className="max-w-xl bg-surface-canvas p-5">
    <ListSection
      title="Últimos movimientos"
      action={
        <a href="#" className="inline-flex min-h-11 items-center text-label text-action">
          Ver todos
        </a>
      }
    >
      <LoadingState label="Cargando movimientos" count={4} />
    </ListSection>
  </div>
);
