// Purpose: Prime Sets Management UI - Shows buildable sets and tracks mastery progress
// Author: Assistant
// Last Updated: 2025-01-03

import React, { useState, useEffect } from 'react';
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
  TrendingUp,
  Hexagon,
  Heart,
  HeartHandshake,
  BookOpen,
  Trash2
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
  const [activeTab, setActiveTab] = useState<'all' | 'buildable' | 'progress' | 'built'>('all');
  const [refreshKey, setRefreshKey] = useState(0);
  const [plannedSets, setPlannedSets] = useState<Map<string, { planned: boolean; isPriority: boolean }>>(new Map());

  // Calculate progress on inventory changes
  useEffect(() => {
    const progress = analyzeSetProgress(primePartsInventory, relicsInventory);
    setSetProgress(progress);
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

  const recommendations = getSetRecommendations(primePartsInventory, relicsInventory);

  // Calculate sets that could be built with relics
  const potentiallyBuildable = setProgress.filter(p =>
    !p.canBuild &&
    !p.ismastered &&
    (p.ownedParts.length + p.obtainableFromRelics.length) === p.set.requiredParts.length
  );

  const handleMarkAsBuilt = (setId: string, setName: string) => {
    // Remove from build plan if it exists
    removeFromBuildPlan(setName);
    // Mark as mastered
    toggleSetMastery(setId);

    // Update local state
    setPlannedSets(prev => {
      const updated = new Map(prev);
      updated.set(setId, { planned: false, isPriority: false });
      return updated;
    });

    setRefreshKey(prev => prev + 1);
  };

  const handleAddToBuildPlan = (setName: string, setId: string) => {
    // Add to build plan as normal priority (moves to In Progress)
    addToBuildPlan(setName, false);

    // Find the set and auto-reserve its parts
    const setData = setProgress.find(p => p.set.id === setId);
    if (setData) {
      const requiredPartNames = setData.set.requiredParts.map(part =>
        `${setData.set.name} ${part.partType}`
      );
      autoReserveItemsForSet(setName, requiredPartNames);
    }

    // Update local state
    setPlannedSets(prev => {
      const updated = new Map(prev);
      updated.set(setId, { planned: true, isPriority: false });
      return updated;
    });

    setRefreshKey(prev => prev + 1);
  };

  const handleRemoveFromBuildPlan = (setName: string, setId: string) => {
    removeFromBuildPlan(setName);

    // Update local state
    setPlannedSets(prev => {
      const updated = new Map(prev);
      updated.set(setId, { planned: false, isPriority: false });
      return updated;
    });

    setRefreshKey(prev => prev + 1);
  };

  const handleRemoveFromBuilt = (setId: string) => {
    // Remove mastery status (move back to available)
    toggleSetMastery(setId);
    setRefreshKey(prev => prev + 1);
  };

  const getTypeIcon = (type: PrimeSet['type']) => {
    switch (type) {
      case 'Warframe': return <Shield size={16} className="text-blue-400" />;
      case 'Primary': return <Crosshair size={16} className="text-red-400" />;
      case 'Secondary': return <Target size={16} className="text-orange-400" />;
      case 'Melee': return <Sword size={16} className="text-purple-400" />;
    }
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-green-500';
    if (percentage >= 75) return 'bg-yellow-500';
    if (percentage >= 50) return 'bg-orange-500';
    return 'bg-gray-500';
  };

  const filteredSets = () => {
    switch (activeTab) {
      case 'buildable':
        return setProgress.filter(p => p.canBuild && !p.ismastered);
      case 'progress':
        return setProgress.filter(p => !p.canBuild && !p.ismastered && plannedSets.get(p.set.id)?.planned);
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

  if (primePartsInventory.length === 0) {
    return (
      <div className="text-center p-8 border border-dashed border-gray-700 rounded-lg">
        <Shield size={48} className="mx-auto text-gray-600 mb-4" />
        <p className="text-gray-400">No prime parts detected yet.</p>
        <p className="text-sm text-gray-500 mt-1">Upload screenshots of your prime inventory to see buildable sets.</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Header with Statistics */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Prime Sets</h2>
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <div className="flex items-center gap-1">
            <Trophy size={14} className="text-green-400" />
            <span>{recommendations.buildable.length} buildable</span>
          </div>
          <div className="flex items-center gap-1">
            <Hexagon size={14} className="text-yellow-400" />
            <span>{potentiallyBuildable.length} via relics</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock size={14} className="text-orange-400" />
            <span>{recommendations.nearComplete.length} near complete</span>
          </div>
          <div className="flex items-center gap-1">
            <Star size={14} className="text-blue-400" />
            <span>{setProgress.filter(p => p.ismastered).length} already built</span>
          </div>
        </div>
      </div>

      {/* Quick Highlights */}
      {recommendations.buildable.length > 0 && (
        <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-4">
          <h3 className="flex items-center gap-2 text-green-400 font-semibold mb-2">
            <Trophy size={16} />
            Ready to Build ({recommendations.buildable.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {recommendations.buildable.slice(0, 3).map(progress => (
              <span key={progress.set.id} className="px-3 py-1 bg-green-800/30 text-green-300 rounded-full text-sm flex items-center gap-1">
                {getTypeIcon(progress.set.type)}
                {progress.set.name}
              </span>
            ))}
            {recommendations.buildable.length > 3 && (
              <span className="px-3 py-1 bg-green-800/30 text-green-300 rounded-full text-sm">
                +{recommendations.buildable.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Potentially Buildable with Relics */}
      {potentiallyBuildable.length > 0 && (
        <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4">
          <h3 className="flex items-center gap-2 text-yellow-400 font-semibold mb-2">
            <Hexagon size={16} />
            Buildable with Relics ({potentiallyBuildable.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {potentiallyBuildable.slice(0, 3).map(progress => (
              <span key={progress.set.id} className="px-3 py-1 bg-yellow-800/30 text-yellow-300 rounded-full text-sm flex items-center gap-1">
                {getTypeIcon(progress.set.type)}
                {progress.set.name}
                <span className="text-xs opacity-70">({progress.obtainableFromRelics.length} from relics)</span>
              </span>
            ))}
            {potentiallyBuildable.length > 3 && (
              <span className="px-3 py-1 bg-yellow-800/30 text-yellow-300 rounded-full text-sm">
                +{potentiallyBuildable.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-gray-900/50 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'all'
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <Shield size={14} />
            All Sets ({setProgress.length})
          </div>
        </button>
        <button
          onClick={() => setActiveTab('buildable')}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'buildable'
              ? 'bg-green-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <Trophy size={14} />
            Buildable ({recommendations.buildable.length})
          </div>
        </button>
        <button
          onClick={() => setActiveTab('progress')}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'progress'
              ? 'bg-yellow-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <TrendingUp size={14} />
            In Progress ({setProgress.filter(p => plannedSets.get(p.set.id)?.planned).length})
          </div>
        </button>
        <button
          onClick={() => setActiveTab('built')}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'built'
              ? 'bg-purple-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <Star size={14} />
            Already Built ({setProgress.filter(p => p.ismastered).length})
          </div>
        </button>
      </div>

      {/* Sets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedSets.map((progress) => (
          <div
            key={progress.set.id}
            className={`bg-gray-900/50 rounded-lg border p-4 transition-all hover:bg-gray-800/50 ${
              progress.canBuild
                ? 'border-green-500/50 ring-1 ring-green-500/20'
                : progress.ismastered
                  ? 'border-purple-500/50 ring-1 ring-purple-500/20'
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
                  onClick={() => handleRemoveFromBuilt(progress.set.id)}
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

                  return (
                    <div key={index} className="flex items-center justify-between text-xs">
                      <div className={`flex items-center gap-1 ${textColor}`}>
                        <span className={iconColor}>{icon}</span>
                        <span className="truncate">{part.partType}</span>
                        {isObtainableFromRelics && !isOwned && (
                          <span className="text-xs text-yellow-400/70" title="Available in your relics">
                            (relic)
                          </span>
                        )}
                      </div>
                      <span className={textColor}>
                        {part.ducats}d
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
                    ~{progress.missingCost}p to complete
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {progress.ismastered ? (
                // Already Built - no actions needed (remove is in header for built tab)
                null
              ) : plannedSets.get(progress.set.id)?.planned ? (
                // In Progress - show status and options
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2 text-sm text-yellow-400">
                    <BookOpen size={14} />
                    <span>In Progress</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleMarkAsBuilt(progress.set.id, progress.set.name)}
                      className="flex-1 px-2 py-1 text-xs bg-purple-600/20 text-purple-400 border border-purple-600/30 rounded hover:bg-purple-600/30 transition-colors"
                      title="Mark as already built"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <Star size={10} />
                        <span>Already Built</span>
                      </div>
                    </button>
                    <button
                      onClick={() => handleRemoveFromBuildPlan(progress.set.name, progress.set.id)}
                      className="flex-1 px-2 py-1 text-xs bg-gray-600/20 text-gray-400 border border-gray-600/30 rounded hover:bg-gray-600/30 transition-colors"
                      title="Remove from build plans"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                // Available - show main action buttons
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAddToBuildPlan(progress.set.name, progress.set.id)}
                    className="flex-1 px-3 py-1.5 text-xs bg-yellow-600/20 text-yellow-400 border border-yellow-600/30 rounded hover:bg-yellow-600/30 transition-colors"
                    title="Add to build plans and reserve items"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <BookOpen size={12} />
                      <span>I want to build this</span>
                    </div>
                  </button>
                  <button
                    onClick={() => handleMarkAsBuilt(progress.set.id, progress.set.name)}
                    className="flex-1 px-3 py-1.5 text-xs bg-purple-600/20 text-purple-400 border border-purple-600/30 rounded hover:bg-purple-600/30 transition-colors"
                    title="Mark as already built"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <Star size={12} />
                      <span>Already Built</span>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {sortedSets.length === 0 && (
        <div className="text-center p-8 border border-dashed border-gray-700 rounded-lg">
          <div className="text-gray-400 mb-2">
            {activeTab === 'buildable' && 'No sets ready to build yet'}
            {activeTab === 'progress' && 'No sets in progress'}
            {activeTab === 'all' && 'No prime sets data available'}
            {activeTab === 'built' && 'No sets marked as built yet'}
          </div>
          <div className="text-sm text-gray-500">
            {activeTab === 'buildable' && 'Collect more prime parts to complete sets'}
            {activeTab === 'progress' && 'Mark sets you want to build to track progress'}
            {activeTab === 'all' && 'Prime parts will be analyzed for set completion'}
            {activeTab === 'built' && 'Mark completed sets as "Already Built"'}
          </div>
        </div>
      )}
    </div>
  );
};

export default PrimeSetsSection;