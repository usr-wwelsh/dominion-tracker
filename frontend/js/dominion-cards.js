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
};

const DOMINION_PROPHECIES = {
  rising_sun: [
    'Approaching Army', 'Biding Time', 'Bureaucracy', 'Divine Wind', 'Enlightenment',
    'Flourishing Trade', 'Good Harvest', 'Great Leader', 'Growth', 'Harsh Winter',
    'Kind Emperor', 'Panic', 'Progress', 'Rapid Expansion', 'Sickness'
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
};

// Reverse lookup: card name → expansion key
const CARD_EXPANSION_MAP = {};
Object.entries(DOMINION_CARDS).forEach(([expansion, cards]) => {
  cards.forEach(card => { CARD_EXPANSION_MAP[card] = expansion; });
});

// Reverse lookup for supplemental cards (landmarks, events, prophecies)
const SUPPLEMENTAL_EXPANSION_MAP = {};
[DOMINION_LANDMARKS, DOMINION_EVENTS, DOMINION_PROPHECIES].forEach(group => {
  Object.entries(group).forEach(([expansion, cards]) => {
    cards.forEach(card => { SUPPLEMENTAL_EXPANSION_MAP[card] = expansion; });
  });
});

const EXPANSION_DISPLAY = {
  base: 'Base',
  intrigue: 'Intrigue',
  seaside: 'Seaside',
  prosperity: 'Prosperity',
  empires: 'Empires',
  rising_sun: 'Rising Sun',
  dark_ages: 'Dark Ages',
};
