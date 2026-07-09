import React from 'react';
import { ArrowRight, CheckCircle2, Circle, LockKeyhole } from 'lucide-react';
import { SetupProgress, SetupStep, SetupTargetTab } from '../lib/setupProgress';

interface SetupGuideProps {
  progress: SetupProgress;
  onNavigate: (tab: SetupTargetTab) => void;
  onAction?: (step: SetupStep) => void;
  className?: string;
}

const stateLabel = {
  done: 'เสร็จแล้ว',
  current: 'ทำขั้นนี้ต่อ',
  locked: 'รอขั้นก่อนหน้า'
};

export const SetupGuide: React.FC<SetupGuideProps> = ({
  progress,
  onNavigate,
  onAction,
  className = ''
}) => {
  const currentStep = progress.currentStep;

  if (!currentStep) return null;

  const handlePrimaryAction = () => {
    if (onAction) {
      onAction(currentStep);
      return;
    }
    onNavigate(currentStep.targetTab);
  };

  return (
    <section
      className={`bg-white border border-emerald-100 rounded-2xl p-4 md:p-5 shadow-xs space-y-4 ${className}`}
      id="setup-guide"
    >
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div>
          <h2 className="text-sm font-extrabold text-slate-800">เริ่มใช้งานตามลำดับนี้</h2>
          <p className="text-xs text-slate-500 mt-1">
            สร้างข้อมูลสินค้าให้ครบก่อนรับเข้าและเปิดบิลขาย
          </p>
        </div>
        <button
          type="button"
          onClick={handlePrimaryAction}
          className="self-start bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold py-2.5 px-4 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          {currentStep.ctaLabel}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2">
        {progress.steps.map((step, index) => {
          const isDone = step.state === 'done';
          const isCurrent = step.state === 'current';
          const Icon = isDone ? CheckCircle2 : isCurrent ? Circle : LockKeyhole;

          return (
            <div
              key={step.id}
              className={`min-h-24 rounded-xl border p-3 text-left transition-colors ${
                isCurrent
                  ? 'border-emerald-200 bg-emerald-50/65'
                  : isDone
                    ? 'border-slate-100 bg-slate-50/70'
                    : 'border-slate-100 bg-white text-slate-400'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-mono font-bold text-slate-400">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <Icon
                  className={`w-4 h-4 ${
                    isDone ? 'text-emerald-700' : isCurrent ? 'text-emerald-700' : 'text-slate-300'
                  }`}
                />
              </div>
              <div className="mt-2">
                <p className={`text-xs font-extrabold ${isCurrent || isDone ? 'text-slate-800' : 'text-slate-400'}`}>
                  {step.label}
                </p>
                <p className="text-[11px] text-slate-500 leading-relaxed mt-1">
                  {step.description}
                </p>
                <span
                  className={`inline-block mt-2 text-[10px] font-bold rounded-full px-2 py-0.5 ${
                    isCurrent
                      ? 'bg-emerald-700 text-white'
                      : isDone
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {stateLabel[step.state]}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
