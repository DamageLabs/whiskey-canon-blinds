import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ScoreSlider } from './ScoreSlider';
import { Button, Textarea, Input, Modal } from '@/components/ui';
import { calculateTotalScore } from '@/utils/scoring';
import type { ScoreInput } from '@/types';

const scoreSchema = z.object({
  nose: z.number().min(1).max(10),
  palate: z.number().min(1).max(10),
  finish: z.number().min(1).max(10),
  overall: z.number().min(1).max(10),
  noseNotes: z.string().optional(),
  palateNotes: z.string().optional(),
  finishNotes: z.string().optional(),
  generalNotes: z.string().optional(),
  identityGuess: z.string().optional(),
});

interface ScoreFormProps {
  whiskeyNumber: number;
  onSubmit: (score: ScoreInput) => void;
  disabled?: boolean;
}

export function ScoreForm({ whiskeyNumber, onSubmit, disabled = false }: ScoreFormProps) {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [scores, setScores] = useState({
    nose: 5,
    palate: 5,
    finish: 5,
    overall: 5,
  });

  const { register, handleSubmit } = useForm<ScoreInput>({
    resolver: zodResolver(scoreSchema),
    defaultValues: {
      nose: 5,
      palate: 5,
      finish: 5,
      overall: 5,
      noseNotes: '',
      palateNotes: '',
      finishNotes: '',
      generalNotes: '',
      identityGuess: '',
    },
  });

  const totalScore = calculateTotalScore(scores);

  const handleScoreChange = (category: keyof typeof scores, value: number) => {
    setScores((prev) => ({ ...prev, [category]: value }));
  };

  const handleFormSubmit = () => {
    setShowConfirmModal(true);
  };

  const confirmSubmit = () => {
    handleSubmit((data) => {
      onSubmit({ ...data, ...scores });
    })();
    setShowConfirmModal(false);
  };

  return (
    <>
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
        {/* Header */}
        <div className="text-center pb-4 border-b border-zinc-700">
          <h2 className="text-xl font-semibold text-zinc-100">
            Whiskey #{whiskeyNumber}
          </h2>
          <div className="mt-2">
            <span className="text-3xl font-bold text-amber-500">{totalScore.toFixed(1)}</span>
            <span className="text-zinc-400 ml-2">/ 10</span>
          </div>
          <p className="text-sm text-zinc-500 mt-1">Weighted Total Score</p>
        </div>

        {/* Score Sliders */}
        <div className="space-y-6">
          <ScoreSlider
            label="Nose (25%)"
            value={scores.nose}
            onChange={(v) => handleScoreChange('nose', v)}
            disabled={disabled}
          />
          <ScoreSlider
            label="Palate (35%)"
            value={scores.palate}
            onChange={(v) => handleScoreChange('palate', v)}
            disabled={disabled}
          />
          <ScoreSlider
            label="Finish (25%)"
            value={scores.finish}
            onChange={(v) => handleScoreChange('finish', v)}
            disabled={disabled}
          />
          <ScoreSlider
            label="Overall Impression (15%)"
            value={scores.overall}
            onChange={(v) => handleScoreChange('overall', v)}
            disabled={disabled}
          />
        </div>

        {/* Tasting Notes */}
        <div className="space-y-4 pt-4 border-t border-zinc-700">
          <h3 className="text-lg font-medium text-zinc-200">Tasting Notes</h3>

          <Textarea
            label="Nose Notes"
            placeholder="Aromas: caramel, vanilla, oak, spice..."
            rows={2}
            disabled={disabled}
            {...register('noseNotes')}
          />

          <Textarea
            label="Palate Notes"
            placeholder="Flavors: honey, citrus, pepper, char..."
            rows={2}
            disabled={disabled}
            {...register('palateNotes')}
          />

          <Textarea
            label="Finish Notes"
            placeholder="Length, warmth, lingering notes..."
            rows={2}
            disabled={disabled}
            {...register('finishNotes')}
          />

          <Textarea
            label="General Comments"
            placeholder="Overall thoughts, comparisons..."
            rows={2}
            disabled={disabled}
            {...register('generalNotes')}
          />

          <Input
            label="Identity Guess (Optional)"
            placeholder="What do you think this is?"
            disabled={disabled}
            {...register('identityGuess')}
          />
        </div>

        {/* Submit Button */}
        <div className="pt-4">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            disabled={disabled}
          >
            Lock In Scores
          </Button>
          <p className="text-xs text-zinc-500 text-center mt-2">
            Scores cannot be changed after submission
          </p>
        </div>
      </form>

      {/* Confirmation Modal */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="Confirm Your Scores"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowConfirmModal(false)}>
              Go Back
            </Button>
            <Button variant="primary" onClick={confirmSubmit}>
              Lock Scores
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-zinc-300">
            Are you sure you want to lock in your scores for Whiskey #{whiskeyNumber}?
          </p>
          <div className="bg-zinc-900 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-zinc-400">Nose:</span>
              <span className="text-zinc-100 font-medium">{scores.nose}/10</span>
              <span className="text-zinc-400">Palate:</span>
              <span className="text-zinc-100 font-medium">{scores.palate}/10</span>
              <span className="text-zinc-400">Finish:</span>
              <span className="text-zinc-100 font-medium">{scores.finish}/10</span>
              <span className="text-zinc-400">Overall:</span>
              <span className="text-zinc-100 font-medium">{scores.overall}/10</span>
              <span className="text-zinc-400 font-medium pt-2 border-t border-zinc-700">Total:</span>
              <span className="text-amber-500 font-bold pt-2 border-t border-zinc-700">
                {totalScore.toFixed(1)}/10
              </span>
            </div>
          </div>
          <p className="text-amber-400 text-sm">
            This action cannot be undone.
          </p>
        </div>
      </Modal>
    </>
  );
}
