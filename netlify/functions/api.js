const { bootstrap } = require('../../dist/lambda');

let serverPromise;

exports.handler = async (event, context) => {
  if (!serverPromise) {
    serverPromise = bootstrap();
  }
  const server = await serverPromise;
  return server(event, context);
};
