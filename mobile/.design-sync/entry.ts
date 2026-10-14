/*
 * Superficie del sistema de diseño móvil que se sincroniza con Claude Design: el inventario de
 * components/ui (design-system, D7) y el contenedor de pantalla. En el navegador, `react-native`
 * se resuelve a react-native-web (ver build-ui.mjs), como en Expo para web.
 */
export * from '@/components/ui';
export { Screen } from '@/components/screen';

/*
 * Piezas para que el agente de diseño componga pantallas con los mismos estilos que la app: el
 * tema de tokens y las primitivas de React Native que usan los componentes.
 */
export { theme, type NativeTheme } from '@/theme';
// En la app lo monta expo-router; Screen y Select lo necesitan para las áreas seguras.
export { SafeAreaProvider } from 'react-native-safe-area-context';
export {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
