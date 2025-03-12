import { Core } from '@strapi/strapi';
import { errors } from '@strapi/utils';
import { differenceInHours, parseISO } from 'date-fns';
import { castArray, every, isNil, pipe } from 'lodash/fp';

import API_TOKEN_TYPE from '../utils/constants';
import getService from '../utils/getService';

const strategies = ({ strapi }: { strapi: Core.Strapi }) => ({
  role: {
    name: 'io-role',
    credentials: function (role) {
      return `${this.name}-${role.id}`;
    },
    authenticate: async function (auth: { token: string }) {
      const jwtService = getService({ name: 'jwt', plugin: 'users-permissions' });
      const userService = getService({ name: 'user', plugin: 'users-permissions' });
      const token = await jwtService.verify(auth.token);

      if (!token) {
        throw new errors.UnauthorizedError('Invalid credentials');
      }

      const { id } = token;

      if (id === undefined) {
        throw new errors.UnauthorizedError('Invalid credentials');
      }

      const user = await userService.fetchAuthenticatedUser(id);

      if (!user) {
        throw new errors.UnauthorizedError('Invalid credentials');
      }

      const advancedSettings = await strapi
        .store({ type: 'plugin', name: 'users-permissions' })
        .get({ key: 'advanced' });

      // @ts-ignore
      if (advancedSettings.email_confirmation && !user.confirmed) {
        throw new errors.UnauthorizedError('Invalid credentials');
      }

      if (user.blocked) {
        throw new errors.UnauthorizedError('Invalid credentials');
      }

      return strapi.documents('plugin::users-permissions.role').findOne({
        documentId: user.role.documentId,
        fields: ['id', 'name'],
      });
    },
    verify: function (auth, config) {
      const { ability } = auth;

      if (!ability) {
        throw new errors.UnauthorizedError();
      }

      const isAllowed = pipe(
        castArray,
        every((scope) => ability.can(scope))
      )(config.scope);

      if (!isAllowed) {
        throw new errors.ForbiddenError();
      }
    },
    getRoomName: function (role: { name: string }) {
      return `${this.name}-${role.name.toLowerCase()}`;
    },
    getRooms: async function () {
      try {
        const roles = await strapi.db.query('plugin::users-permissions.role').findMany({
          select: ['id', 'name'],
        });

        for (const role of roles) {
          const permissions = await strapi.db
            .query('plugin::users-permissions.permission')
            .findMany({
              select: ['action'],
              where: { role: role.id },
            });

          role.permissions = permissions;
        }

        return roles;
      } catch (error) {
        return [];
      }
    },
  },

  token: {
    name: 'io-token',
    credentials: function (token) {
      return token;
    },
    authenticate: async function (auth: { token: string }) {
      const apiTokenService = getService({ type: 'admin', plugin: 'api-token' });
      const token = auth.token;

      if (!token) {
        throw new errors.UnauthorizedError('Invalid credentials');
      }

      const apiToken = await strapi.query('admin::api-token').findOne({
        where: { accessKey: apiTokenService.hash(token) },
        select: ['id', 'name', 'type', 'lastUsedAt', 'expiresAt'],
        populate: ['permissions'],
      });

      if (!apiToken) {
        throw new errors.UnauthorizedError('Invalid credentials');
      }

      const currentDate = new Date();

      if (!isNil(apiToken.expiresAt)) {
        const expirationDate = new Date(apiToken.expiresAt);

        if (expirationDate < currentDate) {
          throw new errors.UnauthorizedError('Token expired');
        }
      }

      if (
        !apiToken.lastUsedAt ||
        differenceInHours(currentDate, parseISO(apiToken.lastUsedAt)) >= 1
      ) {
        await strapi.query('admin::api-token').update({
          where: { id: apiToken.id },
          data: { lastUsedAt: currentDate },
        });
      }

      return apiToken;
    },
    verify: function (auth, config) {
      // adapted from https://github.com/strapi/strapi/blob/main/packages/core/admin/server/strategies/api-token.js#L82
      const { credentials: apiToken, ability } = auth;
      if (!apiToken) {
        throw new errors.UnauthorizedError('Token not found');
      }

      if (!isNil(apiToken.expiresAt)) {
        const currentDate = new Date();
        const expirationDate = new Date(apiToken.expiresAt);
        // token has expired
        if (expirationDate < currentDate) {
          throw new errors.UnauthorizedError('Token expired');
        }
      }

      if (apiToken.type === API_TOKEN_TYPE.FULL_ACCESS) {
        return;
      } else if (apiToken.type === API_TOKEN_TYPE.READ_ONLY) {
        const scopes = castArray(config.scope);

        if (config.scope) {
          return;
        }
      } else if (apiToken.type === API_TOKEN_TYPE.CUSTOM) {
        if (!ability) {
          throw new errors.ForbiddenError();
        }

        const scopes = castArray(config.scope);

        const isAllowed = scopes.every((scope) => ability.can(scope));

        if (isAllowed) {
          return;
        }
      }

      throw new errors.ForbiddenError();
    },
    getRoomName: function (token) {
      return `${this.name}-${token.name.toLowerCase()}`;
    },
    getRooms: async function () {
      try {
        const tokens = await strapi.db.query('admin::api-token').findMany({
          select: ['id', 'type', 'name'],
          where: {
            $or: [
              {
                expiresAt: {
                  $gte: new Date(),
                },
              },
              {
                expiresAt: null,
              },
            ],
          },
        });

        for (const token of tokens) {
          const permissions = await strapi.db.query('admin::api-token-permission').findMany({
            select: ['action'],
            where: { token: token.id },
          });

          token.permissions = permissions;
        }

        return tokens;
      } catch (error) {
        return [];
      }
    },
  },
});

export default strategies;
