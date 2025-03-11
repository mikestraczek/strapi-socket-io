import { Server } from 'socket.io';

import handshake from '../middlewares';
import getService from '../utils/getService';
import pluginId from '../utils/pluginId';
import API_TOKEN_TYPE from '../utils/constants';
import { Plugin } from '../config/schema';

class SocketIO {
  private _socket: Server;

  constructor(options: Plugin['socket']) {
    this._socket = new Server(strapi.server.httpServer, options.serverOptions);

    const { hooks } = strapi.config.get(`plugin::${pluginId}`) as Plugin;

    hooks.init?.({ strapi, $io: this });

    this._socket.use(handshake);
  }

  // eslint-disable-next-line no-unused-vars
  async emit({ event, schema, data: rawData }) {
    const sanitizeService = getService({ name: 'sanitize' });
    const strategyService = getService({ name: 'strategies' });
    const transformService = getService({ name: 'transform' });

    if (!rawData) {
      return;
    }

    const eventName = `${schema.singularName}:${event}`;

    for (const strategyType in strategyService) {
      if (Object.hasOwnProperty.call(strategyService, strategyType)) {
        const strategy = strategyService[strategyType];
        let rooms = [];

        try {
          rooms = await strategy.getRooms();
        } catch (error) {
          console.error('error', error);
        }

        console.log('rooms', rooms);

        for (const room of rooms) {
          const permissions = room.permissions.map(({ action }) => ({ action }));
          const ability = await strapi.contentAPI.permissions.engine.generateAbility(permissions);

          if (
            room.type === API_TOKEN_TYPE.FULL_ACCESS ||
            ability.can(schema.uid + '.' + event, undefined)
          ) {
            try {
              const sanitizedData = await sanitizeService.output({
                data: rawData,
                schema,
                options: {
                  auth: {
                    name: strategy.name,
                    ability,
                    strategy: {
                      verify: strategy.verify,
                    },
                    credentials: strategy.credentials?.(room),
                  },
                },
              });

              const roomName = strategy.getRoomName(room);
              const data = transformService.response({ data: sanitizedData, schema });

              console.log('data', data);
              console.log('roomName', roomName.replace(' ', '-'));

              try {
                this._socket.to(roomName.replace(' ', '-')).emit(eventName, { ...data });
              } catch (error) {
                console.error('socketError', error);
              }
            } catch (error) {
              console.error('sanitizedData', error);
            }
          }
        }
      }
    }
  }

  async raw({ event, data, rooms }) {
    let emitter = this._socket;

    // send to all specified rooms
    if (rooms && rooms.length) {
      rooms.forEach((r) => {
        // @ts-ignore
        emitter = emitter.to(r);
      });
    }

    emitter.emit(event, { data });
  }

  get server() {
    return this._socket;
  }
}

export default SocketIO;
