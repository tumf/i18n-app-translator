// Global mocks for Jest tests

// Mock process.exit
jest.spyOn(process, 'exit').mockImplementation((code) => {
  throw new Error(`Process.exit called with code ${code}`);
});

// Set CI environment variable to true to skip API calls in e2e tests
process.env.CI = 'true';

// Add other global mocks here as needed
