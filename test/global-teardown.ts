export default async function globalTeardown() {
  const mockHcmApp = global.__MOCK_HCM_APP__;
  if (mockHcmApp) {
    await mockHcmApp.close();
    console.log('Mock HCM server stopped');
  }
}
