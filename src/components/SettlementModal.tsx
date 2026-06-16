import React from 'react';
import { useGameStore } from '../store/useGameStore';
import { GRID_SIZE, BUILDING_STATS } from '../utils/constants';
import { countPoweredBuildings, calculateScoreBreakdown, getConnectedCells, ScoreComponent } from '../utils/powerCalculator';
import { X, Zap, Battery, Home, Factory, Wind, AlertCircle, CheckCircle2, TrendingUp, Shield, Gauge, Users } from 'lucide-react';

interface ScoreDisplayProps {
  title: string;
  icon: React.ReactNode;
  component: ScoreComponent;
  color: string;
}

const ScoreDisplay: React.FC<ScoreDisplayProps> = ({ title, icon, component, color }) => {
  const scoreColor = component.score >= 80 ? 'text-green-500' : component.score >= 60 ? 'text-yellow-500' : 'text-red-500';
  
  return (
    <div className="bg-gray-50 rounded-xl p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center`}>
            {icon}
          </div>
          <div>
            <p className="text-sm font-bold text-gray-800">{title}</p>
            <p className="text-xs text-gray-500">权重 {Math.round(component.weight * 100)}%</p>
          </div>
        </div>
        <div className="text-right">
          <p className={`text-2xl font-black ${scoreColor}`}>{component.score}</p>
          <p className="text-xs text-gray-400">/ 100</p>
        </div>
      </div>
      
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-500 ${component.score >= 80 ? 'bg-green-500' : component.score >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
          style={{ width: `${component.score}%` }}
        />
      </div>
      
      {component.deductionReasons.length > 0 && (
        <div className="space-y-1">
          {component.deductionReasons.map((reason, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs text-red-500">
              <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>{reason}</span>
            </div>
          ))}
        </div>
      )}
      
      {component.deductionReasons.length === 0 && (
        <div className="flex items-center gap-1.5 text-xs text-green-500">
          <CheckCircle2 className="w-3 h-3" />
          <span>表现优秀，无扣分</span>
        </div>
      )}
    </div>
  );
};

export const SettlementModal: React.FC = () => {
  const {
    showSettlement,
    closeSettlement,
    grid,
    satisfaction,
    totalGeneration,
    totalConsumption,
    storedPower,
    maxStorage,
    dayTime,
    poweredCells,
  } = useGameStore();

  if (!showSettlement) return null;

  const connectedCells = getConnectedCells(grid, dayTime, storedPower);
  const scoreBreakdown = calculateScoreBreakdown(grid, poweredCells, storedPower, maxStorage, satisfaction, connectedCells);

  const { houses, poweredHouses, factories, poweredFactories } =
    countPoweredBuildings(grid, poweredCells);

  let windmills = 0;
  let batteries = 0;
  let totalWires = 0;
  let usedWires = 0;
  let faultyCount = 0;
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const cell = grid[y][x];
      if (cell.type === 'windmill') windmills++;
      if (cell.type === 'battery') batteries++;
      if (cell.type === 'wire') {
        totalWires++;
        if (connectedCells.has(`${x},${y}`)) usedWires++;
      }
      if (cell.faulty) faultyCount++;
    }
  }

  const isDay = dayTime < 50;
  const netPower = totalGeneration - totalConsumption;
  const storagePercent = maxStorage > 0 ? (storedPower / maxStorage) * 100 : 0;

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'S': return 'text-yellow-400';
      case 'A': return 'text-green-500';
      case 'B': return 'text-blue-500';
      case 'C': return 'text-orange-500';
      default: return 'text-red-500';
    }
  };

  const getGradeBg = (grade: string) => {
    switch (grade) {
      case 'S': return 'from-yellow-400 to-amber-500';
      case 'A': return 'from-green-400 to-emerald-500';
      case 'B': return 'from-blue-400 to-indigo-500';
      case 'C': return 'from-orange-400 to-amber-500';
      default: return 'from-red-400 to-rose-500';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={closeSettlement}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden animate-[scaleIn_0.3s_ease-out] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`bg-gradient-to-r ${getGradeBg(scoreBreakdown.grade)} p-6 text-white relative`}>
          <button
            onClick={closeSettlement}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <h2 className="text-2xl font-bold">📊 电网结算报告</h2>
          <p className="text-white/80 text-sm mt-1">
            {isDay ? '☀️ 白天' : '🌙 夜晚'} · 浮岛电网运营状态
          </p>
        </div>

        <div className="p-6 space-y-6">
          <div className="text-center bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-6">
            <div className="flex items-center justify-center gap-6">
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-1">综合评分</p>
                <p className="text-5xl font-black text-gray-800">{scoreBreakdown.totalScore}</p>
                <p className="text-xs text-gray-400">/ 100</p>
              </div>
              <div className="w-px h-16 bg-gray-300" />
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-1">等级</p>
                <div className={`text-6xl font-black ${getGradeColor(scoreBreakdown.grade)}`}>
                  {scoreBreakdown.grade}
                </div>
              </div>
            </div>
            <p className="text-gray-600 text-sm mt-4">{scoreBreakdown.gradeDesc}</p>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              评分拆解
            </h3>
            
            <ScoreDisplay
              title="供电覆盖"
              icon={<Zap className="w-4 h-4 text-blue-500" />}
              component={scoreBreakdown.powerCoverage}
              color="bg-blue-100"
            />
            
            <ScoreDisplay
              title="蓄电安全"
              icon={<Battery className="w-4 h-4 text-amber-500" />}
              component={scoreBreakdown.storageSafety}
              color="bg-amber-100"
            />
            
            <ScoreDisplay
              title="故障控制"
              icon={<Shield className="w-4 h-4 text-red-500" />}
              component={scoreBreakdown.faultControl}
              color="bg-red-100"
            />
            
            <ScoreDisplay
              title="线路效率"
              icon={<Gauge className="w-4 h-4 text-teal-500" />}
              component={scoreBreakdown.lineEfficiency}
              color="bg-teal-100"
            />
            
            <ScoreDisplay
              title="居民满意度"
              icon={<Users className="w-4 h-4 text-pink-500" />}
              component={scoreBreakdown.residentSatisfaction}
              color="bg-pink-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-bold text-gray-700">🏗️ 建筑统计</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wind className="w-4 h-4 text-teal-500" />
                    <span className="text-gray-600">风车</span>
                  </div>
                  <span className="font-bold text-gray-800">{windmills}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Home className="w-4 h-4 text-green-500" />
                    <span className="text-gray-600">住房</span>
                  </div>
                  <span className="font-bold text-gray-800">{poweredHouses}/{houses}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Factory className="w-4 h-4 text-orange-500" />
                    <span className="text-gray-600">工坊</span>
                  </div>
                  <span className="font-bold text-gray-800">{poweredFactories}/{factories}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Battery className="w-4 h-4 text-amber-500" />
                    <span className="text-gray-600">蓄电池</span>
                  </div>
                  <span className="font-bold text-gray-800">{batteries}</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-bold text-gray-700">⚡ 电力概况</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">发电量</span>
                  <span className="font-bold text-green-600">+{totalGeneration}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">耗电量</span>
                  <span className="font-bold text-red-500">-{totalConsumption}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">净电力</span>
                  <span className={`font-bold ${netPower >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {netPower >= 0 ? '+' : ''}{netPower}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">蓄电池</span>
                  <span className="font-bold text-amber-600">
                    {Math.round(storagePercent)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-bold text-gray-700">🔌 线路统计</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-gray-800">{totalWires}</p>
                <p className="text-xs text-gray-500">总电线</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-500">{usedWires}</p>
                <p className="text-xs text-gray-500">有用</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-500">{totalWires - usedWires}</p>
                <p className="text-xs text-gray-500">无用</p>
              </div>
            </div>
          </div>

          {faultyCount > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
              <p className="text-sm text-red-600 font-semibold">
                ⚠️ 当前有 {faultyCount} 处故障需要维修！
              </p>
            </div>
          )}

          <button
            onClick={closeSettlement}
            className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold py-3 rounded-xl shadow-lg transition-all duration-200 hover:scale-[1.02]"
          >
            继续游戏
          </button>
        </div>
      </div>

      <style>{`
        @keyframes scaleIn {
          from { transform: scale(0.8); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};
