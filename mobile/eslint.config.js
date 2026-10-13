// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');

// MOB-02: AsyncStorage guarda en claro; los tokens solo van en expo-secure-store o en memoria.
const ASYNC_STORAGE = '@react-native-async-storage/async-storage';
const ASYNC_STORAGE_MESSAGE =
  'MOB-02: AsyncStorage guarda en claro. El refresh token va en expo-secure-store y el access token solo en memoria.';

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: ['dist/*', '.expo/*', 'coverage/*', 'expo-env.d.ts'],
  },
  {
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: [{ name: ASYNC_STORAGE, message: ASYNC_STORAGE_MESSAGE }] },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: `CallExpression[callee.name='require'][arguments.0.value='${ASYNC_STORAGE}']`,
          message: ASYNC_STORAGE_MESSAGE,
        },
        {
          selector: `ImportExpression[source.value='${ASYNC_STORAGE}']`,
          message: ASYNC_STORAGE_MESSAGE,
        },
      ],
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
]);
