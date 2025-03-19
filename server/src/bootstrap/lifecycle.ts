import StrapiWithIO from '../types/strapi-with-io';
import pluginId from '../utils/pluginId';

async function bootstrapLifecycles({ strapi }: { strapi: StrapiWithIO }) {
  strapi.config.get(`plugin::${pluginId}.contentTypes`, []).forEach((ct) => {
    const uid = ct.uid ? ct.uid : ct;

    const subscriber: any = {
      models: [uid],
    };

    if (!ct.actions || ct.actions.includes('create')) {
      const eventType = 'create';

      subscriber.afterCreate = async (event) => {
        strapi.$io.emit({
          event: eventType,
          schema: event.model,
          data: event.result,
        });
      };

      subscriber.afterCreateMany = async (event) => {
        const query = buildEventQuery({ event });

        if (query.filters) {
          const records = await strapi.documents(uid).findMany(query);

          records.forEach((r) => {
            strapi.$io.emit({
              event: eventType,
              schema: event.model,
              data: r,
            });
          });
        }
      };
    }

    if (!ct.actions || ct.actions.includes('update')) {
      const eventType = 'update';

      subscriber.afterUpdate = async (event) => {
        strapi.$io.emit({
          event: eventType,
          schema: event.model,
          data: event.result,
        });
      };

      subscriber.beforeUpdateMany = async (event) => {
        const query = buildEventQuery({ event });

        if (query.filters) {
          const ids = await strapi.documents(uid).findMany(query);
          if (!event.state.io) {
            event.state.io = {};
          }
          event.state.io.ids = ids;
        }
      };

      subscriber.afterUpdateMany = async (event) => {
        if (!event.state.io?.ids) {
          return;
        }

        const records = await strapi.documents(uid).findMany({
          filters: { id: event.state.io.ids },
        });

        records.forEach((r) => {
          strapi.$io.emit({
            event: eventType,
            schema: event.model,
            data: r,
          });
        });
      };
    }

    if (!ct.actions || ct.actions.includes('delete')) {
      const eventType = 'delete';

      subscriber.afterDelete = async (event) => {
        strapi.$io.emit({
          event: eventType,
          schema: event.model,
          data: event.result,
        });
      };

      subscriber.beforeDeleteMany = async (event) => {
        const query = buildEventQuery({ event });

        if (query.filters) {
          const records = await strapi.documents(uid).findMany(query);

          if (!event.state.io) {
            event.state.io = {};
          }

          event.state.io.records = records;
        }
      };

      subscriber.afterDeleteMany = async (event) => {
        if (!event.state.io?.records) {
          return;
        }

        event.state.io.records.forEach((r) => {
          strapi.$io.emit({
            event: eventType,
            schema: event.model,
            data: r,
          });
        });
      };
    }

    strapi.db.lifecycles.subscribe(subscriber);
  });
}

function buildEventQuery({ event }) {
  const query: any = {};

  if (event.params.where) {
    query.filters = event.params.where;
  }

  if (event.result?.count) {
    query.limit = event.result.count;
  } else if (event.params.limit) {
    query.limit = event.params.limit;
  }

  if (event.action === 'afterCreateMany') {
    query.filters = { id: event.result.ids };
  } else if (event.action === 'beforeUpdate') {
    query.fields = ['id'];
  }

  return query;
}

export default bootstrapLifecycles;
