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
 * e.g. getEffVsTypes('electric', ['water','flying']) => 4x
 */
function getEffVsTypes(attackType, defenderTypes) {
  return defenderTypes.reduce((mult, dt) => mult * getEff(attackType, dt), 1);
}

/**
 * Best offensive multiplier for an attacker (using own types as move types) vs a defender.
 */
function bestOffense(attackerTypes, defenderTypes) {
  const mults = attackerTypes.map(at => getEffVsTypes(at, defenderTypes));
  return Math.max(...mults);
}

/**
 * Worst (highest) multiplier incoming against a defender from any attack type.
 * Tells you how vulnerable the Pokemon is.
 */
function worstDefense(defenderTypes) {
  const mults = ALL_TYPES.map(at => getEffVsTypes(at, defenderTypes));
  return Math.max(...mults);
}

/**
 * Analyse a full team matchup.
 * myTeam / oppTeam: array of { name, types: ['fire','flying'], level }
 * Returns analysis object.
 */
function analyseMatchup(myTeam, oppTeam) {
  // Offensive: for each of my Pokemon, what's the best it can hit each opponent?
  const offRows = myTeam.map(me => ({
    name: me.name,
    types: me.types,
    vs: oppTeam.map(opp => ({
      name: opp.name,
      types: opp.types,
      mult: bestOffense(me.types, opp.types)
    }))
  }));

  // Defensive: for each opponent Pokemon, what's the best it can hit each of mine?
  const defRows = oppTeam.map(opp => ({
    name: opp.name,
    types: opp.types,
    vs: myTeam.map(me => ({
      name: me.name,
      types: me.types,
      mult: bestOffense(opp.types, me.types)
    }))
  }));

  // % of opponent Pokemon I can hit SE (>=2x)
  const oppCanHitSE = oppTeam.map(opp => {
    const best = Math.max(...myTeam.map(me => bestOffense(me.types, opp.types)));
    return best >= 2;
  });
  const offCoverage = oppTeam.length > 0
    ? (oppCanHitSE.filter(Boolean).length / oppTeam.length) * 100 : 0;

  // % of my Pokemon that are NOT hit SE by any opponent (i.e. opponent best <= 1)
  const myNotWeak = myTeam.map(me => {
    const worst = Math.max(...oppTeam.map(opp => bestOffense(opp.types, me.types)));
    return worst < 2;
  });
  const defCoverage = myTeam.length > 0
    ? (myNotWeak.filter(Boolean).length / myTeam.length) * 100 : 0;

  // Overall score 0–100
  const score = Math.round((offCoverage * 0.55 + defCoverage * 0.45));

  // Types on opponent team I struggle against
  const oppAllTypes = [...new Set(oppTeam.flatMap(p => p.types))];
  const weakTo = oppAllTypes.filter(t => {
    // How many of my Pokemon are weak to this?
    const weakCount = myTeam.filter(me => getEffVsTypes(t, me.types) >= 2).length;
    return weakCount > myTeam.length / 2;
  });

  // Types I'm missing offensively (opponent types not hit SE by anyone on my team)
  const notCovered = oppAllTypes.filter(t => {
    return !myTeam.some(me => me.types.some(mt => getEff(mt, t) >= 2));
  });

  return { offCoverage, defCoverage, score, offRows, defRows, weakTo, notCovered };
}
