const preset = require('jest-expo/jest-preset');

// Los paquetes locales se transforman igual que los de Expo: se agrega @devchrisvaz a la lista de
// excepciones del preset, que no se fusiona con la de este archivo.
const [nodeModules, ...otherIgnorePatterns] = preset.transformIgnorePatterns;

module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  clearMocks: true,
  transform: { '\\.mjs$': preset.transform['\\.[jt]sx?$'] },
  transformIgnorePatterns: [
    nodeModules.replace(/\)\)$/, '|@devchrisvaz))'),
    ...otherIgnorePatterns,
  ],
  // Metro resuelve la salida ESM del contrato (condición `import`); Jest usaría la CommonJS, cuyo
  // createApiClient falla por la interoperabilidad con openapi-fetch (design.md, N1).
  moduleNameMapper: {
    '^@devchrisvaz/wallet-contract$':
      '<rootDir>/node_modules/@devchrisvaz/wallet-contract/dist/index.mjs',
  },
};
