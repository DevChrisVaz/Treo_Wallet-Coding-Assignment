import { WorkSans_400Regular } from '@expo-google-fonts/work-sans/400Regular';
import { WorkSans_500Medium } from '@expo-google-fonts/work-sans/500Medium';
import { WorkSans_600SemiBold } from '@expo-google-fonts/work-sans/600SemiBold';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, type ReactNode } from 'react';

/**
 * Work Sans en los tres pesos del sistema (DSG-05). Cada peso es su propia familia, con el nombre
 * que usa el tema; se importan por separado para no incluir en el bundle los pesos que no se usan.
 */
export const appFonts = { WorkSans_400Regular, WorkSans_500Medium, WorkSans_600SemiBold };

/** Mantiene la pantalla de carga de Expo hasta que las fuentes cargan (o fallan). */
export function FontsGate({ children }: { children: ReactNode }) {
  const [loaded, error] = useFonts(appFonts);
  const ready = loaded || error !== null;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  // Si Work Sans no carga, React Native usa la fuente del sistema y el texto sigue legible.
  if (!ready) return null;
  return <>{children}</>;
}
