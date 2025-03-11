import bootstrapIO from './io';
import bootstrapLifecycles from './lifecycle';

async function bootstrap({ strapi }) {
  bootstrapIO({ strapi });
  bootstrapLifecycles({ strapi });
}

export default bootstrap;
