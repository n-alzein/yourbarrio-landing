export default ({ env }) => {
  const origins = env.array('CORS_ORIGINS', ['http://localhost:3000']);
  const debugAuth = env.bool('DEBUG_AUTH', false);

  return [
    'strapi::logger',
    'strapi::errors',
    'strapi::security',
    {
      name: 'strapi::cors',
      config: {
        origin: origins,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
        headers: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
        credentials: true,
        maxAge: 600,
        keepHeaderOnError: true,
      },
    },
    ...(debugAuth ? ['global::auth-request-logger'] : []),
    'strapi::poweredBy',
    'strapi::query',
    'strapi::body',
    'strapi::session',
    'strapi::favicon',
    'strapi::public',
  ];
};
