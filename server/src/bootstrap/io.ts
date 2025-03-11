import { z } from 'zod';
import { Core } from '@strapi/strapi';

import SocketIO from '../structures/SocketIO';
import pluginId from '../utils/pluginId';
import { Plugin } from '../config/schema';

async function bootstrapIO({ strapi }: { strapi: Core.Strapi }) {
  const settings: Plugin = strapi.config.get(`plugin::${pluginId}`);

  const io = new SocketIO(settings.socket);

  strapi.$io = io;

  if (settings.events?.length) {
    strapi.$io.server.on('connection', (socket) => {
      for (const event of settings.events) {
        if (event.name === 'connection') {
          event.handler({ strapi, io }, socket);
        } else {
          socket.on(event.name, (...args) => event.handler({ strapi, io }, socket, ...args));
        }
      }
    });
  }
}

export default bootstrapIO;
