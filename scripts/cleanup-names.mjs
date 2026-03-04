#!/usr/bin/env node
/**
 * One-time cleanup script to convert slug names to proper display names
 * e.g., "kumbaya-xyz" -> "Kumbaya"
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CUSTOM_PROJECTS_PATH = path.join(__dirname, '../data/customProjects.json');
const FLUFFLE_PROJECTS_PATH = path.join(__dirname, '../data/fluffleProjects.json');

// Manual name mappings for known projects
const NAME_OVERRIDES = {
  'kumbaya-xyz': 'Kumbaya',
  'sectoronedex': 'SectorOne',
  'sir-trading': 'SIR Trading',
  'skate-org': 'Skate',
  'mega-warren': 'Mega Warren',
  'onchaingm': 'OnChainGM',
  'warpx': 'WarpX',
  'megapunks': 'MegaPunks',
  'currentx-dex': 'CurrentX',
  'prismfi': 'PrismFi',
  'crossy-fluffle': 'Crossy Fluffle',
  'smasher-fun': 'Smasher',
  'stomp-gg': 'Stomp',
  'bebe-dog': 'Bebe Dog',
  'gte-xyz': 'GTE',
  'topstrike-io': 'TopStrike',
  'noxa-fun': 'NOXA Fun',
  'gmx-io': 'GMX',
  'blur-io': 'Blur',
  'hop-protocol': 'Hop Protocol',
  'orbiter-finance': 'Orbiter Finance',
  'kyber-swap': 'KyberSwap',
  'morpho-org': 'Morpho',
  'beefy-finance': 'Beefy Finance',
  'pendle-finance': 'Pendle',
  'ethena-labs': 'Ethena',
  'renzo-protocol': 'Renzo',
  'puffer-fi': 'Puffer Finance',
  'stargate-finance': 'Stargate',
  'layer-zero': 'LayerZero',
  'base-org': 'Base',
  'scroll-tech': 'Scroll',
  'starknet-io': 'Starknet',
  'zircuit-labs': 'Zircuit',
  'manta-network': 'Manta',
  'mode-network': 'Mode',
  'graph-protocol': 'The Graph',
  'hyperlane-xyz': 'Hyperlane',
  'debridge-finance': 'deBridge',
  'mayan-finance': 'Mayan',
  'bebop-dex': 'Bebop',
  'odos-xyz': 'Odos',
  'elixir-protocol': 'Elixir',
  'carv-protocol': 'CARV',
  'pool-together': 'PoolTogether',
  'world-liberty-financial': 'World Liberty Financial',
  'bigtime-gg': 'Big Time',
  'mavia-gg': 'Mavia',
  'superform-xyz': 'Superform',
  'crypto-com': 'Crypto.com',
  '1-inch': '1inch',
  'aave-v3': 'Aave V3',
  'uniswap-v3': 'Uniswap V3',
  'shell-protocol': 'Shell Protocol',
  'gnd-protocol': 'GND Protocol',
  'bored-ape': 'Bored Ape',
  'trader-joe': 'Trader Joe',
  'titan-builder': 'Titan Builder',
  'shiba-inu': 'Shiba Inu',
  'revert-finance': 'Revert Finance',
  'symm-io': 'Symm',
  'transit-finance': 'Transit Finance',
  'onyx-protocol': 'Onyx Protocol',
  'kip-protocol': 'KIP Protocol',
  'd-hedge': 'dHedge',
  'dop-org': 'DOP',
  'alt-research': 'AltLayer',
  'eclipse-xyz': 'Eclipse',
  '0vix': '0VIX',
  'anime-xyz': 'Anime',
  'impermax-finance': 'Impermax',
  'rai-finance': 'RAI Finance',
  'venice-ai': 'Venice AI',
  'xen-crypto-faircrypto': 'XEN Crypto',
  'fren-pet': 'Fren Pet',
  'aigo-network': 'AIGO',
  'dmail-ai': 'Dmail',
  'clanker-devco': 'Clanker',
  'post-tech': 'Post Tech',
  'battledog-games': 'BattleDog',
  'khans-io': 'Khans',
  'chonks-xyz': 'Chonks',
  'aboard-exchange': 'Aboard',
  'revox-readon': 'Revox',
  'omniswap-omnibtc': 'OmniSwap',
  'verasity-io': 'Verasity',
  'mon-protocol': 'Mon Protocol',
  'mimic-finance': 'Mimic Finance',
  'darkmachine-game': 'Dark Machine',
  'infinex-xyz': 'Infinex',
  'king-protocol': 'King Protocol',
  'ethcoin-org': 'ETHCoin',
};

function formatProjectName(slug) {
  if (!slug) return slug;

  // Check overrides first
  const lower = slug.toLowerCase();
  if (NAME_OVERRIDES[lower]) {
    return NAME_OVERRIDES[lower];
  }

  // Skip if already properly formatted (contains spaces and isn't all lowercase)
  if (slug.includes(' ') && slug !== slug.toLowerCase()) {
    return slug;
  }

  // Skip if no hyphens/underscores (likely already a proper name)
  if (!slug.includes('-') && !slug.includes('_')) {
    return slug;
  }

  // Format: remove common suffixes, convert to title case
  return slug
    .replace(/[-_](xyz|io|app|fi|finance|protocol|labs|network|exchange|dex|swap|org|gg|fun)$/i, '')
    .replace(/[-_]/g, ' ')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

async function main() {
  console.log('🔄 Cleaning up project names...\n');

  // Load Fluffle data first to get proper names
  let fluffleNames = new Map();
  try {
    const fluffleData = JSON.parse(await fs.readFile(FLUFFLE_PROJECTS_PATH, 'utf-8'));
    for (const p of fluffleData) {
      if (p.name) {
        // Map slug versions to proper names
        const slug = p.name.toLowerCase().replace(/\s+/g, '-');
        fluffleNames.set(slug, p.name);
        fluffleNames.set(p.name.toLowerCase(), p.name);
      }
    }
    console.log(`📦 Loaded ${fluffleNames.size} names from Fluffle\n`);
  } catch (e) {
    console.log('⚠️ Could not load Fluffle data\n');
  }

  // Load and update custom projects
  const customData = JSON.parse(await fs.readFile(CUSTOM_PROJECTS_PATH, 'utf-8'));
  let changed = 0;

  for (const p of customData) {
    if (!p.name) continue;

    const oldName = p.name;
    const lower = oldName.toLowerCase();
    const slug = lower.replace(/\s+/g, '-');

    // Try to find proper name from Fluffle
    let newName = fluffleNames.get(slug) || fluffleNames.get(lower);

    // If not in Fluffle, format the name ourselves
    if (!newName) {
      newName = formatProjectName(oldName);
    }

    if (newName && newName !== oldName) {
      console.log(`  ${oldName} → ${newName}`);
      p.name = newName;
      changed++;
    }
  }

  console.log(`\n✅ Updated ${changed} project names`);

  // Save
  await fs.writeFile(CUSTOM_PROJECTS_PATH, JSON.stringify(customData, null, 2) + '\n');
  console.log('💾 Saved changes');
}

main().catch(console.error);
