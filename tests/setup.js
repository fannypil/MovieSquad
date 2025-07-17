// Load test environment variables
require("dotenv").config({ path: ".env.test" });

// Set test environment variables
process.env.NODE_ENV = "test";

// Increase timeout for database operations
jest.setTimeout(30000);

// Suppress console logs during testing (optional)
if (process.env.NODE_ENV === "test") {
  console.log = jest.fn();
  console.error = jest.fn();
}
