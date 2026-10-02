// Vercel Function: POST /api
import { handle } from '../lib/actions.js';

export default async function handler(req, res) {
  return handle(req, res);
}
