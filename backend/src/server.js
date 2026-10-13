import app from './app.js';

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`🚀 Pinko App Server is running on http://localhost:${PORT}`);
  console.log(`🔒 Enforcement: Online-Only Contract, Minor-Unit Currency, Ledger-Backed Stock`);
});
