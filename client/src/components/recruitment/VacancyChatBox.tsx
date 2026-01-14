import { useState, useRef, useEffect } from 'react';
import {
  useVacancyChatProcess,
  useCreateVacancy,
  type VacancyChatMessage,
  type ExtractedVacancyData,
  type GeneratedJD,
} from '../../hooks/useRecruitment';

interface VacancyChatBoxProps {
  onVacancyCreated: () => void;
}

const INITIAL_MESSAGE = "Hi! Tell me about the position you're hiring for - share the role, experience, location, salary, and employment type.";

export function VacancyChatBox({ onVacancyCreated }: VacancyChatBoxProps) {
  const [messages, setMessages] = useState<VacancyChatMessage[]>([
    { role: 'assistant', content: INITIAL_MESSAGE }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [extractedData, setExtractedData] = useState<ExtractedVacancyData>({});
  const [generatedJD, setGeneratedJD] = useState<GeneratedJD | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedJD, setEditedJD] = useState<GeneratedJD | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const chatMutation = useVacancyChatProcess();
  const createVacancyMutation = useCreateVacancy();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || chatMutation.isPending) return;

    const userMessage = inputValue.trim();
    setInputValue('');

    const newMessages: VacancyChatMessage[] = [
      ...messages,
      { role: 'user', content: userMessage }
    ];
    setMessages(newMessages);

    try {
      const response = await chatMutation.mutateAsync({
        message: userMessage,
        conversationHistory: newMessages,
        extractedData,
      });

      setExtractedData(response.extractedData);
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: response.response }
      ]);

      if (response.isComplete && response.generatedJD) {
        setGeneratedJD(response.generatedJD);
        setEditedJD(response.generatedJD);
      }
    } catch (error) {
      console.error('Error processing message:', error);
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }
      ]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handlePublish = async (status: 'draft' | 'open') => {
    const jdToSave = editedJD || generatedJD;
    if (!jdToSave) return;

    try {
      await createVacancyMutation.mutateAsync({
        title: jdToSave.title,
        department: jdToSave.department,
        location: jdToSave.location,
        employment_type: jdToSave.employment_type as 'full_time' | 'part_time' | 'contract' | 'internship',
        experience_min: jdToSave.experience_min,
        experience_max: jdToSave.experience_max,
        salary_min: jdToSave.salary_min,
        salary_max: jdToSave.salary_max,
        openings_count: jdToSave.openings_count,
        job_description: jdToSave.job_description,
        responsibilities: jdToSave.responsibilities,
        requirements: jdToSave.requirements,
        skills_required: jdToSave.skills_required,
        qualifications: jdToSave.qualifications,
        benefits: jdToSave.benefits,
        status,
        priority: 'medium',
      });

      if (status === 'open') {
        setShowExportModal(true);
      } else {
        resetChat();
        onVacancyCreated();
      }
    } catch (error) {
      console.error('Error saving vacancy:', error);
    }
  };

  const resetChat = () => {
    setMessages([{ role: 'assistant', content: INITIAL_MESSAGE }]);
    setExtractedData({});
    setGeneratedJD(null);
    setEditedJD(null);
    setIsEditing(false);
    setShowExportModal(false);
  };

  const formatSalary = (amount: number) => `₹${(amount / 100000).toFixed(1)}L`;

  // Export Modal
  const ExportModal = () => {
    const [copied, setCopied] = useState<string | null>(null);
    const jd = editedJD || generatedJD;
    if (!jd) return null;

    const formatForNaukri = () => `Job Title: ${jd.title}
Location: ${jd.location}
Employment Type: ${jd.employment_type?.replace('_', ' ').toUpperCase()}
Experience: ${jd.experience_min} - ${jd.experience_max} years
Salary: ${formatSalary(jd.salary_min)} - ${formatSalary(jd.salary_max)} per annum

About the Role:
${jd.job_description}

Key Responsibilities:
• ${jd.responsibilities}

Requirements:
• ${jd.requirements}

Skills Required:
${jd.skills_required}

Qualifications:
${jd.qualifications}

What We Offer:
• ${jd.benefits}`;

    const formatForLinkedIn = () => `${jd.title}

${jd.job_description}

What You'll Do:
• ${jd.responsibilities}

What We're Looking For:
• ${jd.requirements}

Required Skills: ${jd.skills_required}

Compensation: ${formatSalary(jd.salary_min)} - ${formatSalary(jd.salary_max)} annually
Location: ${jd.location}`;

    const copyToClipboard = async (text: string, type: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(type);
        setTimeout(() => setCopied(null), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    };

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
          <div className="bg-green-600 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Vacancy Published!</h2>
                <p className="text-white/80 text-sm">{jd.title}</p>
              </div>
            </div>
            <button onClick={() => { resetChat(); onVacancyCreated(); }} className="text-white/80 hover:text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-6 overflow-y-auto max-h-[calc(80vh-150px)] space-y-4">
            <div className="flex gap-3">
              <button
                onClick={() => copyToClipboard(formatForNaukri(), 'naukri')}
                className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  copied === 'naukri' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                }`}
              >
                {copied === 'naukri' ? 'Copied!' : 'Copy for Naukri'}
              </button>
              <button
                onClick={() => copyToClipboard(formatForLinkedIn(), 'linkedin')}
                className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  copied === 'linkedin' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                }`}
              >
                {copied === 'linkedin' ? 'Copied!' : 'Copy for LinkedIn'}
              </button>
            </div>

            <div className="flex flex-wrap gap-3 pt-4 border-t">
              <a href="https://recruiter.naukri.com/post-job" target="_blank" rel="noopener noreferrer"
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-sm">
                Post on Naukri
              </a>
              <a href="https://www.linkedin.com/talent/post-a-job" target="_blank" rel="noopener noreferrer"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                Post on LinkedIn
              </a>
              <a href="https://employers.indeed.com/p/post-job" target="_blank" rel="noopener noreferrer"
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm">
                Post on Indeed
              </a>
            </div>
          </div>

          <div className="border-t px-6 py-4 flex justify-end">
            <button onClick={() => { resetChat(); onVacancyCreated(); }}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
              Done
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-white font-medium text-sm">Create Vacancy</h3>
          <p className="text-white/70 text-xs">Describe your requirements in chat</p>
        </div>
        {(messages.length > 1 || generatedJD) && (
          <button onClick={resetChat} className="text-white/70 hover:text-white text-xs px-2 py-1 rounded hover:bg-white/10">
            New Chat
          </button>
        )}
      </div>

      {/* Chat or JD Preview */}
      {!generatedJD ? (
        <>
          {/* Messages */}
          <div className="h-64 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-gray-900">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-sm'
                    : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-bl-sm'
                }`}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            {chatMutation.isPending && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-2 rounded-xl rounded-bl-sm">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Extracted Fields Preview */}
          {Object.keys(extractedData).length > 0 && (
            <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-t border-blue-100 dark:border-blue-800">
              <div className="flex flex-wrap gap-2 text-xs">
                {extractedData.title && (
                  <span className="px-2 py-1 bg-white dark:bg-gray-800 rounded border border-blue-200 dark:border-blue-700">
                    <span className="text-gray-500">Role:</span> <span className="font-medium text-gray-900 dark:text-white">{extractedData.title}</span>
                  </span>
                )}
                {extractedData.experience_min !== undefined && (
                  <span className="px-2 py-1 bg-white dark:bg-gray-800 rounded border border-blue-200 dark:border-blue-700">
                    <span className="text-gray-500">Exp:</span> <span className="font-medium text-gray-900 dark:text-white">{extractedData.experience_min}-{extractedData.experience_max || '?'}y</span>
                  </span>
                )}
                {extractedData.location && (
                  <span className="px-2 py-1 bg-white dark:bg-gray-800 rounded border border-blue-200 dark:border-blue-700">
                    <span className="text-gray-500">Loc:</span> <span className="font-medium text-gray-900 dark:text-white">{extractedData.location}</span>
                  </span>
                )}
                {extractedData.salary_min && (
                  <span className="px-2 py-1 bg-white dark:bg-gray-800 rounded border border-blue-200 dark:border-blue-700">
                    <span className="text-gray-500">CTC:</span> <span className="font-medium text-gray-900 dark:text-white">{formatSalary(extractedData.salary_min)}</span>
                  </span>
                )}
                {extractedData.employment_type && (
                  <span className="px-2 py-1 bg-white dark:bg-gray-800 rounded border border-blue-200 dark:border-blue-700">
                    <span className="font-medium text-gray-900 dark:text-white">{extractedData.employment_type.replace('_', ' ')}</span>
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="p-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="e.g., React developer, 3-5 years, Noida, 12-15 LPA, full-time"
                disabled={chatMutation.isPending}
                rows={3}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 resize-none"
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || chatMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </>
      ) : (
        // JD Preview & Actions
        <div className="p-4 space-y-4">
          {!isEditing ? (
            // Preview Mode
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-lg font-bold text-gray-900 dark:text-white">{editedJD?.title || generatedJD.title}</h4>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded text-xs">
                      {editedJD?.location || generatedJD.location}
                    </span>
                    <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded text-xs">
                      {(editedJD?.employment_type || generatedJD.employment_type)?.replace('_', ' ')}
                    </span>
                    <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded text-xs">
                      {editedJD?.experience_min || generatedJD.experience_min}-{editedJD?.experience_max || generatedJD.experience_max}y
                    </span>
                    <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 rounded text-xs">
                      {formatSalary(editedJD?.salary_min || generatedJD.salary_min)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-3 text-sm">
                <div>
                  <h5 className="font-semibold text-gray-800 dark:text-gray-200 mb-1">About</h5>
                  <p className="text-gray-600 dark:text-gray-400">{editedJD?.job_description || generatedJD.job_description}</p>
                </div>
                <div>
                  <h5 className="font-semibold text-gray-800 dark:text-gray-200 mb-1">Responsibilities</h5>
                  <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">• {editedJD?.responsibilities || generatedJD.responsibilities}</p>
                </div>
                <div>
                  <h5 className="font-semibold text-gray-800 dark:text-gray-200 mb-1">Skills</h5>
                  <div className="flex flex-wrap gap-1">
                    {(editedJD?.skills_required || generatedJD.skills_required)?.split(',').slice(0, 6).map((skill, i) => (
                      <span key={i} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs">
                        {skill.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Edit Mode
            <div className="space-y-3 max-h-64 overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
                <input
                  type="text"
                  value={editedJD?.title || ''}
                  onChange={(e) => setEditedJD(prev => prev ? { ...prev, title: e.target.value } : null)}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Summary</label>
                <textarea
                  value={editedJD?.job_description || ''}
                  onChange={(e) => setEditedJD(prev => prev ? { ...prev, job_description: e.target.value } : null)}
                  rows={2}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Responsibilities</label>
                <textarea
                  value={editedJD?.responsibilities || ''}
                  onChange={(e) => setEditedJD(prev => prev ? { ...prev, responsibilities: e.target.value } : null)}
                  rows={3}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Skills (comma-separated)</label>
                <input
                  type="text"
                  value={editedJD?.skills_required || ''}
                  onChange={(e) => setEditedJD(prev => prev ? { ...prev, skills_required: e.target.value } : null)}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              {isEditing ? 'Preview' : 'Edit'}
            </button>
            <button
              onClick={() => handlePublish('draft')}
              disabled={createVacancyMutation.isPending}
              className="px-3 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
            >
              Save Draft
            </button>
            <button
              onClick={() => handlePublish('open')}
              disabled={createVacancyMutation.isPending}
              className="flex-1 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              Publish
            </button>
          </div>
        </div>
      )}

      {showExportModal && <ExportModal />}
    </div>
  );
}
