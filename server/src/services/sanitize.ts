import { sanitize as sanitizeUtils } from '@strapi/utils';

const sanitize = () => ({
  output({ schema, data, options }) {
    return sanitizeUtils.createAPISanitizers(options).output(data, schema);
  },
});

export default sanitize;
