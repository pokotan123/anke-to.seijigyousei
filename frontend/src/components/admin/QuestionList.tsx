'use client';

import type { Question, Option } from '../../lib/types';
import { questionTypeLabel } from '../../lib/formatters';

interface QuestionListProps {
  questions: Question[];
  readOnlyQuestionTypes?: string[];
  onAddQuestion: () => void;
  onEditQuestion: (question: Question) => void;
  onDeleteQuestion: (questionId: number) => void;
  onMoveQuestion: (questionId: number, direction: 'up' | 'down') => void;
  onAddOption: (questionId: number) => void;
  onEditOption: (questionId: number, option: Option) => void;
  onDeleteOption: (optionId: number) => void;
  onMoveOption: (questionId: number, optionId: number, direction: 'up' | 'down') => void;
}

export default function QuestionList({
  questions,
  readOnlyQuestionTypes = [],
  onAddQuestion,
  onEditQuestion,
  onDeleteQuestion,
  onMoveQuestion,
  onAddOption,
  onEditOption,
  onDeleteOption,
  onMoveOption,
}: QuestionListProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 sm:p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-sm font-bold text-slate-800">質問一覧</h2>
        <button
          onClick={onAddQuestion}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 cursor-pointer transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          質問を追加
        </button>
      </div>
      <div className="space-y-4">
        {questions.map((question, index) => {
          const isReadOnly = readOnlyQuestionTypes.includes(question.question_type);
          return (
            <div key={question.id} className="border border-slate-200 rounded-xl p-5">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 mb-1">
                    <span className="inline-flex items-center justify-center w-6 h-6 bg-primary-100 text-primary-700 rounded-full text-xs font-bold shrink-0">{index + 1}</span>
                    <h3 className="font-semibold text-slate-800 text-sm">
                      {question.question_text}
                      {question.is_required && <span className="text-red-500 ml-1">*</span>}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 ml-8">
                    <span className="text-xs text-slate-400">{questionTypeLabel(question.question_type)}</span>
                    {isReadOnly && (
                      <span className="inline-flex px-1.5 py-0.5 text-xs bg-slate-100 text-slate-500 rounded">固定</span>
                    )}
                  </div>
                </div>
                {!isReadOnly && (
                  <div className="flex items-center gap-1.5 shrink-0 ml-3">
                    <button
                      onClick={() => onMoveQuestion(question.id, 'up')}
                      disabled={index === 0}
                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md disabled:opacity-30 cursor-pointer transition-colors"
                      aria-label="質問を上に移動"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onMoveQuestion(question.id, 'down')}
                      disabled={index === questions.length - 1}
                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md disabled:opacity-30 cursor-pointer transition-colors"
                      aria-label="質問を下に移動"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onEditQuestion(question)}
                      className="px-2.5 py-1.5 text-xs text-primary-600 hover:bg-primary-50 rounded-md border border-primary-200 cursor-pointer transition-colors"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => onDeleteQuestion(question.id)}
                      className="px-2.5 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-md border border-red-200 cursor-pointer transition-colors"
                    >
                      削除
                    </button>
                  </div>
                )}
              </div>
              {(question.question_type === 'single_choice' || question.question_type === 'multiple_choice') && (
                <div className="mt-4 ml-8">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-xs font-medium text-slate-500">選択肢</h4>
                    {!isReadOnly && (
                      <button
                        onClick={() => onAddOption(question.id)}
                        className="text-xs text-primary-600 hover:text-primary-700 cursor-pointer transition-colors"
                      >
                        + 追加
                      </button>
                    )}
                  </div>
                  <ul className="space-y-2">
                    {question.options && question.options.length > 0 ? (
                      question.options.map((option) => (
                        <li key={option.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg">
                          <span className="text-sm text-slate-700">{option.option_text}</span>
                          {!isReadOnly && (
                            <div className="flex items-center gap-1.5 shrink-0 ml-2">
                              <button
                                onClick={() => onMoveOption(question.id, option.id, 'up')}
                                disabled={question.options?.findIndex((o) => o.id === option.id) === 0}
                                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded disabled:opacity-30 cursor-pointer transition-colors"
                                aria-label="選択肢を上に移動"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                </svg>
                              </button>
                              <button
                                onClick={() => onMoveOption(question.id, option.id, 'down')}
                                disabled={question.options?.findIndex((o) => o.id === option.id) === (question.options?.length || 0) - 1}
                                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded disabled:opacity-30 cursor-pointer transition-colors"
                                aria-label="選択肢を下に移動"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                              <button
                                onClick={() => onEditOption(question.id, option)}
                                className="px-2 py-1 text-xs text-primary-600 hover:bg-primary-50 rounded cursor-pointer transition-colors"
                              >
                                編集
                              </button>
                              <button
                                onClick={() => onDeleteOption(option.id)}
                                className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded cursor-pointer transition-colors"
                              >
                                削除
                              </button>
                            </div>
                          )}
                        </li>
                      ))
                    ) : (
                      <li className="text-xs text-slate-400 py-3 text-center">選択肢がありません</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
        {questions.length === 0 && (
          <div className="text-center py-12">
            <svg className="w-10 h-10 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
            <p className="text-sm text-slate-400">質問がありません</p>
            <p className="text-xs text-slate-400 mt-1">上のボタンから質問を追加してください</p>
          </div>
        )}
      </div>
    </div>
  );
}
