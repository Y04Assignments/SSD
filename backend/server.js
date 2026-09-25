import app from './app.js';

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  // eslint-disable-next-line no-console
  console.error('FATAL: JWT_SECRET environment variable is missing in production.');
  process.exit(1);
}

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server is running on port ${PORT}`);
});
