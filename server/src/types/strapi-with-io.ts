import { Core } from '@strapi/strapi';
import SocketIO from '../structures/SocketIO';

type StrapiWithIO = Core.Strapi & { $io: SocketIO };

export default StrapiWithIO;
