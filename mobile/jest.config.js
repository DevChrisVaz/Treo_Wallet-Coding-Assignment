const preset = require('jest-expo/jest-preset');

module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  transform: { '\\.mjs$': preset.transform['\\.[jt]sx?$'] },
  transformIgnorePatterns: [
    '/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@devchrisvaz))',
    ...preset.transformIgnorePatterns.slice(1),
  ],
  moduleNameMapper: {
    '^@devchrisvaz/wallet-contract$':
      '<rootDir>/node_modules/@devchrisvaz/wallet-contract/dist/index.mjs',
  },
};
