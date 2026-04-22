// Type effectiveness chart (Gen 6+, includes Fairy)
// typeChart[attackingType][defendingType] = multiplier (0, 0.5, 1, 2)
// Only non-1x values are listed; missing = 1x

const TYPE_CHART = {
  normal:   { rock: 0.5, ghost: 0, steel: 0.5 },
  fire:     { fire: 0.5, water: 0.5, rock: 0.5, dragon: 0.5, grass: 2, ice: 2, bug: 2, steel: 2 },
  water:    { water: 0.5, grass: 0.5, dragon: 0.5, fire: 2, ground: 2, rock: 2 },
  electric: { electric: 0.5, grass: 0.5, dragon: 0.5, ground: 0, water: 2, flying: 2 },
  grass:    { fire: 0.5, grass: 0.5, poison: 0.5, flying: 0.5, bug: 0.5, dragon: 0.5, steel: 0.5, water: 2, ground: 2, rock: 2 },
  ice:      { fire: 0.5, water: 0.5, ice: 0.5, steel: 0.5, grass: 2, ground: 2, flying: 2, dragon: 2 },
  fighting: { poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, fairy: 0.5, ghost: 0, normal: 2, ice: 2, rock: 2, dark: 2, steel: 2 },
  poison:   { poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, grass: 2, fairy: 2 },
  ground:   { grass: 0.5, bug: 0.5, flying: 0, fire: 2, electric: 2, poison: 2, rock: 2, steel: 2 },
  flying:   { electric: 0.5, rock: 0.5, steel: 0.5, grass: 2, fighting: 2, bug: 2 },
  psychic:  { psychic: 0.5, steel: 0.5, dark: 0, fighting: 2, poison: 2 },
  bug:      { fire: 0.5, fighting: 0.5, flying: 0.5, ghost: 0.5, steel: 0.5, fairy: 0.5, grass: 2, psychic: 2, dark: 2 },
  rock:     { fighting: 0.5, ground: 0.5, steel: 0.5, fire: 2, ice: 2, flying: 2, bug: 2 },
  ghost:    { normal: 0, dark: 0.5, psychic: 2, ghost: 2 },
  dragon:   { steel: 0.5, fairy: 0, dragon: 2 },
  dark:     { fighting: 0.5, dark: 0.5, fairy: 0.5, psychic: 2, ghost: 2 },
  steel:    { fire: 0.5, water: 0.5, electric: 0.5, steel: 0.5, ice: 2, rock: 2, fairy: 2 },
  fairy:    { fire: 0.5, poison: 0.5, steel: 0.5, dragon: 0, fighting: 2, dark: 2 }
};

const ALL_TYPES = ['normal','fire','water','electric','grass','ice','fighting','poison',
  'ground','flying','psychic','bug','rock','ghost','dragon','dark','steel','fairy'];

// Ability modifiers for type matchups (affects incoming damage to the Pokemon with this ability)
const ABILITY_TYPE_MODS = {
  'levitate':        { immunities: ['ground'] },
  'flash-fire':      { immunities: ['fire'] },
  'water-absorb':    { immunities: ['water'] },
  'dry-skin':        { immunities: ['water'], extra_weak: ['fire'] },
  'storm-drain':     { immunities: ['water'] },
  'volt-absorb':     { immunities: ['electric'] },
  'lightning-rod':   { immunities: ['electric'] },
  'motor-drive':     { immunities: ['electric'] },
  'sap-sipper':      { immunities: ['grass'] },
  'earth-eater':     { immunities: ['ground'] },
  'well-baked-body': { immunities: ['fire'] },
  'purifying-salt':  { immunities: ['ghost'] },
  'wonder-guard':    { wonder_guard: true },
  'thick-fat':       { half: ['fire', 'ice'] },
  'heatproof':       { half: ['fire'] },
  'fluffy':          { half: ['contact'], extra_weak: ['fire'] }, // simplified: just halve fire for now
};

/**
 * Get effectiveness multiplier for one attacking type vs one defending type.
 */
function getEff(attackType, defendType) {
  const row = TYPE_CHART[attackType.toLowerCase()];
  if (!row) return 1;
  const val = row[defendType.toLowerCase()];
  return val !== undefined ? val : 1;
}

/**
 * Get combined effectiveness of one attacking type vs a multi-type defender.
 */
function getEffVsTypes(attackType, defenderTypes) {
  return defenderTypes.reduce((mult, dt) => mult * getEff(attackType, dt), 1);
}

/**
 * Apply a defender's ability modifier to an incoming attack type.
 * Returns the adjusted multiplier.
 */
function applyAbilityMod(abilityName, attackType, baseMult) {
  if (!abilityName) return baseMult;
  const mod = ABILITY_TYPE_MODS[abilityName.toLowerCase()];
  if (!mod) return baseMult;

  if (mod.wonder_guard) {
    // Wonder Guard: only super-effective moves land
    return baseMult > 1 ? baseMult : 0;
  }
  if (mod.immunities && mod.immunities.includes(attackType)) return 0;
  if (mod.extra_weak && mod.extra_weak.includes(attackType)) return baseMult * 2;
  if (mod.half && mod.half.includes(attackType)) return baseMult * 0.5;
  return baseMult;
}

/**
 * Get combined effectiveness of one attacking type vs a multi-type defender,
 * with the defender's ability applied.
 */
function getEffVsTypesWithAbility(attackType, defenderTypes, defenderAbility) {
  const mult = getEffVsTypes(attackType, defenderTypes);
  return applyAbilityMod(defenderAbility, attackType, mult);
}

// Held-item modifiers (affect incoming damage to the holder, like ability mods)
const ITEM_TYPE_MODS = {
  'air-balloon': { immunities: ['ground'] },
};

/**
 * Apply a defender's held-item modifier to an incoming attack type.
 */
function applyItemMod(heldItem, attackType, baseMult) {
  if (!heldItem) return baseMult;
  const mod = ITEM_TYPE_MODS[heldItem.toLowerCase()];
  if (!mod) return baseMult;
  if (mod.immunities && mod.immunities.includes(attackType)) return 0;
  return baseMult;
}

/**
 * Best offensive multiplier from offensiveTypes vs a defender,
 * considering the defender's ability and held item.
 * Returns { mult, bestType } — the best multiplier and which type achieved it.
 */
function bestOffenseDetail(offensiveTypes, defenderTypes, defenderAbility, defenderItem) {
  let bestMult = 0;
  let bestType = offensiveTypes[0] || 'normal';
  for (const at of offensiveTypes) {
    let m = getEffVsTypesWithAbility(at, defenderTypes, defenderAbility);
    m = applyItemMod(defenderItem, at, m);
    if (m > bestMult) {
      bestMult = m;
      bestType = at;
    }
  }
  return { mult: bestMult, bestType };
}

/**
 * Best offensive multiplier (simple version — no ability, returns just a number).
 */
function bestOffense(attackerTypes, defenderTypes) {
  return bestOffenseDetail(attackerTypes, defenderTypes, null).mult;
}

/**
 * Analyse a full team matchup.
 *
 * myTeam entries:  { name, types, level, offensiveTypes?, ability?, heldItem? }
 *   offensiveTypes: move types to use for offense (if null/empty, falls back to types)
 *   ability:   slug string e.g. 'levitate'    — applied as defensive modifier
 *   heldItem:  slug string e.g. 'air-balloon' — applied as defensive modifier
 *
 * oppTeam entries: { name, types, level, ability?, heldItem? }
 *
 * Returns analysis object.
 */
function analyseMatchup(myTeam, oppTeam) {
  // Helper: resolve offensive types for a team member
  const resolveOff = me =>
    (me.offensiveTypes && me.offensiveTypes.length > 0) ? me.offensiveTypes : me.types;

  // Offensive rows: for each of my Pokemon, how well it hits each opponent
  const offRows = myTeam.map(me => {
    const offTypes = resolveOff(me);
    return {
      name: me.name,
      types: me.types,
      offensiveTypes: offTypes,
      usingMoves: !!(me.offensiveTypes && me.offensiveTypes.length > 0),
      vs: oppTeam.map(opp => {
        const { mult, bestType } = bestOffenseDetail(offTypes, opp.types, opp.ability || null, opp.heldItem || null);
        return { name: opp.name, types: opp.types, mult, bestType };
      })
    };
  });

  // Defensive rows: for each opponent Pokemon, how well it hits each of mine
  const defRows = oppTeam.map(opp => ({
    name: opp.name,
    types: opp.types,
    vs: myTeam.map(me => {
      const { mult } = bestOffenseDetail(opp.types, me.types, me.ability || null, me.heldItem || null);
      return { name: me.name, types: me.types, mult };
    })
  }));

  // % of opponent Pokemon I can hit SE (>=2x)
  const oppCanHitSE = oppTeam.map(opp => {
    const best = Math.max(...myTeam.map(me => {
      const offTypes = resolveOff(me);
      return bestOffenseDetail(offTypes, opp.types, opp.ability || null, opp.heldItem || null).mult;
    }));
    return best >= 2;
  });
  const offCoverage = oppTeam.length > 0
    ? (oppCanHitSE.filter(Boolean).length / oppTeam.length) * 100 : 0;

  // % of my Pokemon that are NOT hit SE by any opponent (opponent best <= 1x)
  const myNotWeak = myTeam.map(me => {
    const worst = Math.max(...oppTeam.map(opp =>
      bestOffenseDetail(opp.types, me.types, me.ability || null, me.heldItem || null).mult
    ));
    return worst < 2;
  });
  const defCoverage = myTeam.length > 0
    ? (myNotWeak.filter(Boolean).length / myTeam.length) * 100 : 0;

  // Overall score 0–100
  const score = Math.round(offCoverage * 0.55 + defCoverage * 0.45);

  // Types on opponent team my team is broadly weak to
  const oppAllTypes = [...new Set(oppTeam.flatMap(p => p.types))];
  const weakTo = oppAllTypes.filter(t => {
    const weakCount = myTeam.filter(me => {
      let eff = applyAbilityMod(me.ability || null, t, getEffVsTypes(t, me.types));
      eff = applyItemMod(me.heldItem || null, t, eff);
      return eff >= 2;
    }).length;
    return weakCount > myTeam.length / 2;
  });

  // Types I'm missing super-effective coverage against
  const notCovered = oppAllTypes.filter(t =>
    !myTeam.some(me => {
      const offTypes = resolveOff(me);
      return offTypes.some(mt => getEff(mt, t) >= 2);
    })
  );

  const usingMoves = myTeam.some(me => me.offensiveTypes && me.offensiveTypes.length > 0);

  return { offCoverage, defCoverage, score, offRows, defRows, weakTo, notCovered, usingMoves };
}
