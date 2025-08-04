import React, { useState } from 'react';
import { useNostr } from '../../hooks/useNostr';
import { createWorkoutPlan } from '../../services/nostr/NostrTeamsService';
import toast from 'react-hot-toast';

const CreateWorkoutPlanModal = ({ 
  captainPubkey, 
  teamUUID, 
  onClose, 
  onPlanCreated 
}) => {
  const { ndk, publicKey } = useNostr();
  const [isCreating, setIsCreating] = useState(false);
  
  // Form state
  const [planName, setPlanName] = useState('');
  const [planDescription, setPlanDescription] = useState('');
  const [duration, setDuration] = useState('');
  const [difficulty, setDifficulty] = useState('beginner');
  const [exercises, setExercises] = useState([{
    name: '',
    type: 'warmup',
    duration: '',
    distance: '',
    intensity: 'easy',
    sets: '',
    reps: '',
    notes: ''
  }]);

  const exerciseTypes = [
    { label: 'Warm-up', value: 'warmup' },
    { label: 'Intervals', value: 'intervals' },
    { label: 'Steady Run', value: 'steady' },
    { label: 'Cool-down', value: 'cooldown' },
    { label: 'Strength', value: 'strength' }
  ];

  const intensityLevels = [
    { label: 'Easy', value: 'easy' },
    { label: 'Moderate', value: 'moderate' },
    { label: 'Hard', value: 'hard' }
  ];

  const difficultyLevels = [
    { label: 'Beginner', value: 'beginner' },
    { label: 'Intermediate', value: 'intermediate' },
    { label: 'Advanced', value: 'advanced' }
  ];

  const planTemplates = [
    {
      name: '5K Training Plan',
      description: 'Progressive 5K training for beginners',
      duration: '8 weeks',
      difficulty: 'beginner',
      exercises: [
        { name: 'Warm-up Walk', type: 'warmup', duration: '5 minutes', intensity: 'easy' },
        { name: 'Run/Walk Intervals', type: 'intervals', duration: '20 minutes', intensity: 'moderate', notes: 'Alternate 1 min run, 2 min walk' },
        { name: 'Cool-down Walk', type: 'cooldown', duration: '5 minutes', intensity: 'easy' }
      ]
    },
    {
      name: 'Half Marathon Plan',
      description: 'Structured half marathon training',
      duration: '12 weeks',
      difficulty: 'intermediate',
      exercises: [
        { name: 'Dynamic Warm-up', type: 'warmup', duration: '10 minutes', intensity: 'easy' },
        { name: 'Tempo Run', type: 'steady', distance: '8km', intensity: 'moderate' },
        { name: 'Cool-down Jog', type: 'cooldown', duration: '10 minutes', intensity: 'easy' }
      ]
    },
    {
      name: 'Speed Training',
      description: 'Advanced speed and interval training',
      duration: '6 weeks',
      difficulty: 'advanced',
      exercises: [
        { name: 'Dynamic Warm-up', type: 'warmup', duration: '15 minutes', intensity: 'easy' },
        { name: '400m Intervals', type: 'intervals', sets: '8', distance: '400m', intensity: 'hard', notes: '90 sec rest between reps' },
        { name: 'Cool-down', type: 'cooldown', duration: '15 minutes', intensity: 'easy' }
      ]
    }
  ];

  const applyTemplate = (template) => {
    setPlanName(template.name);
    setPlanDescription(template.description);
    setDuration(template.duration);
    setDifficulty(template.difficulty);
    setExercises(template.exercises.map(ex => ({
      name: ex.name,
      type: ex.type,
      duration: ex.duration || '',
      distance: ex.distance || '',
      intensity: ex.intensity || 'easy',
      sets: ex.sets || '',
      reps: ex.reps || '',
      notes: ex.notes || ''
    })));
  };

  const addExercise = () => {
    setExercises([...exercises, {
      name: '',
      type: 'warmup',
      duration: '',
      distance: '',
      intensity: 'easy',
      sets: '',
      reps: '',
      notes: ''
    }]);
  };

  const removeExercise = (index) => {
    if (exercises.length > 1) {
      setExercises(exercises.filter((_, i) => i !== index));
    }
  };

  const updateExercise = (index, field, value) => {
    const updatedExercises = exercises.map((exercise, i) => 
      i === index ? { ...exercise, [field]: value } : exercise
    );
    setExercises(updatedExercises);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!ndk || !publicKey) {
      toast.error('Not connected to Nostr');
      return;
    }

    if (!planName.trim()) {
      toast.error('Please enter a plan name');
      return;
    }

    // Validate that at least one exercise has a name
    const validExercises = exercises.filter(ex => ex.name.trim());
    if (validExercises.length === 0) {
      toast.error('Please add at least one exercise');
      return;
    }

    setIsCreating(true);
    const toastId = toast.loading('Creating workout plan...');

    try {
      const teamAIdentifier = `33404:${captainPubkey}:${teamUUID}`;
      
      await createWorkoutPlan(ndk, {
        teamAIdentifier,
        name: planName.trim(),
        description: planDescription.trim() || undefined,
        duration: duration.trim() || undefined,
        difficulty,
        exercises: validExercises,
        creatorPubkey: publicKey
      });

      toast.success('Workout plan created successfully!', { id: toastId });
      onPlanCreated();
    } catch (error) {
      console.error('Error creating workout plan:', error);
      toast.error('Failed to create workout plan', { id: toastId });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-bg-primary border border-border-secondary rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-text-primary">Create Workout Plan</h2>
            <button
              onClick={onClose}
              className="text-text-muted hover:text-text-primary transition-colors"
              disabled={isCreating}
            >
              ✕
            </button>
          </div>

          {/* Quick Templates */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-text-primary mb-2">Quick Templates</h3>
            <div className="flex flex-wrap gap-2">
              {planTemplates.map((template, index) => (
                <button
                  key={index}
                  onClick={() => applyTemplate(template)}
                  className="px-3 py-1 text-xs bg-bg-secondary hover:bg-bg-tertiary text-text-primary border border-border-secondary rounded transition-colors"
                  disabled={isCreating}
                >
                  {template.name}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Plan Name *
                </label>
                <input
                  type="text"
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  className="w-full p-3 bg-bg-secondary border border-border-secondary rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g., 5K Training Plan"
                  required
                  disabled={isCreating}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Duration
                </label>
                <input
                  type="text"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-full p-3 bg-bg-secondary border border-border-secondary rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g., 8 weeks, 3 months"
                  disabled={isCreating}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Description
              </label>
              <textarea
                value={planDescription}
                onChange={(e) => setPlanDescription(e.target.value)}
                className="w-full p-3 bg-bg-secondary border border-border-secondary rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Describe your workout plan..."
                rows={3}
                disabled={isCreating}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Difficulty Level
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full p-3 bg-bg-secondary border border-border-secondary rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={isCreating}
              >
                {difficultyLevels.map(level => (
                  <option key={level.value} value={level.value}>
                    {level.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Exercises */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-text-primary">Exercises</h3>
                <button
                  type="button"
                  onClick={addExercise}
                  className="px-3 py-1 bg-primary hover:bg-primary-hover text-white text-sm rounded transition-colors"
                  disabled={isCreating}
                >
                  Add Exercise
                </button>
              </div>

              <div className="space-y-4">
                {exercises.map((exercise, index) => (
                  <div key={index} className="border border-border-secondary rounded-lg p-4 bg-bg-secondary">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-medium text-text-primary">Exercise {index + 1}</h4>
                      {exercises.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeExercise(index)}
                          className="text-red-400 hover:text-red-300 text-sm"
                          disabled={isCreating}
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1">
                          Exercise Name *
                        </label>
                        <input
                          type="text"
                          value={exercise.name}
                          onChange={(e) => updateExercise(index, 'name', e.target.value)}
                          className="w-full p-2 bg-bg-primary border border-border-secondary rounded text-text-primary text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                          placeholder="e.g., Warm-up Run"
                          disabled={isCreating}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1">
                          Type
                        </label>
                        <select
                          value={exercise.type}
                          onChange={(e) => updateExercise(index, 'type', e.target.value)}
                          className="w-full p-2 bg-bg-primary border border-border-secondary rounded text-text-primary text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                          disabled={isCreating}
                        >
                          {exerciseTypes.map(type => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1">
                          Duration
                        </label>
                        <input
                          type="text"
                          value={exercise.duration}
                          onChange={(e) => updateExercise(index, 'duration', e.target.value)}
                          className="w-full p-2 bg-bg-primary border border-border-secondary rounded text-text-primary text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                          placeholder="e.g., 10 minutes"
                          disabled={isCreating}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1">
                          Distance
                        </label>
                        <input
                          type="text"
                          value={exercise.distance}
                          onChange={(e) => updateExercise(index, 'distance', e.target.value)}
                          className="w-full p-2 bg-bg-primary border border-border-secondary rounded text-text-primary text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                          placeholder="e.g., 2km, 400m"
                          disabled={isCreating}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1">
                          Intensity
                        </label>
                        <select
                          value={exercise.intensity}
                          onChange={(e) => updateExercise(index, 'intensity', e.target.value)}
                          className="w-full p-2 bg-bg-primary border border-border-secondary rounded text-text-primary text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                          disabled={isCreating}
                        >
                          {intensityLevels.map(level => (
                            <option key={level.value} value={level.value}>
                              {level.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1">
                          Sets/Reps
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={exercise.sets}
                            onChange={(e) => updateExercise(index, 'sets', e.target.value)}
                            className="w-1/2 p-2 bg-bg-primary border border-border-secondary rounded text-text-primary text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                            placeholder="Sets"
                            disabled={isCreating}
                          />
                          <input
                            type="text"
                            value={exercise.reps}
                            onChange={(e) => updateExercise(index, 'reps', e.target.value)}
                            className="w-1/2 p-2 bg-bg-primary border border-border-secondary rounded text-text-primary text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                            placeholder="Reps"
                            disabled={isCreating}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-3">
                      <label className="block text-xs font-medium text-text-secondary mb-1">
                        Notes
                      </label>
                      <textarea
                        value={exercise.notes}
                        onChange={(e) => updateExercise(index, 'notes', e.target.value)}
                        className="w-full p-2 bg-bg-primary border border-border-secondary rounded text-text-primary text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder="Additional notes or instructions..."
                        rows={2}
                        disabled={isCreating}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-border-secondary">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-bg-secondary hover:bg-bg-tertiary text-text-primary border border-border-secondary rounded-lg transition-colors"
                disabled={isCreating}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-primary hover:bg-primary-hover text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isCreating}
              >
                {isCreating ? 'Creating...' : 'Create Plan'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateWorkoutPlanModal;