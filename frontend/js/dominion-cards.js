// Dominion card database — shared by the phone builds page (builds.js) and
// Big Picture mode (bigpicture.js). Data + cost/expansion lookups only.

// Dominion kingdom card database (organized by expansion)
const DOMINION_CARDS = {
  base: [
    'Cellar', 'Chapel', 'Moat',
    'Harbinger', 'Merchant', 'Vassal', 'Village', 'Workshop',
    'Bureaucrat', 'Gardens', 'Militia', 'Moneylender', 'Poacher', 'Remodel', 'Smithy', 'Throne Room',
    'Bandit', 'Council Room', 'Festival', 'Laboratory', 'Library', 'Market', 'Mine', 'Sentry', 'Witch',
    'Artisan'
  ],
  intrigue: [
    'Courtyard', 'Lurker', 'Pawn',
    'Masquerade', 'Shanty Town', 'Steward', 'Swindler', 'Wishing Well',
    'Baron', 'Bridge', 'Conspirator', 'Diplomat', 'Ironworks', 'Mill', 'Mining Village', 'Secret Passage',
    'Courtier', 'Duke', 'Minion', 'Patrol', 'Replace', 'Torturer', 'Trading Post', 'Upgrade',
    'Harem', 'Nobles'
  ],
  seaside: [
    'Haven', 'Lighthouse', 'Native Village',
    'Astrolabe', 'Fishing Village', 'Lookout', 'Monkey', 'Sea Chart', 'Smugglers', 'Warehouse',
    'Blockade', 'Caravan', 'Cutpurse', 'Island', 'Sailor', 'Salvager', 'Tide Pools', 'Treasure Map',
    'Bazaar', 'Corsair', 'Merchant Ship', 'Outpost', 'Pirate', 'Sea Witch', 'Tactician', 'Treasury', 'Wharf'
  ],
  prosperity: [
    'Anvil', 'Watchtower',
    'Bishop', 'Clerk', 'Investment', 'Monument', 'Quarry', 'Tiara', "Worker's Village",
    'Charlatan', 'City', 'Collection', 'Crystal Ball', 'Magnate', 'Mint', 'Rabble', 'Vault', 'War Chest',
    'Hoard', 'Grand Market',
    'Bank', 'Expand', 'Forge', "King's Court",
    'Peddler'
  ],
  empires: [
    'Engineer',
    'City Quarter', 'Overlord', 'Royal Blacksmith',
    'Encampment/Plunder', 'Patrician/Emporium', 'Settlers/Bustling Village',
    'Castles', 'Catapult/Rocks', 'Chariot Race', 'Enchantress', "Farmers' Market", 'Gladiator/Fortune',
    'Sacrifice', 'Temple', 'Villa',
    'Archive', 'Capital', 'Charm', 'Crown', 'Forum', 'Groundskeeper', 'Legionary', 'Wild Hunt'
  ],
  rising_sun: [
    'Mountain Shrine',
    'Daimyo',
    'Artist',
    'Fishmonger', 'Snake Witch',
    'Aristocrat', 'Craftsman', 'Riverboat', 'Root Cellar',
    'Alley', 'Change', 'Ninja', 'Poet', 'River Shrine', 'Rustic Village',
    'Gold Mine', 'Imperial Envoy', 'Kitsune', 'Litter', 'Rice Broker', 'Ronin', 'Tanuki', 'Tea House',
    'Samurai',
    'Rice'
  ],
  dark_ages: [
    'Poor House',
    'Beggar', 'Squire', 'Vagrant',
    'Forager', 'Hermit', 'Market Square', 'Sage', 'Storeroom', 'Urchin',
    'Armory', 'Death Cart', 'Feodum', 'Fortress', 'Ironmonger', 'Marauder', 'Procession', 'Rats',
    'Scavenger', 'Wandering Minstrel',
    'Band of Misfits', 'Bandit Camp', 'Catacombs', 'Count', 'Counterfeit', 'Cultist', 'Graverobber',
    'Junk Dealer', 'Knights', 'Mystic', 'Pillage', 'Rebuild', 'Rogue',
    'Altar', 'Hunting Grounds'
  ],
  hinterlands: [
    'Crossroads', "Fool's Gold", 'Cauldron',
    'Develop', 'Oasis', 'Scheme', 'Tunnel', 'Guard Dog',
    'Jack of All Trades', 'Spice Merchant', 'Trader', 'Nomads', 'Trail', 'Weaver',
    'Cartographer', 'Haggler', 'Highway', 'Inn', 'Margrave', 'Stables',
    'Berserker', 'Souk', 'Wheelwright', "Witch's Hut",
    'Border Village', 'Farmland'
  ],
  nocturne: [
    'Druid', 'Faithful Hound', 'Guardian', 'Monastery', 'Pixie', 'Tracker',
    'Changeling', 'Fool', 'Ghost Town', 'Leprechaun', 'Night Watchman', 'Secret Cave',
    'Bard', 'Blessed Village', 'Cemetery', 'Conclave', "Devil's Workshop", 'Exorcist',
    'Necromancer', 'Shepherd', 'Skulk',
    'Cobbler', 'Crypt', 'Cursed Village', 'Den of Sin', 'Idol', 'Pooka', 'Sacred Grove',
    'Tormentor', 'Tragic Hero', 'Vampire', 'Werewolf',
    'Raider'
  ],
  plunder: [
    'Cage', 'Grotto', 'Jewelled Egg', 'Search', 'Shaman',
    'Secluded Shrine', 'Siren', 'Stowaway', 'Taskmaster',
    'Abundance', 'Cabin Boy', 'Crucible', 'Flagship', 'Fortune Hunter', 'Gondola',
    'Harbor Village', 'Landing Party', 'Mapmaker', 'Maroon', 'Rope', 'Swamp Shacks', 'Tools',
    'Buried Treasure', 'Crew', 'Cutthroat', 'Enlarge', 'Figurine', 'First Mate', 'Frigate',
    'Longship', 'Mining Road', 'Pendant', 'Pickaxe', 'Pilgrim', 'Quartermaster', 'Silver Mine',
    'Trickster', 'Wealthy Village',
    'Sack of Loot',
    "King's Cache"
  ],
};

// Non-kingdom supplemental cards
const DOMINION_LANDMARKS = {
  empires: [
    'Aqueduct', 'Arena', 'Bandit Fort', 'Basilica', 'Baths', 'Battlefield', 'Colonnade',
    'Defiled Shrine', 'Fountain', 'Keep', 'Labyrinth', 'Mountain Pass', 'Museum', 'Obelisk',
    'Orchard', 'Palace', 'Tomb', 'Tower', 'Triumphal Arch', 'Wall', 'Wolf Den'
  ],
};

const DOMINION_EVENTS = {
  empires: [
    'Triumph', 'Annex', 'Donate',
    'Advance',
    'Delve', 'Tax',
    'Banquet',
    'Ritual', 'Salt the Earth', 'Wedding',
    'Windfall',
    'Conquest',
    'Dominate'
  ],
  rising_sun: [
    'Continue',
    'Amass', 'Asceticism', 'Credit', 'Foresight',
    'Kintsugi', 'Practice',
    'Sea Trade',
    'Receive Tribute',
    'Gather'
  ],
  plunder: [
    'Bury',
    'Avoid', 'Deliver', 'Peril', 'Rush',
    'Foray', 'Launch', 'Mirror', 'Prepare', 'Scrounge',
    'Journey', 'Maelstrom',
    'Looting',
    'Invasion', 'Prosper'
  ],
};

const DOMINION_PROPHECIES = {
  rising_sun: [
    'Approaching Army', 'Biding Time', 'Bureaucracy', 'Divine Wind', 'Enlightenment',
    'Flourishing Trade', 'Good Harvest', 'Great Leader', 'Growth', 'Harsh Winter',
    'Kind Emperor', 'Panic', 'Progress', 'Rapid Expansion', 'Sickness'
  ],
};

const DOMINION_TRAITS = {
  plunder: [
    'Cheap', 'Cursed', 'Fated', 'Fawning', 'Friendly', 'Hasty', 'Inherited', 'Inspiring',
    'Nearby', 'Patient', 'Pious', 'Reckless', 'Rich', 'Shy', 'Tireless'
  ],
};

// Card costs keyed by exact card name
const CARD_COSTS = {
  // Base Set
  'Cellar': '$2', 'Chapel': '$2', 'Moat': '$2',
  'Harbinger': '$3', 'Merchant': '$3', 'Vassal': '$3', 'Village': '$3', 'Workshop': '$3',
  'Bureaucrat': '$4', 'Gardens': '$4', 'Militia': '$4', 'Moneylender': '$4', 'Poacher': '$4',
  'Remodel': '$4', 'Smithy': '$4', 'Throne Room': '$4',
  'Bandit': '$5', 'Council Room': '$5', 'Festival': '$5', 'Laboratory': '$5', 'Library': '$5',
  'Market': '$5', 'Mine': '$5', 'Sentry': '$5', 'Witch': '$5',
  'Artisan': '$6',
  // Intrigue 2e
  'Courtyard': '$2', 'Lurker': '$2', 'Pawn': '$2',
  'Masquerade': '$3', 'Shanty Town': '$3', 'Steward': '$3', 'Swindler': '$3', 'Wishing Well': '$3',
  'Baron': '$4', 'Bridge': '$4', 'Conspirator': '$4', 'Diplomat': '$4', 'Ironworks': '$4',
  'Mill': '$4', 'Mining Village': '$4', 'Secret Passage': '$4',
  'Courtier': '$5', 'Duke': '$5', 'Minion': '$5', 'Patrol': '$5', 'Replace': '$5',
  'Torturer': '$5', 'Trading Post': '$5', 'Upgrade': '$5',
  'Harem': '$6', 'Nobles': '$6',
  // Seaside 2e
  'Haven': '$2', 'Lighthouse': '$2', 'Native Village': '$2',
  'Astrolabe': '$3', 'Fishing Village': '$3', 'Lookout': '$3', 'Monkey': '$3',
  'Sea Chart': '$3', 'Smugglers': '$3', 'Warehouse': '$3',
  'Blockade': '$4', 'Caravan': '$4', 'Cutpurse': '$4', 'Island': '$4',
  'Sailor': '$4', 'Salvager': '$4', 'Tide Pools': '$4', 'Treasure Map': '$4',
  'Bazaar': '$5', 'Corsair': '$5', 'Merchant Ship': '$5', 'Outpost': '$5',
  'Pirate': '$5', 'Sea Witch': '$5', 'Tactician': '$5', 'Treasury': '$5', 'Wharf': '$5',
  // Prosperity 2e
  'Anvil': '$3',
  'Bishop': '$4', 'Clerk': '$4', 'Investment': '$4', 'Monument': '$4', 'Quarry': '$4',
  'Tiara': '$4', 'Watchtower': '$4', "Worker's Village": '$4',
  'Charlatan': '$5', 'City': '$5', 'Collection': '$5', 'Crystal Ball': '$5', 'Magnate': '$5',
  'Mint': '$5', 'Rabble': '$5', 'Vault': '$5', 'War Chest': '$5',
  'Grand Market': '$6', 'Hoard': '$6',
  'Bank': '$7', 'Expand': '$7', 'Forge': '$7', "King's Court": '$7',
  'Peddler': '$8*',
  // Empires
  'Engineer': '4D',
  'City Quarter': '8D', 'Overlord': '8D', 'Royal Blacksmith': '8D',
  'Encampment/Plunder': '$2', 'Patrician/Emporium': '$2', 'Settlers/Bustling Village': '$2',
  'Castles': '$3+', 'Catapult/Rocks': '$3', 'Chariot Race': '$3', 'Enchantress': '$3',
  "Farmers' Market": '$3', 'Gladiator/Fortune': '$3',
  'Sacrifice': '$4', 'Temple': '$4', 'Villa': '$4',
  'Archive': '$5', 'Capital': '$5', 'Charm': '$5', 'Crown': '$5', 'Forum': '$5',
  'Groundskeeper': '$5', 'Legionary': '$5', 'Wild Hunt': '$5',
  // Rising Sun
  'Mountain Shrine': '$0',
  'Daimyo': '6D',
  'Artist': '8D',
  'Fishmonger': '$2', 'Snake Witch': '$2',
  'Aristocrat': '$3', 'Craftsman': '$3', 'Riverboat': '$5', 'Root Cellar': '$3',
  'Alley': '$3', 'Change': '$4', 'Ninja': '$5', 'Poet': '$3', 'River Shrine': '$4', 'Rustic Village': '$3',
  'Gold Mine': '$6', 'Imperial Envoy': '$5', 'Kitsune': '$5', 'Litter': '$5',
  'Rice Broker': '$5', 'Ronin': '$5', 'Tanuki': '$5', 'Tea House': '$5',
  'Samurai': '$5',
  'Rice': '$4',
  // Dark Ages
  'Poor House': '$1',
  'Beggar': '$2', 'Squire': '$2', 'Vagrant': '$2',
  'Forager': '$3', 'Hermit': '$3', 'Market Square': '$3', 'Sage': '$3', 'Storeroom': '$3', 'Urchin': '$3',
  'Armory': '$4', 'Death Cart': '$4', 'Feodum': '$4', 'Fortress': '$4', 'Ironmonger': '$4',
  'Marauder': '$4', 'Procession': '$4', 'Rats': '$4', 'Scavenger': '$4', 'Wandering Minstrel': '$4',
  'Band of Misfits': '$5', 'Bandit Camp': '$5', 'Catacombs': '$5', 'Count': '$5', 'Counterfeit': '$5',
  'Cultist': '$5', 'Graverobber': '$5', 'Junk Dealer': '$5', 'Knights': '$5', 'Mystic': '$5',
  'Pillage': '$5', 'Rebuild': '$5', 'Rogue': '$5',
  'Altar': '$6', 'Hunting Grounds': '$6',
  // Hinterlands 2nd Edition
  'Crossroads': '$2', "Fool's Gold": '$2', 'Cauldron': '$2',
  'Develop': '$3', 'Oasis': '$3', 'Scheme': '$3', 'Tunnel': '$3', 'Guard Dog': '$3',
  'Jack of All Trades': '$4', 'Spice Merchant': '$4', 'Trader': '$4', 'Nomads': '$4',
  'Trail': '$4', 'Weaver': '$4',
  'Cartographer': '$5', 'Haggler': '$5', 'Highway': '$5', 'Inn': '$5', 'Margrave': '$5',
  'Stables': '$5', 'Berserker': '$5', 'Souk': '$5', 'Wheelwright': '$5', "Witch's Hut": '$5',
  'Border Village': '$6', 'Farmland': '$6',
  // Nocturne
  'Druid': '$2', 'Faithful Hound': '$2', 'Guardian': '$2', 'Monastery': '$2', 'Pixie': '$2', 'Tracker': '$2',
  'Changeling': '$3', 'Fool': '$3', 'Ghost Town': '$3', 'Leprechaun': '$3', 'Night Watchman': '$3',
  'Secret Cave': '$3',
  'Bard': '$4', 'Blessed Village': '$4', 'Cemetery': '$4', 'Conclave': '$4', "Devil's Workshop": '$4',
  'Exorcist': '$4', 'Necromancer': '$4', 'Shepherd': '$4', 'Skulk': '$4',
  'Cobbler': '$5', 'Crypt': '$5', 'Cursed Village': '$5', 'Den of Sin': '$5', 'Idol': '$5', 'Pooka': '$5',
  'Sacred Grove': '$5', 'Tormentor': '$5', 'Tragic Hero': '$5', 'Vampire': '$5', 'Werewolf': '$5',
  'Raider': '$6',
  // Plunder
  'Cage': '$2', 'Grotto': '$2', 'Jewelled Egg': '$2', 'Search': '$2', 'Shaman': '$2',
  'Secluded Shrine': '$3', 'Siren': '$3', 'Stowaway': '$3', 'Taskmaster': '$3',
  'Abundance': '$4', 'Cabin Boy': '$4', 'Crucible': '$4', 'Flagship': '$4', 'Fortune Hunter': '$4',
  'Gondola': '$4', 'Harbor Village': '$4', 'Landing Party': '$4', 'Mapmaker': '$4', 'Maroon': '$4',
  'Rope': '$4', 'Swamp Shacks': '$4', 'Tools': '$4',
  'Buried Treasure': '$5', 'Crew': '$5', 'Cutthroat': '$5', 'Enlarge': '$5', 'Figurine': '$5',
  'First Mate': '$5', 'Frigate': '$5', 'Longship': '$5', 'Mining Road': '$5', 'Pendant': '$5',
  'Pickaxe': '$5', 'Pilgrim': '$5', 'Quartermaster': '$5', 'Silver Mine': '$5', 'Trickster': '$5',
  'Wealthy Village': '$5',
  'Sack of Loot': '$6',
  "King's Cache": '$7',
};

// Reverse lookup: card name → expansion key
const CARD_EXPANSION_MAP = {};
Object.entries(DOMINION_CARDS).forEach(([expansion, cards]) => {
  cards.forEach(card => { CARD_EXPANSION_MAP[card] = expansion; });
});

// Reverse lookup for supplemental cards (landmarks, events, prophecies, traits)
const SUPPLEMENTAL_EXPANSION_MAP = {};
[DOMINION_LANDMARKS, DOMINION_EVENTS, DOMINION_PROPHECIES, DOMINION_TRAITS].forEach(group => {
  Object.entries(group).forEach(([expansion, cards]) => {
    cards.forEach(card => { SUPPLEMENTAL_EXPANSION_MAP[card] = expansion; });
  });
});

// Release-date order, filtered to the expansions this app has card data for.
const EXPANSION_ORDER = ['base', 'intrigue', 'seaside', 'prosperity', 'hinterlands', 'dark_ages', 'empires', 'nocturne', 'plunder', 'rising_sun'];

const EXPANSION_DISPLAY = {
  base: 'Base',
  intrigue: 'Intrigue',
  seaside: 'Seaside',
  prosperity: 'Prosperity',
  empires: 'Empires',
  rising_sun: 'Rising Sun',
  dark_ages: 'Dark Ages',
  hinterlands: 'Hinterlands',
  nocturne: 'Nocturne',
  plunder: 'Plunder',
};

// Expansion icon filenames, in frontend/dominion-icons/. Includes expansions
// this app doesn't support builds for yet (e.g. Alchemy, Allies) so the icon
// set doesn't need to be revisited as support is added.
const EXPANSION_ICON = {
  base: 'Dominion_icon.png',
  intrigue: 'Intrigue_icon.png',
  seaside: 'Seaside_icon.png',
  prosperity: 'Prosperity_icon.png',
  empires: 'Empires_icon.png',
  rising_sun: 'Rising_Sun_icon.png',
  dark_ages: 'Dark_Ages_icon.png',
  hinterlands: 'Hinterlands_icon.png',
  nocturne: 'Nocturne_icon.png',
  plunder: 'Plunder_icon.png',
  alchemy: 'Alchemy_icon.png',
  adventures: 'Adventures_icon.png',
  allies: 'Allies_icon.png',
  menagerie: 'Menagerie_icon.png',
  renaissance: 'Renaissance_icon.png',
  cornucopia_guilds: 'Cornucopia_&_Guilds_icon.png',
};

// Expansion keys (in release order) a build touches, across kingdom cards
// and all supplemental card types.
function buildExpansionKeys(build) {
  const set = new Set();
  (build.cards || []).forEach(c => { const e = CARD_EXPANSION_MAP[c]; if (e) set.add(e); });
  [...(build.landmarks || []), ...(build.events || []), ...(build.prophecies || []), ...(build.traits || [])]
    .forEach(c => { const e = SUPPLEMENTAL_EXPANSION_MAP[c]; if (e) set.add(e); });
  return EXPANSION_ORDER.filter(e => set.has(e));
}

// Shared <img> markup for a row of expansion icon badges. `sizeClass` lets
// callers scale badges per-context via CSS (e.g. TV vs. desktop).
function renderExpansionIcons(expansionKeys, badgeClass, iconBasePath) {
  if (!expansionKeys || expansionKeys.length === 0) return '';
  const base = iconBasePath || 'dominion-icons';
  return expansionKeys.map(e => {
    const file = EXPANSION_ICON[e];
    if (!file) return '';
    const label = EXPANSION_DISPLAY[e] || e;
    return `<span class="${badgeClass}" title="${label}"><img src="${base}/${encodeURIComponent(file)}" alt="${label}"></span>`;
  }).join('');
}
