#!/usr/bin/env node
/**
 * Update Project Metadata Script
 *
 * Finds OLI projects that are missing from customProjects.json and attempts to
 * fetch their metadata (logos, descriptions) from various sources.
 *
 * Usage:
 *   node scripts/update-project-metadata.mjs [--dry-run] [--auto]
 *
 * Options:
 *   --dry-run  Show what would be added without making changes
 *   --auto     Auto-add projects with 2+ contracts (for cron/automated use)
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CUSTOM_PROJECTS_PATH = path.join(__dirname, '../data/customProjects.json');
const FLUFFLE_PROJECTS_PATH = path.join(__dirname, '../data/fluffleProjects.json');

// OLI API config
const OLI_API_BASE = 'https://api.openlabelsinitiative.org';
const OLI_CHAIN_ID = 'eip155:4326';
const MIN_CONTRACTS_FOR_AUTO = 1; // Auto-add all OLI projects

// Known Twitter handles for MegaETH projects (kept in sync with ecosystem)
const TWITTER_HANDLE_PATTERNS = {
  // MegaETH ecosystem projects
  'kumbaya-xyz': 'kumbaya_xyz',
  'sectoronedex': 'SectorOneDEX',
  'sir-trading': 'leveragesir',
  'skate-org': 'skate_chain',
  'mega-warren': 'mega_warren',
  'onchaingm': 'OnChainGm',
  'warren': 'thewarren_app',
  'warpx': 'warpxdex',
  'megapunks': 'Megaeth_Punks',
  'currentx-dex': 'CurrentXDex',
  'prismfi': 'prismfi_xyz',
  'crossy-fluffle': 'megaeth_labs',
  'smasher-fun': 'smasher_fun',
  'stomp-gg': 'stompgg',
  'bebe-dog': 'bebe_dog',
  'gte-xyz': 'GTE_XYZ',
  'topstrike-io': 'topstrike_io',
  'world-markets': 'wcm_inc',
  // Known multi-chain projects
  'layer-zero': 'LayerZero_Labs',
  'redstone-finance': 'redstone_defi',
};

// Category mappings based on OLI category field
const CATEGORY_MAP = {
  'dex': 'DEX',
  'gambling': 'Gaming',
  'defi': 'DeFi',
  'non_fungible_tokens': 'NFT',
  'fungible_tokens': 'Token',
  'bridge': 'Bridge',
  'oracle': 'Oracle',
  'social': 'Social',
  'gaming': 'Gaming',
  'infrastructure': 'Infra',
  'wallet': 'Wallet',
  'exchange': 'Exchange',
  'community': 'Community',
};

async function fetchOliLabels() {
  console.log('📥 Fetching fresh OLI labels...');
  const url = `${OLI_API_BASE}/attestations?chain_id=${OLI_CHAIN_ID}&limit=1000`;
  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OLI API error: ${response.status} - ${text}`);
  }
  const data = await response.json();
  return data.attestations;
}

async function loadExistingProjects() {
  const [customData, fluffleData] = await Promise.all([
    fs.readFile(CUSTOM_PROJECTS_PATH, 'utf-8').then(JSON.parse),
    fs.readFile(FLUFFLE_PROJECTS_PATH, 'utf-8').then(JSON.parse).catch(() => []),
  ]);

  const known = new Set();
  for (const p of customData) {
    if (p.name) {
      // Add both the original name and normalized versions to catch duplicates
      const name = p.name.toLowerCase();
      known.add(name);
      // Also add slug version (spaces -> hyphens)
      known.add(name.replace(/\s+/g, '-'));
      // Also add without common suffixes
      known.add(name.replace(/\s+(xyz|io|app|fi|finance|protocol|labs)$/i, ''));
    }
  }
  for (const p of fluffleData) {
    if (p.name) {
      const name = p.name.toLowerCase();
      known.add(name);
      known.add(name.replace(/\s+/g, '-'));
    }
  }

  return { customProjects: customData, knownProjects: known };
}

function getProjectsFromOli(attestations) {
  const projects = new Map();

  for (const att of attestations) {
    if (att.revoked) continue;

    const tags = att.tags_json || {};
    const projectName = tags.owner_project || tags.project_name;
    if (!projectName) continue;

    const key = projectName.toLowerCase();
    if (!projects.has(key)) {
      projects.set(key, {
        name: projectName,
        contractCount: 0,
        categories: new Set(),
        sources: new Set(),
      });
    }

    const proj = projects.get(key);
    proj.contractCount++;
    if (tags.usage_category) {
      proj.categories.add(tags.usage_category);
    }
    if (tags._source) {
      proj.sources.add(tags._source);
    }
  }

  return projects;
}

function guessTwitterHandle(projectName) {
  const lower = projectName.toLowerCase();

  // Check known mappings first
  if (TWITTER_HANDLE_PATTERNS[lower]) {
    return TWITTER_HANDLE_PATTERNS[lower];
  }

  // Try common patterns
  // 1. Replace hyphens with underscores
  const underscored = projectName.replace(/-/g, '_');

  // 2. Remove common suffixes
  const cleaned = lower
    .replace(/-xyz$/, '')
    .replace(/-io$/, '')
    .replace(/-finance$/, '')
    .replace(/-protocol$/, '')
    .replace(/-labs$/, '')
    .replace(/-org$/, '');

  return underscored;
}

function guessCategory(categories) {
  for (const cat of categories) {
    if (CATEGORY_MAP[cat]) {
      return CATEGORY_MAP[cat];
    }
  }
  return 'DeFi'; // Default
}

/**
 * Format a slug name to a proper display name
 * e.g., "world-markets" -> "World Markets", "kumbaya-xyz" -> "Kumbaya"
 */
function formatProjectName(slug) {
  if (!slug) return 'Unknown';
  return slug
    .replace(/[-_](xyz|io|app|fi|finance|protocol|labs|network|exchange|dex|swap)$/i, '')
    .replace(/[-_]/g, ' ')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const autoMode = process.argv.includes('--auto');

  console.log('🔄 Updating project metadata...');
  console.log(`   Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}${autoMode ? ' (auto)' : ''}`);
  console.log('');

  // Load existing projects
  const { customProjects, knownProjects } = await loadExistingProjects();
  console.log(`📦 Loaded ${knownProjects.size} known projects`);

  // Fetch OLI labels
  const attestations = await fetchOliLabels();
  console.log(`🏷️  Fetched ${attestations.length} attestations from OLI`);

  // Get unique projects from OLI
  const oliProjects = getProjectsFromOli(attestations);
  console.log(`📊 Found ${oliProjects.size} unique projects in OLI`);
  console.log('');

  // Find missing projects (sorted by contract count)
  const missing = [];
  for (const [key, proj] of oliProjects) {
    if (!knownProjects.has(key)) {
      missing.push(proj);
    }
  }
  missing.sort((a, b) => b.contractCount - a.contractCount);

  console.log(`❌ Missing ${missing.length} projects from customProjects.json:`);
  console.log('');

  // In auto mode, only add projects with MIN_CONTRACTS_FOR_AUTO+ contracts
  // Otherwise, add top 30
  const toAdd = autoMode
    ? missing.filter(p => p.contractCount >= MIN_CONTRACTS_FOR_AUTO)
    : missing.slice(0, 30);

  for (const proj of toAdd) {
    const cats = Array.from(proj.categories).join(', ') || 'unknown';
    console.log(`   ${proj.contractCount.toString().padStart(3)} contracts: ${proj.name} (${cats})`);
  }

  if (!autoMode && missing.length > 30) {
    console.log(`   ... and ${missing.length - 30} more`);
  }
  console.log('');

  // Generate new project entries
  const newProjects = [];
  for (const proj of toAdd) {
    const twitter = guessTwitterHandle(proj.name);
    const category = guessCategory(proj.categories);

    newProjects.push({
      name: formatProjectName(proj.name),
      img: `https://unavatar.io/twitter/${twitter}`,
      description: `${category} project on MegaETH`,
      twitter: twitter,
      category: category,
    });
  }

  if (!dryRun && newProjects.length > 0) {
    // Add new projects to customProjects.json
    const updatedProjects = [...customProjects, ...newProjects];
    await fs.writeFile(CUSTOM_PROJECTS_PATH, JSON.stringify(updatedProjects, null, 2) + '\n');
    console.log(`✅ Added ${newProjects.length} new projects to customProjects.json`);
    console.log('');
    console.log('NOTE: You may need to rebuild the frontend for changes to take effect.');
  } else if (dryRun) {
    console.log(`🔍 Would add ${newProjects.length} new projects (dry run)`);
    if (newProjects.length > 0) {
      console.log('');
      console.log('Sample entries:');
      for (const p of newProjects.slice(0, 5)) {
        console.log(JSON.stringify(p, null, 2));
      }
    }
  } else {
    console.log('✅ No new projects to add');
  }

  console.log('');
  console.log('Done!');
}

main().catch(console.error);
