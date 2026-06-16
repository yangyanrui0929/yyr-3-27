import {
  GridCell,
  GRID_SIZE,
  WIRE_CONNECTIONS,
  DIR_OFFSETS,
  BUILDING_STATS,
  DAY_THRESHOLD,
} from './constants';

export interface ScoreComponent {
  score: number;
  weight: number;
  deductionReasons: string[];
}

export interface ScoreBreakdown {
  powerCoverage: ScoreComponent;
  storageSafety: ScoreComponent;
  faultControl: ScoreComponent;
  lineEfficiency: ScoreComponent;
  residentSatisfaction: ScoreComponent;
  totalScore: number;
  grade: string;
  gradeDesc: string;
}

export function isWireConnected(wire: GridCell, direction: number): boolean {
  if (wire.type !== 'wire') return false;
  const connections = WIRE_CONNECTIONS[wire.rotation % 6];
  if (!connections) return false;
  return connections[direction];
}

export function getOppositeDirection(dir: number): number {
  return (dir + 2) % 4;
}

export function calculatePowerNetwork(
  grid: GridCell[][],
  dayTime: number,
  storedPower: number
): {
  poweredCells: Set<string>;
  totalGeneration: number;
  totalConsumption: number;
  batteryCapacity: number;
} {
  const isDay = dayTime < DAY_THRESHOLD;
  let totalGeneration = 0;
  let totalConsumption = 0;
  let batteryCapacity = 0;

  const windmillSources: Array<{ x: number; y: number; gen: number }> = [];
  const batterySources: Array<{ x: number; y: number; discharge: number }> = [];

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const cell = grid[y][x];
      if (cell.faulty) continue;

      if (cell.type === 'windmill') {
        const gen = isDay
          ? BUILDING_STATS.windmill.dayGen
          : BUILDING_STATS.windmill.nightGen;
        totalGeneration += gen;
        windmillSources.push({ x, y, gen });
      }
      if (cell.type === 'battery') {
        batteryCapacity += BUILDING_STATS.battery.storage;
      }
      if (cell.type === 'house') {
        totalConsumption += BUILDING_STATS.house.consumption;
      }
      if (cell.type === 'factory') {
        totalConsumption += BUILDING_STATS.factory.consumption;
      }
    }
  }

  const availableFromBatteries = Math.max(0, storedPower);
  const totalAvailable = totalGeneration + availableFromBatteries;

  if (availableFromBatteries > 0) {
    const batteryCount = grid.flat().filter(
      (c) => c.type === 'battery' && !c.faulty
    ).length;
    if (batteryCount > 0) {
      const dischargePerBattery = availableFromBatteries / batteryCount;
      for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
          const cell = grid[y][x];
          if (cell.type === 'battery' && !cell.faulty) {
            batterySources.push({ x, y, discharge: dischargePerBattery });
          }
        }
      }
    }
  }

  const allSources = [
    ...windmillSources.map((s) => ({ x: s.x, y: s.y })),
    ...batterySources.map((s) => ({ x: s.x, y: s.y })),
  ];

  const connectedCells = new Set<string>();
  const visited = new Set<string>();
  const queue: Array<{ x: number; y: number }> = [...allSources];

  for (const s of allSources) {
    visited.add(`${s.x},${s.y}`);
    connectedCells.add(`${s.x},${s.y}`);
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentCell = grid[current.y][current.x];

    for (let dir = 0; dir < 4; dir++) {
      const [dx, dy] = DIR_OFFSETS[dir];
      const nx = current.x + dx;
      const ny = current.y + dy;

      if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE) continue;

      const neighbor = grid[ny][nx];
      if (neighbor.faulty) continue;

      const key = `${nx},${ny}`;
      if (visited.has(key)) continue;

      let canConnectFromCurrent = false;
      if (currentCell.type === 'wire') {
        canConnectFromCurrent = isWireConnected(currentCell, dir);
      } else if (
        currentCell.type === 'windmill' ||
        currentCell.type === 'house' ||
        currentCell.type === 'factory' ||
        currentCell.type === 'battery'
      ) {
        canConnectFromCurrent = true;
      }

      let canConnectFromNeighbor = false;
      if (neighbor.type === 'wire') {
        canConnectFromNeighbor = isWireConnected(neighbor, getOppositeDirection(dir));
      } else if (
        neighbor.type === 'windmill' ||
        neighbor.type === 'house' ||
        neighbor.type === 'factory' ||
        neighbor.type === 'battery'
      ) {
        canConnectFromNeighbor = true;
      }

      if (canConnectFromCurrent && canConnectFromNeighbor) {
        visited.add(key);
        connectedCells.add(key);
        if (neighbor.type === 'wire') {
          queue.push({ x: nx, y: ny });
        }
      }
    }
  }

  const poweredCells = new Set<string>();

  for (const s of allSources) {
    poweredCells.add(`${s.x},${s.y}`);
  }

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const cell = grid[y][x];
      if (cell.type === 'wire' && connectedCells.has(`${x},${y}`)) {
        poweredCells.add(`${x},${y}`);
      }
    }
  }

  const connectedConsumers: Array<{
    x: number;
    y: number;
    consumption: number;
  }> = [];
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const cell = grid[y][x];
      if (
        (cell.type === 'house' || cell.type === 'factory') &&
        connectedCells.has(`${x},${y}`)
      ) {
        connectedConsumers.push({
          x,
          y,
          consumption:
            cell.type === 'house'
              ? BUILDING_STATS.house.consumption
              : BUILDING_STATS.factory.consumption,
        });
      }
    }
  }

  let remainingPower = totalAvailable;
  connectedConsumers.sort((a, b) => a.consumption - b.consumption);

  for (const consumer of connectedConsumers) {
    if (remainingPower >= consumer.consumption) {
      remainingPower -= consumer.consumption;
      poweredCells.add(`${consumer.x},${consumer.y}`);
    }
  }

  return { poweredCells, totalGeneration, totalConsumption, batteryCapacity };
}

export function countPoweredBuildings(
  grid: GridCell[][],
  poweredCells: Set<string>
): { houses: number; poweredHouses: number; factories: number; poweredFactories: number } {
  let houses = 0;
  let poweredHouses = 0;
  let factories = 0;
  let poweredFactories = 0;

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const cell = grid[y][x];
      if (cell.type === 'house') {
        houses++;
        if (poweredCells.has(`${x},${y}`)) poweredHouses++;
      }
      if (cell.type === 'factory') {
        factories++;
        if (poweredCells.has(`${x},${y}`)) poweredFactories++;
      }
    }
  }

  return { houses, poweredHouses, factories, poweredFactories };
}

export function calculateScoreBreakdown(
  grid: GridCell[][],
  poweredCells: Set<string>,
  storedPower: number,
  maxStorage: number,
  satisfaction: number,
  connectedCells: Set<string>
): ScoreBreakdown {
  const { houses, poweredHouses, factories, poweredFactories } = countPoweredBuildings(grid, poweredCells);
  const totalBuildings = houses + factories;
  const totalPowered = poweredHouses + poweredFactories;

  const powerCoverageDeductions: string[] = [];
  let powerCoverageScore = 100;
  if (totalBuildings > 0) {
    const coverage = totalPowered / totalBuildings;
    powerCoverageScore = Math.round(coverage * 100);
    if (coverage < 1) {
      const unpowered = totalBuildings - totalPowered;
      powerCoverageDeductions.push(`${unpowered} 座建筑未供电`);
    }
    if (coverage < 0.8) {
      powerCoverageDeductions.push('供电覆盖率低于 80%');
    }
    if (coverage < 0.5) {
      powerCoverageDeductions.push('供电覆盖率低于 50%，供电严重不足');
    }
  }

  const storageSafetyDeductions: string[] = [];
  let storageSafetyScore = 100;
  if (maxStorage > 0) {
    const storagePercent = storedPower / maxStorage;
    if (storagePercent < 0.2) {
      storageSafetyScore = Math.round(storagePercent * 500);
      storageSafetyDeductions.push('蓄电池电量低于 20%，蓄电不足');
    } else if (storagePercent > 0.9) {
      storageSafetyScore = 90;
      storageSafetyDeductions.push('蓄电池接近满电，存在溢电风险');
    } else {
      storageSafetyScore = 100;
    }
  } else {
    storageSafetyScore = 60;
    storageSafetyDeductions.push('未建造蓄电池，夜晚供电无保障');
  }

  const faultControlDeductions: string[] = [];
  let faultControlScore = 100;
  let faultyCount = 0;
  let totalNonEmpty = 0;
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const cell = grid[y][x];
      if (cell.type !== 'empty') {
        totalNonEmpty++;
        if (cell.faulty) {
          faultyCount++;
        }
      }
    }
  }
  if (faultyCount > 0) {
    faultControlScore = Math.max(0, 100 - faultyCount * 20);
    faultControlDeductions.push(`${faultyCount} 处故障未维修`);
  }
  if (faultyCount > 3) {
    faultControlDeductions.push('故障数量过多，电网稳定性差');
  }

  const lineEfficiencyDeductions: string[] = [];
  let lineEfficiencyScore = 100;
  let totalWires = 0;
  let usedWires = 0;
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const cell = grid[y][x];
      if (cell.type === 'wire') {
        totalWires++;
        if (connectedCells.has(`${x},${y}`)) {
          usedWires++;
        }
      }
    }
  }
  if (totalWires > 0) {
    const efficiency = usedWires / totalWires;
    const unusedWires = totalWires - usedWires;
    lineEfficiencyScore = Math.round(efficiency * 100);
    if (unusedWires > 0) {
      lineEfficiencyDeductions.push(`${unusedWires} 段无用电线，造成线路损耗`);
    }
    if (efficiency < 0.7) {
      lineEfficiencyDeductions.push('线路效率低于 70%，冗余线路过多');
    }
    if (efficiency < 0.5) {
      lineEfficiencyDeductions.push('线路效率低于 50%，电网严重臃肿');
    }
  }

  const residentSatisfactionDeductions: string[] = [];
  let residentSatisfactionScore = Math.round(satisfaction);
  if (satisfaction < 80) {
    residentSatisfactionDeductions.push('居民满意度未达优秀');
  }
  if (satisfaction < 60) {
    residentSatisfactionDeductions.push('居民满意度低于 60%');
  }
  if (satisfaction < 40) {
    residentSatisfactionDeductions.push('居民满意度低于 40%，居民怨声载道');
  }

  const weight = 0.2;
  const totalScore = Math.round(
    powerCoverageScore * weight +
    storageSafetyScore * weight +
    faultControlScore * weight +
    lineEfficiencyScore * weight +
    residentSatisfactionScore * weight
  );

  let grade = 'D';
  let gradeDesc = '电网崩溃！居民非常不满！';
  if (totalScore >= 90) {
    grade = 'S';
    gradeDesc = '完美电网！浮岛居民无比幸福！';
  } else if (totalScore >= 75) {
    grade = 'A';
    gradeDesc = '优秀电网！居民生活美满！';
  } else if (totalScore >= 55) {
    grade = 'B';
    gradeDesc = '良好电网，还有提升空间。';
  } else if (totalScore >= 35) {
    grade = 'C';
    gradeDesc = '电网堪忧，居民不太满意。';
  }

  return {
    powerCoverage: {
      score: powerCoverageScore,
      weight,
      deductionReasons: powerCoverageDeductions,
    },
    storageSafety: {
      score: storageSafetyScore,
      weight,
      deductionReasons: storageSafetyDeductions,
    },
    faultControl: {
      score: faultControlScore,
      weight,
      deductionReasons: faultControlDeductions,
    },
    lineEfficiency: {
      score: lineEfficiencyScore,
      weight,
      deductionReasons: lineEfficiencyDeductions,
    },
    residentSatisfaction: {
      score: residentSatisfactionScore,
      weight,
      deductionReasons: residentSatisfactionDeductions,
    },
    totalScore,
    grade,
    gradeDesc,
  };
}

export function getConnectedCells(grid: GridCell[][], dayTime: number, storedPower: number): Set<string> {
  const { poweredCells } = calculatePowerNetwork(grid, dayTime, storedPower);
  
  const connectedCells = new Set<string>();
  const visited = new Set<string>();
  const queue: Array<{ x: number; y: number }> = [];

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const cell = grid[y][x];
      if (
        !cell.faulty &&
        (cell.type === 'windmill' || cell.type === 'battery')
      ) {
        queue.push({ x, y });
        visited.add(`${x},${y}`);
        connectedCells.add(`${x},${y}`);
      }
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentCell = grid[current.y][current.x];

    for (let dir = 0; dir < 4; dir++) {
      const [dx, dy] = DIR_OFFSETS[dir];
      const nx = current.x + dx;
      const ny = current.y + dy;

      if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE) continue;

      const neighbor = grid[ny][nx];
      if (neighbor.faulty) continue;

      const key = `${nx},${ny}`;
      if (visited.has(key)) continue;

      let canConnectFromCurrent = false;
      if (currentCell.type === 'wire') {
        canConnectFromCurrent = isWireConnected(currentCell, dir);
      } else if (
        currentCell.type === 'windmill' ||
        currentCell.type === 'house' ||
        currentCell.type === 'factory' ||
        currentCell.type === 'battery'
      ) {
        canConnectFromCurrent = true;
      }

      let canConnectFromNeighbor = false;
      if (neighbor.type === 'wire') {
        canConnectFromNeighbor = isWireConnected(neighbor, getOppositeDirection(dir));
      } else if (
        neighbor.type === 'windmill' ||
        neighbor.type === 'house' ||
        neighbor.type === 'factory' ||
        neighbor.type === 'battery'
      ) {
        canConnectFromNeighbor = true;
      }

      if (canConnectFromCurrent && canConnectFromNeighbor) {
        visited.add(key);
        connectedCells.add(key);
        if (neighbor.type === 'wire') {
          queue.push({ x: nx, y: ny });
        }
      }
    }
  }

  return connectedCells;
}
