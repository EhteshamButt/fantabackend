const { bootstrap } = require('../../dist/lambda');

let serverPromise;

exports.handler = async (event, context) => {
  if (!serverPromise) {
    serverPromise = bootstrap();
  }
  const server = await serverPromise;

  // Netlify events lack requestContext which serverless-express needs
  // to identify the event source as API Gateway v1
  if (!event.requestContext) {
    event.requestContext = {
      stage: '',
      identity: {
        sourceIp: event.headers['client-ip'] || event.headers['x-forwarded-for'] || '',
      },
    };
  }

  return server(event, context);
};
