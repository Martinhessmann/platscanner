// Purpose: Prime Sets Management UI - Shows buildable sets and tracks mastery progress
// Author: Assistant
// Last Updated: 2025-01-03

import React, { useState, useEffect, useRef } from 'react';
import { DetectedItem, VoidRelic } from '../types';
import {
  analyzeSetProgress,
  getSetRecommendations,
  toggleSetMastery,
  SetProgress,
  PrimeSet
} from '../services/primeSetService';
import {
  Trophy,
  Zap,
  Clock,
  CheckCircle,
  Circle,
  Target,
  Sword,
  Shield,
  Crosshair,
  Star,
  Hexagon,
  Heart,
  HeartHandshake,
  BookOpen,
  Trash2,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { isSetPlanned, addToBuildPlan, removeFromBuildPlan, autoReserveItemsForSet } from '../services/buildPlanService';

interface PrimeSetsProps {
  primePartsInventory: DetectedItem[];
  relicsInventory: VoidRelic[];
}

const PrimeSetsSection: React.FC<PrimeSetsProps> = ({
  primePartsInventory,
  relicsInventory
}) => {
  const [setProgress, setSetProgress] = useState<SetProgress[]>([]);
  const [recommendations, setRecommendations] = useState<{
    buildable: SetProgress[];
    nearComplete: SetProgress[];
    highValue: SetProgress[];
  }>({ buildable: [], nearComplete: [], highValue: [] });
  const [activeTab, setActiveTab] = useState<'all' | 'buildable' | 'relics' | 'progress' | 'built'>('all');
  const [refreshKey, setRefreshKey] = useState(0);
  const [plannedSets, setPlannedSets] = useState<Map<string, { planned: boolean; isPriority: boolean }>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  const sectionRef = useRef<HTMLDivElement>(null);

  // Persistent accordion state for Prime Sets
  const [isExpanded, setIsExpanded] = useState(() => {
    const stored = localStorage.getItem('accordion_prime_sets');
    return stored !== null ? JSON.parse(stored) : true;
  });

  // Save accordion state to localStorage
  useEffect(() => {
    localStorage.setItem('accordion_prime_sets', JSON.stringify(isExpanded));
  }, [isExpanded]);

  // Auto-scroll to section when collapsing
  const handleToggle = () => {
    if (isExpanded && sectionRef.current) {
      // Scroll to top of section when collapsing
      sectionRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
    setIsExpanded(!isExpanded);
  };

  // Calculate progress on inventory changes
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        setIsLoading(true);
        const [progress, recs] = await Promise.all([
          analyzeSetProgress(primePartsInventory, relicsInventory),
          getSetRecommendations(primePartsInventory, relicsInventory)
        ]);

        if (isMounted) {
          setSetProgress(progress);
          setRecommendations(recs);
        }
      } catch (error) {
        console.error('Failed to load prime sets data:', error);
        if (isMounted) {
          setSetProgress([]);
          setRecommendations({ buildable: [], nearComplete: [], highValue: [] });
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [primePartsInventory, relicsInventory, refreshKey]);

  // Load planned sets on component mount and when refresh key changes
  useEffect(() => {
    const planned = new Map<string, { planned: boolean; isPriority: boolean }>();
    setProgress.forEach(progress => {
      const planStatus = isSetPlanned(progress.set.name);
      planned.set(progress.set.id, planStatus);
    });
    setPlannedSets(planned);
  }, [setProgress, refreshKey]);

  // Calculate sets that could be built with relics
  const potentiallyBuildable = setProgress.filter(p =>
    !p.canBuild &&
    !p.ismastered &&
    (p.ownedParts.length + p.obtainableFromRelics.length) === p.set.requiredParts.length
  );

  // Simplified 3-state system: buildable → planned → owned
  const getSetState = (progress: SetProgress): 'buildable' | 'planned' | 'owned' => {
    if (progress.ismastered) return 'owned';
    if (plannedSets.get(progress.set.id)?.planned) return 'planned';
    return 'buildable';
  };

  const handleStateChange = (progress: SetProgress, newState: 'buildable' | 'planned' | 'owned') => {
    const currentState = getSetState(progress);
    if (currentState === newState) return;

    const setName = progress.set.name;
    const setId = progress.set.id;

    // Clear previous state
    if (currentState === 'planned') {
      removeFromBuildPlan(setName);
    }
    if (currentState === 'owned') {
      toggleSetMastery(setId); // Remove mastery
    }

    // Set new state
    if (newState === 'planned') {
      addToBuildPlan(setName, false);
      // Auto-reserve parts
      const requiredPartNames = progress.set.requiredParts.map(part =>
        `${progress.set.name} ${part.partType}`
      );
      autoReserveItemsForSet(setName, requiredPartNames);
    } else if (newState === 'owned') {
      removeFromBuildPlan(setName); // Remove from plan if it was planned
      toggleSetMastery(setId); // Mark as mastered
    }

    // Update local state
    setPlannedSets(prev => {
      const updated = new Map(prev);
      updated.set(setId, { planned: newState === 'planned', isPriority: false });
      return updated;
    });

    setRefreshKey(prev => prev + 1);
  };

  const getTypeIcon = (type: PrimeSet['type']) => {
    switch (type) {
      case 'Warframe': return <Shield size={16} className="text-blue-400" />;
      case 'Primary': return <Crosshair size={16} className="text-red-400" />;
      case 'Secondary': return <Target size={16} className="text-orange-400" />;
      case 'Melee': return <Sword size={16} className="text-purple-400" />;
      case 'Sentinel': return <Shield size={16} className="text-cyan-400" />;
      case 'Archwing': return <Zap size={16} className="text-green-400" />;
      case 'Companion': return <Heart size={16} className="text-pink-400" />;
    }
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-green-500';
    if (percentage >= 75) return 'bg-yellow-500';
    if (percentage >= 50) return 'bg-orange-500';
    return 'bg-gray-500';
  };

  const getRelicsForPart = (partName: string) => {
    const lowerPartName = partName.toLowerCase();
    const relics = relicsInventory.filter(relic =>
      relic.relicDrops?.some(drop => drop.itemName.toLowerCase() === lowerPartName)
    );
    return relics.map(r => r.name.replace(' Relic', ''));
  };

  const filteredSets = () => {
    switch (activeTab) {
      case 'buildable':
        return setProgress.filter(p => p.canBuild && !p.ismastered);
      case 'relics':
        return potentiallyBuildable;
      case 'progress':
        return setProgress.filter(p => !p.canBuild && !p.ismastered && (plannedSets.get(p.set.id)?.planned || false));
      case 'all':
        return setProgress;
      case 'built':
        return setProgress.filter(p => p.ismastered);
    }
  };

  const sortedSets = filteredSets().sort((a, b) => {
    if (a.canBuild && !b.canBuild) return -1;
    if (!a.canBuild && b.canBuild) return 1;
    return b.completionPercentage - a.completionPercentage;
  });

  if (isLoading) {
    return (
      <div className="text-center p-8 border border-dashed border-gray-700 rounded-lg">
        <Shield size={48} className="mx-auto text-gray-600 mb-4 animate-pulse" />
        <p className="text-gray-400">Loading prime sets...</p>
        <p className="text-sm text-gray-500 mt-1">Analyzing {setProgress.length || 'all'} prime sets from database.</p>
      </div>
    );
  }

  if (primePartsInventory.length === 0) {
    return (
      <div className="text-center p-8 border border-dashed border-gray-700 rounded-lg">
        <Shield size={48} className="mx-auto text-gray-600 mb-4" />
        <p className="text-gray-400">No prime parts detected yet.</p>
        <p className="text-sm text-gray-500 mt-1">Upload screenshots of your prime inventory to see buildable sets.</p>
      </div>
    );
  }

  // Calculate summary stats
  const totalSets = setProgress.length;
  const buildableSets = recommendations.buildable.length;
  const inProgressSets = setProgress.filter(p => plannedSets.get(p.set.id)?.planned || false).length;
  const builtSets = setProgress.filter(p => p.ismastered).length;

  return (
    <div ref={sectionRef} className="w-full mb-2">
      {/* Mobile-first sticky header */}
      <div className="bg-gray-900/50 backdrop-blur-sm p-3 rounded-t-xl border border-gray-700/50 border-b-0 sticky top-0 z-20">
        <button
          onClick={handleToggle}
          className="flex items-center justify-between w-full text-left group"
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {isExpanded ? (
                <ChevronDown size={16} className="text-gray-400 group-hover:text-orokin-gold transition-colors" />
              ) : (
                <ChevronRight size={16} className="text-gray-400 group-hover:text-orokin-gold transition-colors" />
              )}
              <Shield size={20} className="text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white group-hover:text-orokin-gold transition-colors">
                Prime Sets
              </h3>
              <p className="text-xs text-gray-400">
                {totalSets} set{totalSets !== 1 ? 's' : ''} • {buildableSets} buildable • {inProgressSets} planned
              </p>
            </div>
          </div>

          <div className="text-right">
            <div className="flex items-center justify-end gap-1 mb-1">
              <Trophy size={14} className="text-green-400" />
              <span className="text-lg font-bold text-green-400">{buildableSets}</span>
            </div>
            <div className="flex items-center justify-end gap-1">
              <Star size={10} className="text-purple-400" />
              <span className="text-xs text-purple-400">{builtSets}</span>
            </div>
          </div>
        </button>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="bg-gray-800/30 backdrop-blur-sm border border-gray-700/50 border-t-0 rounded-b-xl overflow-hidden">
          {/* Compact Tab Pills */}
          <div className="flex flex-wrap gap-2 p-6 pb-4">
        {/* All Sets */}
        <button
          onClick={() => setActiveTab('all')}
          className={`px-3 py-2 rounded-full border transition-all flex items-center gap-2 text-sm font-medium ${
            activeTab === 'all'
              ? 'bg-blue-900/50 border-blue-500/50 text-blue-400 ring-1 ring-blue-500/30'
              : 'bg-gray-900/30 border-gray-700/50 text-gray-300 hover:bg-gray-800/50 hover:border-gray-600/50 hover:text-white'
          }`}
        >
          <Shield size={16} />
          <span>All Sets</span>
          <span className={`px-1.5 py-0.5 rounded text-xs ${
            activeTab === 'all' ? 'bg-blue-800/50 text-blue-300' : 'bg-gray-800/50 text-gray-400'
          }`}>
            {setProgress.length}
          </span>
        </button>

        {/* Buildable Sets */}
        <button
          onClick={() => setActiveTab('buildable')}
          className={`px-3 py-2 rounded-full border transition-all flex items-center gap-2 text-sm font-medium ${
            activeTab === 'buildable'
              ? 'bg-green-900/50 border-green-500/50 text-green-400 ring-1 ring-green-500/30'
              : 'bg-gray-900/30 border-gray-700/50 text-gray-300 hover:bg-gray-800/50 hover:border-gray-600/50 hover:text-white'
          }`}
        >
          <Trophy size={16} />
          <span>Buildable</span>
          <span className={`px-1.5 py-0.5 rounded text-xs ${
            activeTab === 'buildable' ? 'bg-green-800/50 text-green-300' : 'bg-gray-800/50 text-gray-400'
          }`}>
            {recommendations.buildable.length}
          </span>
        </button>

        {/* Buildable with Relics */}
        <button
          onClick={() => setActiveTab('relics')}
          disabled={potentiallyBuildable.length === 0}
          className={`px-3 py-2 rounded-full border transition-all flex items-center gap-2 text-sm font-medium ${
            activeTab === 'relics'
              ? 'bg-yellow-900/50 border-yellow-500/50 text-yellow-400 ring-1 ring-yellow-500/30'
              : potentiallyBuildable.length > 0
                ? 'bg-gray-900/30 border-gray-700/50 text-gray-300 hover:bg-gray-800/50 hover:border-gray-600/50 hover:text-white'
                : 'bg-gray-900/30 border-gray-700/50 text-gray-500 opacity-60 cursor-not-allowed'
          }`}
        >
          <Hexagon size={16} />
          <span>Buildable with Relics</span>
          <span className={`px-1.5 py-0.5 rounded text-xs ${
            activeTab === 'relics'
              ? 'bg-yellow-800/50 text-yellow-300'
              : potentiallyBuildable.length > 0
                ? 'bg-gray-800/50 text-gray-400'
                : 'bg-gray-800/50 text-gray-500'
          }`}>
            {potentiallyBuildable.length}
          </span>
        </button>

        {/* Planned Sets */}
        <button
          onClick={() => setActiveTab('progress')}
          className={`px-3 py-2 rounded-full border transition-all flex items-center gap-2 text-sm font-medium ${
            activeTab === 'progress'
              ? 'bg-orange-900/50 border-orange-500/50 text-orange-400 ring-1 ring-orange-500/30'
              : 'bg-gray-900/30 border-gray-700/50 text-gray-300 hover:bg-gray-800/50 hover:border-gray-600/50 hover:text-white'
          }`}
        >
          <BookOpen size={16} />
          <span>Planned</span>
          <span className={`px-1.5 py-0.5 rounded text-xs ${
            activeTab === 'progress' ? 'bg-orange-800/50 text-orange-300' : 'bg-gray-800/50 text-gray-400'
          }`}>
            {setProgress.filter(p => plannedSets.get(p.set.id)?.planned || false).length}
          </span>
        </button>

        {/* Near Complete */}
        <button
          onClick={() => setActiveTab('all')} // Could create a separate filter for this
          disabled={recommendations.nearComplete.length === 0}
          className={`px-3 py-2 rounded-full border transition-all flex items-center gap-2 text-sm font-medium ${
            recommendations.nearComplete.length > 0
              ? 'bg-gray-900/30 border-gray-700/50 text-gray-300 hover:bg-cyan-800/30 hover:border-cyan-400/50 hover:text-cyan-300'
              : 'bg-gray-900/30 border-gray-700/50 text-gray-500 opacity-60 cursor-not-allowed'
          }`}
        >
          <Clock size={16} />
          <span>Near Complete</span>
          <span className={`px-1.5 py-0.5 rounded text-xs ${
            recommendations.nearComplete.length > 0 ? 'bg-gray-800/50 text-gray-400' : 'bg-gray-800/50 text-gray-500'
          }`}>
            {recommendations.nearComplete.length}
          </span>
        </button>

        {/* Owned Sets */}
        <button
          onClick={() => setActiveTab('built')}
          className={`px-3 py-2 rounded-full border transition-all flex items-center gap-2 text-sm font-medium ${
            activeTab === 'built'
              ? 'bg-purple-900/50 border-purple-500/50 text-purple-400 ring-1 ring-purple-500/30'
              : 'bg-gray-900/30 border-gray-700/50 text-gray-300 hover:bg-gray-800/50 hover:border-gray-600/50 hover:text-white'
          }`}
        >
          <Star size={16} />
          <span>Owned</span>
          <span className={`px-1.5 py-0.5 rounded text-xs ${
            activeTab === 'built' ? 'bg-purple-800/50 text-purple-300' : 'bg-gray-800/50 text-gray-400'
          }`}>
            {setProgress.filter(p => p.ismastered).length}
          </span>
        </button>
      </div>

      {/* Sets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 px-6 pb-6">
        {sortedSets.map((progress) => (
          <div
            key={progress.set.id}
            className={`bg-gray-900/50 rounded-lg border p-4 transition-all hover:bg-gray-800/50 ${
              progress.canBuild
                ? 'border-green-500/50 ring-1 ring-green-500/20'
                : progress.ismastered
                  ? 'border-gray-500/50 ring-1 ring-gray-500/20'
                  : plannedSets.get(progress.set.id)?.planned
                    ? 'border-yellow-500/50 ring-1 ring-yellow-500/20'
                    : 'border-gray-700'
            }`}
          >
            {/* Set Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {getTypeIcon(progress.set.type)}
                <h3 className="font-semibold text-white text-sm">{progress.set.name}</h3>
                {progress.set.vaulted && (
                  <span className="px-1.5 py-0.5 bg-red-900/30 text-red-400 text-xs rounded border border-red-500/30">
                    VAULTED
                  </span>
                )}
              </div>
              {/* Remove for built tab */}
              {activeTab === 'built' && (
                <button
                  onClick={() => handleStateChange(progress, 'buildable')}
                  className="p-1 rounded transition-colors text-gray-500 hover:text-red-400"
                  title="Remove from built (if marked by mistake)"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>

            {/* Progress Bar */}
            <div className="mb-3">
              <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                <span>Progress</span>
                <span>{Math.round(progress.completionPercentage)}%</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${getProgressColor(progress.completionPercentage)}`}
                  style={{ width: `${progress.completionPercentage}%` }}
                />
              </div>
            </div>

            {/* Parts Status */}
            <div className="space-y-2 mb-4">
              <div className="text-xs text-gray-400">
                {progress.ownedParts.length} / {progress.set.requiredParts.length} parts owned
                {progress.obtainableFromRelics.length > 0 && (
                  <span className="text-yellow-400 ml-2">
                    +{progress.obtainableFromRelics.length} in relics
                  </span>
                )}
              </div>

              {/* Parts List */}
              <div className="space-y-1">
                {progress.set.requiredParts.map((part, index) => {
                  const isOwned = progress.ownedParts.includes(part.name);
                  const isObtainableFromRelics = progress.obtainableFromRelics.includes(part.name);

                  let iconColor = 'text-gray-500';
                  let textColor = 'text-gray-500';
                  let icon = <Circle size={12} />;

                  if (isOwned) {
                    iconColor = 'text-green-400';
                    textColor = 'text-green-400';
                    icon = <CheckCircle size={12} />;
                  } else if (isObtainableFromRelics) {
                    iconColor = 'text-yellow-400';
                    textColor = 'text-yellow-400';
                    icon = <Hexagon size={12} />;
                  }

                  const relicSources = getRelicsForPart(part.name);

                  return (
                    <div key={index} className="flex items-center justify-between text-xs">
                      <div className={`flex items-center gap-1 ${textColor}`}>
                        <span className={iconColor}>{icon}</span>
                        <span className="truncate">{part.partType}</span>
                        {part.itemCount && part.itemCount > 1 && (
                          <span className="text-xs text-blue-400">x{part.itemCount}</span>
                        )}
                        {isObtainableFromRelics && !isOwned && (
                          <span className="text-xs text-yellow-400/70" title="Available in your relics">
                            (relic)
                          </span>
                        )}
                      </div>
                      <span className={`${textColor} truncate`}>
                        {isOwned
                          ? `${part.ducats}d`
                          : relicSources.length > 0
                            ? relicSources.slice(0, 2).join(', ') + (relicSources.length > 2 ? '...' : '')
                            : `${part.ducats}d`
                        }
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action/Status */}
            <div className="border-t border-gray-700/50 pt-3 space-y-3">
              {/* Build Status */}
              {progress.ismastered ? (
                <div className="flex items-center justify-center gap-2 text-purple-400 text-sm">
                  <Star size={14} />
                  <span>Already Built</span>
                </div>
              ) : progress.canBuild ? (
                <div className="flex items-center justify-center gap-2 text-green-400 text-sm font-medium">
                  <Trophy size={14} />
                  <span>Ready to Build!</span>
                </div>
              ) : (
                                  <div className="text-center">
                  <div className="text-sm text-gray-400 mb-1">
                    Missing {progress.missingParts.length} part{progress.missingParts.length !== 1 ? 's' : ''}
                  </div>
                  <div className="text-xs text-gray-500">
                    ~{progress.missingCost} plat to buy missing parts
                  </div>
                </div>
              )}

              {/* Simple 3-State Toggle */}
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-1 text-xs text-gray-400">
                  <span>Status:</span>
                </div>
                <div className="flex gap-1">
                  {(['buildable', 'planned', 'owned'] as const).map((state) => {
                    const currentState = getSetState(progress);
                    const isActive = currentState === state;

                    const stateConfig = {
                      buildable: {
                        label: 'Buildable',
                        icon: <Trophy size={10} />,
                        color: 'text-gray-400',
                        bgColor: 'bg-gray-600/20 border-gray-600/30',
                        activeBgColor: 'bg-gray-600/40 border-gray-500/50'
                      },
                      planned: {
                        label: 'Planned',
                        icon: <BookOpen size={10} />,
                        color: 'text-yellow-400',
                        bgColor: 'bg-yellow-600/20 border-yellow-600/30',
                        activeBgColor: 'bg-yellow-600/40 border-yellow-500/50'
                      },
                      owned: {
                        label: 'Owned',
                        icon: <Star size={10} />,
                        color: 'text-purple-400',
                        bgColor: 'bg-purple-600/20 border-purple-600/30',
                        activeBgColor: 'bg-purple-600/40 border-purple-500/50'
                      }
                    };

                    const config = stateConfig[state];

                    return (
                      <button
                        key={state}
                        onClick={() => handleStateChange(progress, state)}
                        className={`flex-1 px-2 py-1 text-xs border rounded transition-colors ${
                          isActive
                            ? `${config.activeBgColor} ${config.color}`
                            : `${config.bgColor} text-gray-400 hover:bg-opacity-30`
                        }`}
                        title={`Mark as ${config.label.toLowerCase()}`}
                      >
                        <div className="flex items-center justify-center gap-1">
                          {config.icon}
                          <span>{config.label}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {sortedSets.length === 0 && (
        <div className="text-center p-8 border border-dashed border-gray-700 rounded-lg mx-6 mb-6">
          <div className="text-gray-400 mb-2">
            {activeTab === 'buildable' && 'No buildable sets yet'}
            {activeTab === 'relics' && 'No sets buildable with relics'}
            {activeTab === 'progress' && 'No planned sets'}
            {activeTab === 'all' && 'No prime sets data available'}
            {activeTab === 'built' && 'No owned sets yet'}
          </div>
          <div className="text-sm text-gray-500">
            {activeTab === 'buildable' && 'Collect more prime parts to complete sets'}
            {activeTab === 'relics' && 'Open relics to get missing parts for sets'}
            {activeTab === 'progress' && 'Mark sets as "Planned" to track your build progress'}
            {activeTab === 'all' && 'Prime parts will be analyzed for set completion'}
            {activeTab === 'built' && 'Mark completed sets as "Owned"'}
          </div>
        </div>
      )}
        </div>
      )}

      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="w-full bg-gray-800/30 backdrop-blur-sm border border-gray-700/50 border-t-0 rounded-b-xl text-center p-3 hover:bg-gray-800/50 transition-colors"
        >
          <p className="text-gray-400 text-sm hover:text-gray-300 transition-colors">
            Tap to view {totalSets} prime sets • {buildableSets} buildable • {inProgressSets} planned
          </p>
        </button>
      )}
    </div>
  );
};

export default PrimeSetsSection;