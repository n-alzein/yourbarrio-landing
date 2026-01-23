export default ({ env }) => ({
  auth: {
    secret: env('ADMIN_JWT_SECRET'),
    sessions: {
      maxRefreshTokenLifespan: 2592000,
      maxSessionLifespan: 2592000,
    },
  },
  apiToken: {
    salt: env('API_TOKEN_SALT'),
    secrets: {
      encryptionKey: env('ENCRYPTION_KEY'),
    },
  },
  transfer: {
    token: {
      salt: env('TRANSFER_TOKEN_SALT'),
    },
  },
  secrets: {
    encryptionKey: env('ENCRYPTION_KEY'),
  },
  flags: {
    nps: env.bool('FLAG_NPS', true),
    promoteEE: env.bool('FLAG_PROMOTE_EE', true),
  },
});
