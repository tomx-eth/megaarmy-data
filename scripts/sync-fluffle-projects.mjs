#!/usr/bin/env node
/**
 * Sync Fluffle Projects
 *
 * Fetches latest project data from the Fluffle API and updates fluffleProjects.json
 *
 * Usage:
 *   node scripts/sync-fluffle-projects.mjs [--dry-run]
 */

import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FLUFFLE_PROJECTS_PATH = join(__dirname, '../data/fluffleProjects.json');
const FLUFFLE_API_URL = 'https://api.fluffle.tools/api/projects';

const isDryRun = process.argv.includes('--dry-run');

async function fetchFluffleProjects() {
  console.log('📥 Fetching projects from Fluffle API...');

  const response = await fetch(FLUFFLE_API_URL);
  if (!response.ok) {
    throw new Error(`Fluffle API error: ${response.status}`);
  }

  const data = await response.json();
  const projects = data.projects || data;

  if (!Array.isArray(projects)) {
    throw new Error('Invalid response format from Fluffle API');
  }

  console.log(`   Found ${projects.length} projects`);
  return projects;
}

function normalizeProject(project) {
  // Keep only the fields we need, clean up the data
  return {
    name: project.name,
    twitter: project.twitter || null,
    description: project.description || null,
    category: project.category || null,
    megaMafia: project.megaMafia === true,
    native: project.native === true,
    live: project.live === true,
    img: project.img || null,
    website: project.website || null,
    discord: project.discord || null,
    telegram: project.telegram || null,
  };
}

async function main() {
  try {
    // Load existing projects
    const existingProjects = JSON.parse(readFileSync(FLUFFLE_PROJECTS_PATH, 'utf-8'));
    console.log(`📂 Loaded ${existingProjects.length} existing projects`);

    // Fetch latest from API
    const apiProjects = await fetchFluffleProjects();

    // Normalize and prepare new data
    const normalizedProjects = apiProjects
      .filter(p => p.name) // Must have a name
      .map(normalizeProject)
      .sort((a, b) => a.name.localeCompare(b.name));

    // Count changes
    const existingNames = new Set(existingProjects.map(p => p.name?.toLowerCase()));
    const newNames = new Set(normalizedProjects.map(p => p.name?.toLowerCase()));

    const added = normalizedProjects.filter(p => !existingNames.has(p.name?.toLowerCase()));
    const removed = existingProjects.filter(p => !newNames.has(p.name?.toLowerCase()));

    // Count MegaMafia
    const megaMafiaCount = normalizedProjects.filter(p => p.megaMafia).length;

    console.log(`\n📊 Summary:`);
    console.log(`   Total projects: ${normalizedProjects.length}`);
    console.log(`   MegaMafia partners: ${megaMafiaCount}`);
    console.log(`   New projects: ${added.length}`);
    console.log(`   Removed projects: ${removed.length}`);

    if (added.length > 0) {
      console.log(`\n✅ New projects:`);
      added.slice(0, 10).forEach(p => console.log(`   + ${p.name} (${p.category || 'uncategorized'})`));
      if (added.length > 10) console.log(`   ... and ${added.length - 10} more`);
    }

    if (removed.length > 0) {
      console.log(`\n❌ Removed projects:`);
      removed.slice(0, 5).forEach(p => console.log(`   - ${p.name}`));
      if (removed.length > 5) console.log(`   ... and ${removed.length - 5} more`);
    }

    if (isDryRun) {
      console.log(`\n🔍 Dry run - no changes made`);
    } else {
      writeFileSync(FLUFFLE_PROJECTS_PATH, JSON.stringify(normalizedProjects, null, 2) + '\n');
      console.log(`\n💾 Updated ${FLUFFLE_PROJECTS_PATH}`);
    }

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

main();
