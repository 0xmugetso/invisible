import {PHASE_DEVELOPMENT_SERVER} from 'next/constants.js';

export default function config(phase) {
  const shared = {trailingSlash:true, devIndicators:false};
  if (phase !== PHASE_DEVELOPMENT_SERVER) return {...shared, output:'export'};

  return {
    ...shared,
    async rewrites() {
      return [
        {source:'/api/research', destination:'https://invisible-gray.vercel.app/api/research'},
        {source:'/activity/blocks.json', destination:'https://invisible-gray.vercel.app/activity/blocks.json'},
      ];
    },
  };
}
