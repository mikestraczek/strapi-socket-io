import { Server } from 'socket.io';

import handshake from '../middlewares';
import getService from '../utils/getService';
import pluginId from '../utils/pluginId';
import API_TOKEN_TYPE from '../utils/constants';
import { Plugin } from '../config/schema';

type EmitParams = {
  event: string;
  schema: {
    singularName: string;
    uid: string;
  };
  data: any;
};

type RawEmitParams = {
  event: string;
  data: any;
  rooms?: string[];
};

class SocketIO {
  private readonly _socket: Server;

  constructor(options: Plugin['socket']) {
    this._socket = new Server(strapi.server.httpServer, options.serverOptions);

    const { hooks } = strapi.config.get<Plugin>(`plugin::${pluginId}`);

    hooks.init?.({ strapi, $io: this });

    this._socket.use(handshake);
  }

  private async _processRoom(params: {
    room: any;
    strategy: any;
    eventName: string;
    schema: EmitParams['schema'];
    event: string;
    rawData: any;
  }) {
    const { room, strategy, eventName, schema, event, rawData } = params;
    const sanitizeService = getService({ name: 'sanitize' });
    const transformService = getService({ name: 'transform' });
    const permissions = room.permissions.map(({ action }) => ({ action }));
    const ability = await strapi.contentAPI.permissions.engine.generateAbility(permissions);

    if (
      room.type !== API_TOKEN_TYPE.FULL_ACCESS &&
      !ability.can(schema.uid + '.' + event, undefined)
    ) {
      return;
    }

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

      const roomName = strategy.getRoomName(room).replace(' ', '-');
      const data = transformService.response({ data: sanitizedData, schema });

      this._socket.to(roomName).emit(eventName, { ...data });
    } catch (error) {
      console.error('Error processing room:', error);
    }
  }

  private async _processStrategy(params: {
    strategyType: string;
    strategy: any;
    eventName: string;
    schema: EmitParams['schema'];
    event: string;
    rawData: any;
  }) {
    const { strategy, eventName, schema, event, rawData } = params;

    let rooms = [];

    try {
      rooms = await strategy.getRooms();
    } catch (error) {
      console.error('Error getting rooms:', error);
      return;
    }

    // Jeden Raum verarbeiten
    for (const room of rooms) {
      await this._processRoom({
        room,
        strategy,
        eventName,
        schema,
        event,
        rawData,
      });
    }
  }

  async emit({ event, schema, data: rawData }: EmitParams) {
    if (!rawData) {
      return;
    }

    const strategyService = getService({ name: 'strategies' });
    const eventName = `${schema.singularName}:${event}`;

    for (const strategyType in strategyService) {
      if (!Object.hasOwnProperty.call(strategyService, strategyType)) {
        continue;
      }

      const strategy = strategyService[strategyType];

      await this._processStrategy({
        strategyType,
        strategy,
        eventName,
        schema,
        event,
        rawData,
      });
    }
  }

  async raw({ event, data, rooms }: RawEmitParams) {
    let emitter = this._socket;

    if (rooms?.length) {
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
