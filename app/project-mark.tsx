const marks:Record<string,string> = {
  // Project marks from rhea.finance, nearmobile.app, docs.intear.tech, justhoot.fun,
  // pumpopoly.com, nearly.trade, metapool.app, and linearprotocol.org.
  rhea:'rhea.webp',
  nearmobile:'nearmobile.webp',
  intear:'intear.svg',
  justhoot:'justhoot.webp',
  pumpopoly:'pumpopoly.webp',
  nearly:'nearly.webp',
  metapool:'meta-pool.svg',
  linear:'linear.svg',
  // Issuer-published NEP-148 icons from gear.enleap.near and the HAPI bridge token.
  enleap:'enleap.webp',
  hapi:'hapi.svg',
  'stader':'stader.webp', // https://www.staderlabs.com/favicon-32x32.png
  'jumbo':'jumbo.svg', // https://jumbo.exchange/favicon.svg
  'octopus':'octopus.svg', // f5cfbc74057c610c8ef151a439252680ac68c6dc.factory.bridge.near ft_metadata
  'delta-trade':'delta-trade.webp', // https://www.deltatrade.ai/favicon.ico
  'potlock':'potlock.webp', // https://www.potlock.io/logo.png
  'keypom':'keypom.webp', // https://avatars.githubusercontent.com/u/115049464?v=4
  'templar-protocol':'templar-protocol.webp', // https://www.templarfi.org/api/icon?size=180
  'fastnear':'fastnear.webp', // https://fastnear.com/favicon.png
  'near-blocks':'sources/nearblocks.webp', // https://github.com/Nearblocks/nearblocks/blob/main/apps/frontend/public/favicon.ico
  'pikespeak':'pikespeak.svg', // https://pikespeak.ai/favicon.svg
  'meteor-wallet':'meteor-wallet.webp', // https://avatars.githubusercontent.com/u/103883315?v=4
  'nightly':'nightly.webp', // https://nightly.app/favicon.ico?favicon.b2e42f96.ico
  'near-devhub':'near-devhub.webp', // https://avatars.githubusercontent.com/u/132522219?v=4
  'publicai':'publicai.webp', // https://publicai.io/favicon.ico?favicon.0-jnqth8wpi3o.ico
  'sender-ai':'sender-ai.webp', // https://www.senderdao.io/assets/sender-bsk-NPUA.png
  'aurigami':'aurigami.webp', // https://www.aurigami.finance/favicon.ico
  'neartrade-terminal':'neartrade-terminal.webp', // https://www.neartrade.lol/logo.png
  'trufin':'trufin.svg', // https://truyields.com/img/app/favicon.svg
  'nearpad-family':'nearpad-family.svg', // https://nearpad.family/app-icon-192.svg
  'sodax':'sodax.webp', // https://www.sodax.com/favicon.ico
  'edge-video':'edge-video.webp', // https://edgevideo.ai/edge-video-icon.png
  'neko':'neko.webp', // https://nekoonnear.com/assets/apple-touch-icon.png
  'shitzu':'shitzu.webp', // https://app.shitzuapes.xyz/assets/apple-touch-icon.png
  'near-social':'social.svg', // https://near.social/icon.svg
  aurora:'aurora.svg', // https://aurora.dev/static/favicon.svg
  sweat:'sweat-round.webp', // https://swe.at/_next/static/media/sweat_icon_round.f2ea0af0.png
  'near-intents':'intents.png',
};

export default function ProjectMark({id}: {id:string}) {
  const mark = marks[id];
  return mark ? <img className="iv-project-mark" data-project-mark={id} src={'/marks/'+mark} width="28" height="28" alt=""/> : null;
}
