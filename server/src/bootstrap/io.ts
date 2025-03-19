import { Plugin } from '../config/schema';
import SocketIO from '../structures/SocketIO';
import StrapiWithIO from '../types/strapi-with-io';
import pluginId from '../utils/pluginId';

async function bootstrapIO({ strapi }: { strapi: StrapiWithIO }) {
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
