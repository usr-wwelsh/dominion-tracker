// Loaded first by every test file. Route modules require ../db at import time,
// which opens a database immediately — point that at an in-memory one so unit
// tests never touch the real db file.
process.env.NODE_ENV = 'test';
process.env.SQLITE_PATH = ':memory:';
