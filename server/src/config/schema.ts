import { z } from 'zod';

const event = z.object({
  name: z.string(),
  handler: z.function(),
});

const initHook = z.function();

const hooks = z.object({
  init: initHook.optional(),
});

const contentTypeAction = z.enum(['create', 'update', 'delete']);

const contentType = z.object({
  uid: z.string(),
  actions: z.array(contentTypeAction),
});

const socket = z.object({ serverOptions: z.unknown().optional() });

const plugin = z.object({
  events: z.array(event).optional(),
  hooks: hooks.optional(),
  contentTypes: z.array(z.union([z.string(), contentType])),
  socket: socket.optional(),
});

export type Event = z.infer<typeof event>;
export type Plugin = z.infer<typeof plugin>;
export type ContentType = z.infer<typeof contentType>;
export type ContentTypeAction = z.infer<typeof contentTypeAction>;
export type Socket = z.infer<typeof socket>;

export default plugin;
