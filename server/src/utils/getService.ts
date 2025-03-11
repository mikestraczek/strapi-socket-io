import pluginId from './pluginId';

function getService({ name = '', plugin = pluginId, type = 'plugin' }) {
  let serviceUID = `${type}::${plugin}`;

  if (name && name.length) {
    serviceUID += `.${name}`;
  }

  // @ts-ignore
  return strapi.service(serviceUID);
}

export default getService;
