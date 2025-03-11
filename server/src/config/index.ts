import plugin from './schema';

export default {
  default: {
    events: [],
    hooks: {},
    socket: {
      serverOptions: { cors: { origin: 'http://127.0.0.1:8080', methods: ['GET', 'POST'] } },
    },
  },
  validator(config) {
    return plugin.parse(config);
  },
};
