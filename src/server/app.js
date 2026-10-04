const express = require('express');
const path = require('path');
const apiRoutes = require('./routes/api');

function createApp() {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Serve static UI assets
  app.use(express.static(path.join(__dirname, 'public')));

  // Mount API
  app.use('/api', apiRoutes);

  // Fallback route
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  return app;
}

function startServer(initialPort = 4321, host = 'localhost', maxAttempts = 10) {
  const app = createApp();

  return new Promise((resolve, reject) => {
    let currentPort = Number(initialPort) || 4321;
    let attempts = 0;

    function tryListen() {
      const server = app.listen(currentPort, host);

      server.once('listening', () => {
        resolve({
          server,
          port: currentPort,
          host,
          url: `http://${host}:${currentPort}`,
          wasFallback: currentPort !== initialPort
        });
      });

      server.once('error', (err) => {
        if (err.code === 'EADDRINUSE' && attempts < maxAttempts) {
          attempts++;
          currentPort++;
          tryListen();
        } else {
          reject(err);
        }
      });
    }

    tryListen();
  });
}

module.exports = {
  createApp,
  startServer
};
