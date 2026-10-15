import { useState } from 'react';
import { SearchField } from 'wallet-web-ui';

/*
 * Campo de búsqueda (WEB-36): lupa a la izquierda, `type="search"`, × de 44 px con texto y Escape que
 * lo vacía. El filtro de la lista lo hace la pantalla (nombre, alias y CLABE, sin acentos).
 */

export const Empty = () => (
  <div className="max-w-md">
    <SearchField
      label="Buscar beneficiarios"
      placeholder="Buscar por nombre, alias o CLABE"
      value=""
      onChange={() => undefined}
      onClear={() => undefined}
    />
  </div>
);

export const Filled = () => (
  <div className="max-w-md">
    <SearchField
      label="Buscar beneficiarios"
      placeholder="Buscar por nombre, alias o CLABE"
      value="María"
      onChange={() => undefined}
      onClear={() => undefined}
    />
  </div>
);

/** Con estado propio: escribe para ver la × y púlsala o usa Escape para vaciarlo. */
export const Interactive = () => {
  const [query, setQuery] = useState('646180');
  return (
    <div className="max-w-md">
      <SearchField
        label="Buscar beneficiarios"
        placeholder="Buscar por nombre, alias o CLABE"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onClear={() => setQuery('')}
      />
    </div>
  );
};
