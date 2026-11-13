export const publicOrigin = 'https://invisible-gray.vercel.app';

export function appOrigin() {
  return new URL(process.env.INVISIBLE_ORIGIN || publicOrigin).origin;
}
