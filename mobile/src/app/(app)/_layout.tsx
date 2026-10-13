import { Stack } from 'expo-router';

/** Pantallas que requieren sesión (protegidas en la navegación raíz). */
export default function AppLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
