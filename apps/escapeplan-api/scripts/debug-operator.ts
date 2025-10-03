import { seedIdempotent } from '../src/db/seed.ts';
import { buildServer } from '../src/index.ts';

const server = await buildServer();
try {
  await seedIdempotent();
  const login = await server.inject({
    method: 'POST',
    url: '/api/auth/sign-in/username',
    payload: { username: 'admin', password: 'escapeplan' }
  });
  console.log('login status', login.statusCode);
  const cookie = (Array.isArray(login.headers['set-cookie']) ? login.headers['set-cookie'][0] : login.headers['set-cookie'])?.split(';')[0];
  const create = await server.inject({
    method: 'POST',
    url: '/api/admin/users',
    headers: { cookie: cookie ?? '' },
    payload: {
      username: 'debuguser',
      name: 'Debug User',
      email: 'debug@escapeplan.local',
      password: 'DebugPassword123!',
      role: 'manager',
      avatarConfig: { seed: 'debug', eyes: ['happy'], mouth: ['smile01'] }
    }
  });
  console.log('create status', create.statusCode);
  console.log('response', create.body);
} finally {
  await server.close();
}
