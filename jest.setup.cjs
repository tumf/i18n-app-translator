// Global mocks for Jest tests

// Mock process.exit
jest.spyOn(process, 'exit').mockImplementation((code) => {
  throw new Error(`Process.exit called with code ${code}`);
});

// Add other global mocks here as needed 