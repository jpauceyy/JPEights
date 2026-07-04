import { PlayerStats } from "../db/db";

export interface TeamSplit {
  teamA: PlayerStats[];
  teamB: PlayerStats[];
  totalRatingA: number;
  totalRatingB: number;
  difference: number;
  sizeDiff: number;
  constraintsSatisfied: boolean;
}

/**
 * Custom constraint-aware team balancer.
 * Uses a randomized constraint-satisfaction approach with thousands of iterations.
 */
export function balanceTeams(
  players: PlayerStats[],
  locks: { [player: string]: string[] } = {},
  opposites: { [player: string]: string[] } = {},
  maxIterations = 5000
): TeamSplit | null {
  if (!players || players.length === 0) return null;

  // Normalizing names to lower-case for mapping
  const normalize = (s: string) => s.toLowerCase().trim();

  // Create helper sets for locks and opposites
  const playerMap = new Map<string, PlayerStats>();
  players.forEach((p) => playerMap.set(normalize(p.name), p));

  const names = Array.from(playerMap.keys());
  const N = names.length;

  if (N === 1) {
    return {
      teamA: [players[0]],
      teamB: [],
      totalRatingA: players[0].rating,
      totalRatingB: 0,
      difference: players[0].rating,
      sizeDiff: 1,
      constraintsSatisfied: true,
    };
  }

  // Find connected components for Locks (locked together players)
  // Each component must be on the same team.
  const parent = new Map<string, string>();
  names.forEach((name) => parent.set(name, name));

  function find(u: string): string {
    let root = u;
    while (root !== parent.get(root)) {
      root = parent.get(root)!;
    }
    // path compression
    let curr = u;
    while (curr !== root) {
      const next = parent.get(curr)!;
      parent.set(curr, root);
      curr = next;
    }
    return root;
  }

  function union(u: string, v: string) {
    const rootU = find(u);
    const rootV = find(v);
    if (rootU !== rootV) {
      parent.set(rootU, rootV);
    }
  }

  // Apply locks
  Object.entries(locks).forEach(([p1, pList]) => {
    const n1 = normalize(p1);
    if (!playerMap.has(n1)) return;
    pList.forEach((p2) => {
      const n2 = normalize(p2);
      if (!playerMap.has(n2)) return;
      union(n1, n2);
    });
  });

  // Group players by lock components
  const groups = new Map<string, string[]>();
  names.forEach((name) => {
    const root = find(name);
    if (!groups.has(root)) {
      groups.set(root, []);
    }
    groups.get(root)!.push(name);
  });

  const groupList = Array.from(groups.values());

  // Prepare opposites mappings at component level
  // If player in group A is forced opposite to player in group B, then group A and group B must be on opposite teams.
  const groupOpposites = new Map<number, Set<number>>();
  for (let i = 0; i < groupList.length; i++) {
    groupOpposites.set(i, new Set<number>());
  }

  for (let i = 0; i < groupList.length; i++) {
    const g1 = groupList[i];
    for (let j = i + 1; j < groupList.length; j++) {
      const g2 = groupList[j];

      // Check if any pair has opposite constraint
      let isOpposite = false;
      for (const p1 of g1) {
        const opps = opposites[p1] || [];
        for (const p2 of g2) {
          if (opps.map(normalize).includes(p2)) {
            isOpposite = true;
            break;
          }
        }
        if (isOpposite) break;
      }

      if (isOpposite) {
        groupOpposites.get(i)!.add(j);
        groupOpposites.get(j)!.add(i);
      }
    }
  }

  let bestSplit: TeamSplit | null = null;
  const targetSizeA = Math.ceil(N / 2);
  const targetSizeB = N - targetSizeA;

  // Let's run a randomized trials search
  for (let iter = 0; iter < maxIterations; iter++) {
    // We will assign groups to team A (0) or team B (1)
    const assignment = new Map<number, number>(); // groupIndex -> team (0 or 1)
    let sizeA = 0;
    let sizeB = 0;
    let constraintsSatisfied = true;

    // Shuffle group indices to explore different assignment orders
    const indices = Array.from({ length: groupList.length }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    // Greedily assign groups, respecting constraints
    for (const idx of indices) {
      const group = groupList[idx];
      const gSize = group.length;

      // Check opposite constraints for this group against already assigned groups
      let forceTeam: number | null = null;
      const opps = groupOpposites.get(idx)!;

      for (const oppIdx of opps) {
        if (assignment.has(oppIdx)) {
          const oppTeam = assignment.get(oppIdx)!;
          const desiredTeam = 1 - oppTeam;

          if (forceTeam !== null && forceTeam !== desiredTeam) {
            // Contradiction! Impossible to satisfy this constraint in this layout
            constraintsSatisfied = false;
          }
          forceTeam = desiredTeam;
        }
      }

      let teamToAssign: number;
      if (forceTeam !== null) {
        teamToAssign = forceTeam;
      } else {
        // No opposite constraint forces a team, assign based on size to balance sizes
        if (sizeA + gSize <= targetSizeA) {
          teamToAssign = 0;
        } else if (sizeB + gSize <= targetSizeB) {
          teamToAssign = 1;
        } else {
          // If sizes are full, pick the smaller team
          teamToAssign = sizeA <= sizeB ? 0 : 1;
        }
      }

      assignment.set(idx, teamToAssign);
      if (teamToAssign === 0) {
        sizeA += gSize;
      } else {
        sizeB += gSize;
      }
    }

    // Build the teams
    const teamA: PlayerStats[] = [];
    const teamB: PlayerStats[] = [];
    let totalRatingA = 0;
    let totalRatingB = 0;

    for (let i = 0; i < groupList.length; i++) {
      const team = assignment.get(i)!;
      const groupPlayers = groupList[i].map((n) => playerMap.get(n)!);

      if (team === 0) {
        teamA.push(...groupPlayers);
        totalRatingA += groupPlayers.reduce((sum, p) => sum + p.rating, 0);
      } else {
        teamB.push(...groupPlayers);
        totalRatingB += groupPlayers.reduce((sum, p) => sum + p.rating, 0);
      }
    }

    const difference = Math.abs(totalRatingA - totalRatingB);
    const sizeDiff = Math.abs(teamA.length - teamB.length);

    // Filter out splits that are too unbalanced in size, UNLESS we are forced by large lock groups
    const maxAllowedSizeDiff = Math.max(1, Math.floor(N / 4));
    if (sizeDiff > maxAllowedSizeDiff && N >= 4) {
      // Skip very size-unbalanced teams unless constraints forced it
      if (constraintsSatisfied) {
        // if constraints are satisfied but sizes are bad, only keep if we have no better options
        continue;
      }
    }

    const currentSplit: TeamSplit = {
      teamA,
      teamB,
      totalRatingA: parseFloat(totalRatingA.toFixed(1)),
      totalRatingB: parseFloat(totalRatingB.toFixed(1)),
      difference: parseFloat(difference.toFixed(1)),
      sizeDiff,
      constraintsSatisfied,
    };

    // Evaluate if this split is better than the previous best
    if (!bestSplit) {
      bestSplit = currentSplit;
    } else {
      // Prioritize constraints satisfied, then smaller size difference, then smaller rating difference
      const scoreBest = (bestSplit.constraintsSatisfied ? 1000 : 0) - (bestSplit.sizeDiff * 100) - bestSplit.difference;
      const scoreCurr = (currentSplit.constraintsSatisfied ? 1000 : 0) - (currentSplit.sizeDiff * 100) - currentSplit.difference;

      if (scoreCurr > scoreBest) {
        bestSplit = currentSplit;
      }
    }
  }

  return bestSplit;
}
