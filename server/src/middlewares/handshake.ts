import { Socket } from 'socket.io';
import getService from '../utils/getService';

async function handshake(socket: Socket, next) {
  const strategyService = getService({ name: 'strategies' });
  const auth = socket.handshake.auth || {};
  const token = auth.token || '';
  let strategy = auth.strategy || 'jwt';

  if (token.length === 0) {
    strategy = '';
  }

  try {
    let room;

    if (strategy && strategy.length) {
      const strategyType = strategy === 'jwt' ? 'role' : 'token';
      const ctx = await strategyService[strategyType].authenticate(auth);

      room = strategyService[strategyType].getRoomName(ctx);
    } else if (strapi.plugin('users-permissions')) {
      const role = await strapi
        .query('plugin::users-permissions.role')
        .findOne({ where: { type: 'public' }, select: ['id', 'name'] });

      room = strategyService['role'].getRoomName(role);
    }

    if (room) {
      socket.join(room.replace(' ', '-'));
    } else {
      throw new Error('No valid room found');
    }

    next();
  } catch (error) {
    next(new Error(error.message));
  }
}

export default handshake;
