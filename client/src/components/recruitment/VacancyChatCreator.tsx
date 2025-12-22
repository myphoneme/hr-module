import { useState, useRef, useEffect } from 'react';
import {
  useVacancyChatProcess,
  useCreateVacancy,
  type VacancyChatMessage,
  type ExtractedVacancyData,
  type GeneratedJD,
  type Vacancy,
} from '../../hooks/useRecruitment';

interface VacancyChatCreatorProps {
  onClose: () => void;
  onVacancyCreated: (vacancy: Vacancy) => void;
}

const INITIAL_MESSAGE = "Hi! Tell me about the position you're hiring for - you can share the role, experience needed, location, salary range, and whether it's full-time or part-time.";

export function VacancyChatCreator({ onClose, onVacancyCreated }: VacancyChatCreatorProps) {
  const [messages, setMessages] = useState<VacancyChatMessage[]>([
    { role: 'assistant', content: INITIAL_MESSAGE }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [extractedData, setExtractedData] = useState<ExtractedVacancyData>({});
  const [generatedJD, setGeneratedJD] = useState<GeneratedJD | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedJD, setEditedJD] = useState<GeneratedJD | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [createdVacancy, setCreatedVacancy] = useState<Vacancy | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const chatMutation = useVacancyChatProcess();
  const createVacancyMutation = useCreateVacancy();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || chatMutation.isPending) return;

    const userMessage = inputValue.trim();
    setInputValue('');

    // Add user message
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

      // Update extracted data
      setExtractedData(response.extractedData);

      // Add assistant response
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: response.response }
      ]);

      // If JD is generated, store it
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

  const handleApprove = async () => {
    const jdToSave = editedJD || generatedJD;
    if (!jdToSave) return;

    try {
      const vacancy = await createVacancyMutation.mutateAsync({
        title: jdToSave.title,
        department: jdToSave.department,
        location: jdToSave.location,
        employment_type: jdToSave.employment_type as any,
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
        status: 'draft',
        priority: 'medium',
      });

      onVacancyCreated(vacancy);
      onClose();
    } catch (error) {
      console.error('Error saving vacancy:', error);
    }
  };

  const handlePublish = async () => {
    const jdToSave = editedJD || generatedJD;
    if (!jdToSave) return;

    try {
      const vacancy = await createVacancyMutation.mutateAsync({
        title: jdToSave.title,
        department: jdToSave.department,
        location: jdToSave.location,
        employment_type: jdToSave.employment_type as any,
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
        status: 'open',
        priority: 'medium',
      });

      setCreatedVacancy(vacancy);
      setShowExportModal(true);
    } catch (error) {
      console.error('Error publishing vacancy:', error);
    }
  };

  const formatSalary = (amount: number) => {
    return `₹${(amount / 100000).toFixed(1)}L`;
  };

  // Export modal for Naukri/LinkedIn/Indeed
  const ExportModal = () => {
    const [copied, setCopied] = useState<string | null>(null);
    const jd = editedJD || generatedJD;
    if (!jd) return null;

    const formatForNaukri = () => {
      return `Job Title: ${jd.title}
Department: ${jd.department || 'Not specified'}
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
    };

    const formatForLinkedIn = () => {
      return `${jd.title}

${jd.job_description}

What You'll Do:
• ${jd.responsibilities}

What We're Looking For:
• ${jd.requirements}

Required Skills: ${jd.skills_required}

Education: ${jd.qualifications}

Compensation: ${formatSalary(jd.salary_min)} - ${formatSalary(jd.salary_max)} annually
Location: ${jd.location}
Employment Type: ${jd.employment_type?.replace('_', ' ')}

Benefits:
• ${jd.benefits}`;
    };

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
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="bg-green-600 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Vacancy Published!</h2>
                <p className="text-white/80 text-sm">{jd.title} - Ready to share</p>
              </div>
            </div>
            <button
              onClick={() => {
                onVacancyCreated(createdVacancy!);
                onClose();
              }}
              className="text-white/80 hover:text-white"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)] space-y-6">
            {/* Naukri Format */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <span className="text-orange-500">N</span> Naukri Format
                </h3>
                <button
                  onClick={() => copyToClipboard(formatForNaukri(), 'naukri')}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    copied === 'naukri'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                      : 'bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900 dark:text-orange-300'
                  }`}
                >
                  {copied === 'naukri' ? 'Copied!' : 'Copy for Naukri'}
                </button>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 max-h-48 overflow-y-auto">
                <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-sans">
                  {formatForNaukri()}
                </pre>
              </div>
            </div>

            {/* LinkedIn Format */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <span className="text-blue-600">in</span> LinkedIn Format
                </h3>
                <button
                  onClick={() => copyToClipboard(formatForLinkedIn(), 'linkedin')}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    copied === 'linkedin'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                      : 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300'
                  }`}
                >
                  {copied === 'linkedin' ? 'Copied!' : 'Copy for LinkedIn'}
                </button>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 max-h-48 overflow-y-auto">
                <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-sans">
                  {formatForLinkedIn()}
                </pre>
              </div>
            </div>

            {/* Quick Links */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Post directly to job portals:
              </h4>
              <div className="flex flex-wrap gap-3">
                <a
                  href="https://recruiter.naukri.com/post-job"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm"
                >
                  Post on Naukri
                </a>
                <a
                  href="https://www.linkedin.com/talent/post-a-job"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  Post on LinkedIn
                </a>
                <a
                  href="https://employers.indeed.com/p/post-job"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
                >
                  Post on Indeed
                </a>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-end">
            <button
              onClick={() => {
                onVacancyCreated(createdVacancy!);
                onClose();
              }}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex overflow-hidden">
        {/* Left Panel - Chat */}
        <div className="w-3/5 flex flex-col border-r border-gray-200 dark:border-gray-700">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Create Vacancy</h2>
                <p className="text-white/80 text-sm">Describe your requirements</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-md'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-md'
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                </div>
              </div>
            ))}
            {chatMutation.isPending && (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-gray-700 px-4 py-3 rounded-2xl rounded-bl-md">
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

          {/* Input */}
          {!generatedJD && (
            <div className="border-t border-gray-200 dark:border-gray-700 p-4">
              <div className="flex gap-3">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Describe the position..."
                  disabled={chatMutation.isPending}
                  className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || chatMutation.isPending}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Action buttons when JD is ready */}
          {generatedJD && (
            <div className="border-t border-gray-200 dark:border-gray-700 p-4 flex gap-3">
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="flex-1 px-4 py-3 border-2 border-blue-600 text-blue-600 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors font-medium"
              >
                {isEditing ? 'Preview' : 'Edit'}
              </button>
              <button
                onClick={handleApprove}
                disabled={createVacancyMutation.isPending}
                className="flex-1 px-4 py-3 bg-gray-600 text-white rounded-xl hover:bg-gray-700 transition-colors font-medium disabled:opacity-50"
              >
                Save as Draft
              </button>
              <button
                onClick={handlePublish}
                disabled={createVacancyMutation.isPending}
                className="flex-1 px-4 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-medium disabled:opacity-50"
              >
                Publish
              </button>
            </div>
          )}
        </div>

        {/* Right Panel - Preview */}
        <div className="w-2/5 bg-gray-50 dark:bg-gray-900 flex flex-col">
          {/* Preview Header */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {generatedJD ? 'Job Description Preview' : 'Extracted Details'}
            </h3>
          </div>

          {/* Preview Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {!generatedJD ? (
              // Show extracted fields during conversation
              <div className="space-y-4">
                <ExtractedField
                  label="Role"
                  value={extractedData.title}
                  icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  }
                />
                <ExtractedField
                  label="Experience"
                  value={
                    extractedData.experience_min !== undefined
                      ? `${extractedData.experience_min}${extractedData.experience_max ? `-${extractedData.experience_max}` : '+'} years`
                      : undefined
                  }
                  icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                />
                <ExtractedField
                  label="Location"
                  value={extractedData.location}
                  icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  }
                />
                <ExtractedField
                  label="Salary"
                  value={
                    extractedData.salary_min
                      ? `${formatSalary(extractedData.salary_min)}${extractedData.salary_max ? ` - ${formatSalary(extractedData.salary_max)}` : ''}`
                      : undefined
                  }
                  icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                />
                <ExtractedField
                  label="Employment Type"
                  value={extractedData.employment_type?.replace('_', ' ')}
                  icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  }
                />
                {extractedData.openings_count && (
                  <ExtractedField
                    label="Openings"
                    value={`${extractedData.openings_count} position(s)`}
                    icon={
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    }
                  />
                )}

                {Object.keys(extractedData).length === 0 && (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <p className="text-sm">Details will appear here as you describe the position</p>
                  </div>
                )}
              </div>
            ) : isEditing ? (
              // Editable JD form
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Job Title
                  </label>
                  <input
                    type="text"
                    value={editedJD?.title || ''}
                    onChange={(e) => setEditedJD(prev => prev ? { ...prev, title: e.target.value } : null)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Job Summary
                  </label>
                  <textarea
                    value={editedJD?.job_description || ''}
                    onChange={(e) => setEditedJD(prev => prev ? { ...prev, job_description: e.target.value } : null)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Responsibilities
                  </label>
                  <textarea
                    value={editedJD?.responsibilities || ''}
                    onChange={(e) => setEditedJD(prev => prev ? { ...prev, responsibilities: e.target.value } : null)}
                    rows={5}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Requirements
                  </label>
                  <textarea
                    value={editedJD?.requirements || ''}
                    onChange={(e) => setEditedJD(prev => prev ? { ...prev, requirements: e.target.value } : null)}
                    rows={5}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Skills Required
                  </label>
                  <input
                    type="text"
                    value={editedJD?.skills_required || ''}
                    onChange={(e) => setEditedJD(prev => prev ? { ...prev, skills_required: e.target.value } : null)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Qualifications
                  </label>
                  <textarea
                    value={editedJD?.qualifications || ''}
                    onChange={(e) => setEditedJD(prev => prev ? { ...prev, qualifications: e.target.value } : null)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Benefits
                  </label>
                  <textarea
                    value={editedJD?.benefits || ''}
                    onChange={(e) => setEditedJD(prev => prev ? { ...prev, benefits: e.target.value } : null)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                  />
                </div>
              </div>
            ) : (
              // JD Preview
              <div className="space-y-6">
                <div>
                  <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    {editedJD?.title || generatedJD.title}
                  </h4>
                  <div className="flex flex-wrap gap-2 text-sm">
                    <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
                      {editedJD?.location || generatedJD.location}
                    </span>
                    <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded">
                      {(editedJD?.employment_type || generatedJD.employment_type)?.replace('_', ' ')}
                    </span>
                    <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded">
                      {editedJD?.experience_min || generatedJD.experience_min}-{editedJD?.experience_max || generatedJD.experience_max} yrs
                    </span>
                    <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 rounded">
                      {formatSalary(editedJD?.salary_min || generatedJD.salary_min)} - {formatSalary(editedJD?.salary_max || generatedJD.salary_max)}
                    </span>
                  </div>
                </div>

                <div>
                  <h5 className="font-semibold text-gray-900 dark:text-white mb-2">About the Role</h5>
                  <p className="text-gray-700 dark:text-gray-300 text-sm">
                    {editedJD?.job_description || generatedJD.job_description}
                  </p>
                </div>

                <div>
                  <h5 className="font-semibold text-gray-900 dark:text-white mb-2">Key Responsibilities</h5>
                  <p className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap">
                    • {editedJD?.responsibilities || generatedJD.responsibilities}
                  </p>
                </div>

                <div>
                  <h5 className="font-semibold text-gray-900 dark:text-white mb-2">Requirements</h5>
                  <p className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap">
                    • {editedJD?.requirements || generatedJD.requirements}
                  </p>
                </div>

                <div>
                  <h5 className="font-semibold text-gray-900 dark:text-white mb-2">Skills Required</h5>
                  <div className="flex flex-wrap gap-2">
                    {(editedJD?.skills_required || generatedJD.skills_required)?.split(',').map((skill, i) => (
                      <span key={i} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-sm">
                        {skill.trim()}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <h5 className="font-semibold text-gray-900 dark:text-white mb-2">Qualifications</h5>
                  <p className="text-gray-700 dark:text-gray-300 text-sm">
                    {editedJD?.qualifications || generatedJD.qualifications}
                  </p>
                </div>

                <div>
                  <h5 className="font-semibold text-gray-900 dark:text-white mb-2">What We Offer</h5>
                  <p className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap">
                    • {editedJD?.benefits || generatedJD.benefits}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showExportModal && <ExportModal />}
    </div>
  );
}

// Helper component for extracted fields
function ExtractedField({
  label,
  value,
  icon,
}: {
  label: string;
  value?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg ${value ? 'bg-white dark:bg-gray-800' : 'bg-gray-100 dark:bg-gray-800/50'}`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${value ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400' : 'bg-gray-200 text-gray-400 dark:bg-gray-700'}`}>
        {value ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          icon
        )}
      </div>
      <div className="flex-1">
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        <p className={`text-sm font-medium ${value ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 italic'}`}>
          {value || 'Pending...'}
        </p>
      </div>
    </div>
  );
}
