import { Button, EmptyState, buttonClasses } from 'wallet-web-ui';

export const NoBeneficiaries = () => (
  <div className="max-w-2xl">
    <EmptyState
      title="Aún no tienes beneficiarios"
      description="Agrega con su CLABE a las personas a las que les envías dinero."
      action={
        <a href="#nuevo-beneficiario" className={buttonClasses('secondary')}>
          Agregar beneficiario
        </a>
      }
    />
  </div>
);

export const FilteredMovements = () => (
  <div className="max-w-2xl">
    <EmptyState
      title="No hay movimientos en este periodo"
      description="Prueba con otras fechas u otros tipos de movimiento."
      action={<Button variant="secondary">Limpiar filtros</Button>}
    />
  </div>
);

export const NoAccounts = () => (
  <div className="max-w-2xl">
    <EmptyState
      title="Aún no tienes cuentas"
      description="Tus cuentas Principal y Ahorro se abren al verificar tu correo."
      action={<Button variant="secondary">Volver a cargar</Button>}
    />
  </div>
);

export const WithoutAction = () => (
  <div className="max-w-2xl">
    <EmptyState
      title="No hay movimientos en este periodo"
      description="Prueba con otras fechas u otros tipos de movimiento."
    />
  </div>
);

export const BeneficiariesPage = () => (
  <div className="grid max-w-2xl gap-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <h1 className="text-h1 text-fg">Beneficiarios</h1>
      <a href="#nuevo-beneficiario" className={buttonClasses('primary')}>
        Agregar beneficiario
      </a>
    </div>
    <EmptyState
      title="Aún no tienes beneficiarios"
      description="Agrega con su CLABE a las personas a las que les envías dinero."
      action={
        <a href="#nuevo-beneficiario" className={buttonClasses('secondary')}>
          Agregar beneficiario
        </a>
      }
    />
  </div>
);
