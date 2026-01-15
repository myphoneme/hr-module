import { useState, useRef, useEffect } from 'react';
import { pdf } from '@react-pdf/renderer';
import { OfferLetterPDF } from './OfferLetterPDF';
import { useDefaultLetterhead } from '../hooks/useLetterheads';
import { useSignatories } from '../hooks/useSignatories';
import { useRAG } from '../hooks/useRAG';
import type { Signatory, RAGDocument } from '../types';
import { getLetterheadWithImages } from '../api/letterheads';

const API_BASE_URL = 'http://localhost:3001/api';

// Mandatory fields that MUST be provided - HR must provide these
const MANDATORY_FIELDS = [
  { key: 'candidate_name', label: 'Candidate Name', example: 'Rahul Sharma' },
  { key: 'candidate_address', label: 'Candidate Address', example: 'Flat 101, ABC Apartments, Sector 62, Noida' },
  { key: 'designation', label: 'Designation', example: 'Software Developer' },
  { key: 'joining_date', label: 'Date of Joining', example: '15th January 2025' },
  { key: 'annual_ctc', label: 'Annual CTC/Salary', example: '6 LPA or 600000' },
] as const;

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  type?: 'text' | 'file' | 'offer-letter' | 'loading' | 'validation-error';
  file?: {
    name: string;
    type: string;
  };
  offerLetter?: any;
  letterContent?: any;
  missingFields?: string[];
}

interface OfferLetterRecord {
  id: number;
  candidate_name: string;
  candidate_address: string;
  designation: string;
  joining_date: string;
  annual_ctc: number;
  salary_breakdown: string;
  working_location: string;
  hr_manager_name: string;
  hr_manager_title: string;
  offer_valid_till: string;
  letter_date: string;
  template_type: string;
  status: string;
  signatory_id: number | null;
  signatory_name?: string;
  signatory_position?: string;
  signatory_signature?: string;
  signatory_stamp?: string;
  letterhead_id?: number;
  creator_name: string;
  createdAt: string;
}

interface PromptOfferLetterGeneratorProps {
  onBack?: () => void;
}

export default function PromptOfferLetterGenerator({ onBack }: PromptOfferLetterGeneratorProps) {
  // View mode: 'list' shows offer letters list, 'create' shows chat interface, 'training' shows reference docs
  const [viewMode, setViewMode] = useState<'list' | 'create' | 'training'>('list');


  // List view state
  const [offerLetters, setOfferLetters] = useState<OfferLetterRecord[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Create view state
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const [_resumeData, _setResumeData] = useState<any>(null); // Renamed
  const [selectedLetterhead, setSelectedLetterhead] = useState<number | null>(null);
  const [selectedSignatory, setSelectedSignatory] = useState<number | null>(null);
  const [selectedSecondarySignatory, setSelectedSecondarySignatory] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Collected candidate details - for tracking partial input
  const [collectedDetails, setCollectedDetails] = useState<Partial<{
    candidate_name: string;
    candidate_address: string;
    designation: string;
    joining_date: string;
    annual_ctc: number;
  }>>({});


  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageIdCounter = useRef(0);

  const { data: defaultLetterhead } = useDefaultLetterhead();
  const { data: signatories = [] } = useSignatories();

  // RAG hooks for reference documents
  const {
    documents: referenceDocuments,
    isLoadingDocuments: isLoadingReferenceDocuments,
    uploadDocument: uploadReferenceDocument,
    deleteDocument: deleteReferenceDocument,
    isUploadingDocument: isUploadingReferenceDoc,
    // stats: ragStats,
  } = useRAG();

  // Get HR and Director signatories
  const hrSignatory = signatories.find((s: Signatory) =>
    s.position.toLowerCase().includes('hr') ||
    s.position.toLowerCase().includes('human resource')
  );
  const directorSignatory = signatories.find((s: Signatory) =>
    s.position.toLowerCase().includes('director') ||
    s.position.toLowerCase().includes('ceo') ||
    s.position.toLowerCase().includes('managing')
  );

  // Auto-select signatories if found
  useEffect(() => {
    if (hrSignatory && !selectedSignatory) {
      setSelectedSignatory(hrSignatory.id);
    }
    if (directorSignatory && !selectedSecondarySignatory) {
      setSelectedSecondarySignatory(directorSignatory.id);
    }
  }, [hrSignatory, directorSignatory]);

  // Load offer letters list
  const loadOfferLetters = async () => {
    setIsLoadingList(true);
    try {
      const response = await fetch(`${API_BASE_URL}/offer-letters`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setOfferLetters(data);
      }
    } catch (error) {
      console.error('Error loading offer letters:', error);
    } finally {
      setIsLoadingList(false);
    }
  };

  // Load on mount and when returning to list
  useEffect(() => {
    if (viewMode === 'list') {
      loadOfferLetters();
    }
  }, [viewMode]);

  // Initialize chat messages
  const initializeChat = () => {
    const refDocsCount = referenceDocuments?.length || 0;
    const hasRefDocs = refDocsCount > 0;

    setMessages([
      {
        id: '1',
        role: 'system',
        content: hasRefDocs
          ? `**Welcome! AI Offer Letter Generator**

**Reference Documents:** ${refDocsCount} uploaded ✓
_I will use these to match your company's exact style, formatting, and tone._

**MANDATORY Details Required:**
1. **Candidate Name** _(e.g., Priya Sharma)_
2. **Candidate Address** _(e.g., Flat 201, Green Park, Delhi)_
3. **Designation** _(e.g., Software Developer)_
4. **Date of Joining** _(e.g., 15th January 2025)_
5. **Annual CTC** _(e.g., 6 LPA or ₹600000)_

**Example:**
_"Create offer letter for Rahul Sharma, address: B-45 Sector 62 Noida, as Senior Developer, joining 1st Feb 2025, CTC 8 LPA"_

Or just start with the candidate name - I'll ask for any missing details.

⚠️ **HR + Director signatures are mandatory** on the last page.`
          : `**Welcome! AI Offer Letter Generator**

⚠️ **No Reference Documents Found**

Please upload at least one reference offer letter first so I can match your company's:
- Letter style and formatting
- Tone and language
- Section structure
- Terms and conditions template

Click **"Reference Documents"** tab to upload sample offer letters.

Once uploaded, come back here to generate new offer letters.`,
        type: 'text',
      },
    ]);
    _setResumeData(null); // Changed setResumeData to _setResumeData
    setInputValue('');
    setCollectedDetails({});
  };

  // Check which mandatory fields are missing
  const getMissingFields = (details: typeof collectedDetails): { key: string; label: string; example: string }[] => {
    return MANDATORY_FIELDS.filter(field => {
      const value = details[field.key as keyof typeof details];
      return !value || (typeof value === 'string' && value.trim() === '');
    });
  };

  // Set default letterhead when loaded
  useEffect(() => {
    if (defaultLetterhead && !selectedLetterhead) {
      setSelectedLetterhead(defaultLetterhead.id);
    }
  }, [defaultLetterhead]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessage = (message: Omit<Message, 'id'>) => {
    messageIdCounter.current += 1;
    const id = `msg-${Date.now()}-${messageIdCounter.current}`;
    setMessages((prev) => [...prev, { ...message, id }]);
    return id;
  };

  const updateMessage = (id: string, updates: Partial<Message>) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === id ? { ...msg, ...updates } : msg))
    );
  };



  // Parse prompt to extract candidate details
  const parsePromptDetails = (text: string): {
    candidateName?: string;
    candidateAddress?: string;
    designation?: string;
    salary?: number;
    joiningDate?: string;
    missing: string[]
  } => {
    const missing: string[] = [];
    let candidateName: string | undefined;
    let candidateAddress: string | undefined;
    let designation: string | undefined;
    let salary: number | undefined;
    let joiningDate: string | undefined;

    // Extract candidate name (look for patterns like "for John Doe", "candidate: John", etc.)
    const namePatterns = [
      /(?:for|candidate[:\s]+|name[:\s]+)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
      /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+),/i,
      /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s+(?:as|for|address)/i,
    ];
    for (const pattern of namePatterns) {
      const match = text.match(pattern);
      if (match) {
        candidateName = match[1].trim();
        break;
      }
    }

    // Extract address (look for patterns like "address: ...", "staying at ...", etc.)
    const addressPatterns = [
      /address[:\s]+(.+?)(?:,\s*(?:as|designation|joining|ctc|salary|doj)|$)/i,
      /(?:residing|staying|living)\s+(?:at\s+)?(.+?)(?:,\s*(?:as|designation|joining|ctc|salary|doj)|$)/i,
      /(?:flat|house|apartment|apt|building|tower|sector|block|plot)\s*(?:no\.?\s*)?[^\n,]*(?:,\s*[^\n,]+){1,4}/i,
    ];
    for (const pattern of addressPatterns) {
      const match = text.match(pattern);
      if (match) {
        candidateAddress = match[1] ? match[1].trim() : match[0].trim();
        break;
      }
    }

    // Extract designation
    const designationPatterns = [
      /(?:designation[:\s]+|as\s+(?:a\s+)?|position[:\s]+|role[:\s]+)([A-Za-z]+(?:\s+[A-Za-z]+)*?)(?:,|\s+salary|\s+ctc|\s+joining|\s+address|\s+\d|$)/i,
      /(?:Trainee\s+)?(?:Software\s+Developer|Senior\s+Developer|Junior\s+Developer|Frontend\s+Developer|Backend\s+Developer|Full\s+Stack\s+Developer|PHP\s+Developer|Java\s+Developer|Python\s+Developer|React\s+Developer|Node\s+Developer|.NET\s+Developer|DevOps\s+Engineer|Data\s+Scientist|Data\s+Analyst|Product\s+Manager|Project\s+Manager|HR\s+Executive|HR\s+Manager|Marketing\s+Manager|Sales\s+Executive|Business\s+Analyst|QA\s+Engineer|Test\s+Engineer|UI\/UX\s+Designer|Graphic\s+Designer|Content\s+Writer|Technical\s+Writer|System\s+Administrator|Network\s+Engineer|Cloud\s+Engineer|Machine\s+Learning\s+Engineer|AI\s+Engineer|Intern|Trainee|Manager|Executive|Engineer|Developer|Analyst|Designer|Lead|Architect)/i,
    ];
    for (const pattern of designationPatterns) {
      const match = text.match(pattern);
      if (match) {
        designation = match[1] ? match[1].trim() : match[0].trim();
        break;
      }
    }

    // Extract salary (LPA, lakhs, per annum)
    const salaryPatterns = [
      /(?:salary[:\s]+|ctc[:\s]+|package[:\s]+)?(\d+(?:\.\d+)?)\s*(?:lpa|lakhs?\s*(?:per\s*annum)?|l\.?p\.?a\.?)/i,
      /(?:salary[:\s]+|ctc[:\s]+|package[:\s]+)(?:rs\.?\s*|inr\s*)?(\d+(?:,\d+)*)/i,
      /(\d+(?:\.\d+)?)\s*(?:lacs?|lakhs?)/i,
    ];
    for (const pattern of salaryPatterns) {
      const match = text.match(pattern);
      if (match) {
        const value = parseFloat(match[1].replace(/,/g, ''));
        // If value is small (< 100), assume it's in lakhs
        salary = value < 100 ? value * 100000 : value;
        break;
      }
    }

    // Extract joining date
    const datePatterns = [
      /(?:joining[:\s]+|join(?:ing)?\s+(?:on\s+)?|doj[:\s]+|date\s+of\s+joining[:\s]+)(\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*(?:,?\s*\d{4})?)/i,
      /(?:joining[:\s]+|join(?:ing)?\s+(?:on\s+)?|doj[:\s]+)(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
      /(\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*,?\s*\d{4})/i,
    ];
    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        joiningDate = match[1].trim();
        break;
      }
    }

    // Check what's missing
    if (!candidateName) missing.push('Candidate Name');
    if (!candidateAddress) missing.push('Candidate Address');
    if (!designation) missing.push('Designation');
    if (!salary) missing.push('Salary (CTC)');
    if (!joiningDate) missing.push('Date of Joining');

    return { candidateName, candidateAddress, designation, salary, joiningDate, missing };
  };

  // Generate standard salary breakdown from annual CTC
  const generateSalaryBreakdown = (annualCtc: number) => {
    const monthly = Math.round(annualCtc / 12);
    const basic = Math.round(monthly * 0.40);
    const hra = Math.round(basic * 0.50);
    const conveyance = 1600;
    const medical = 1250;
    const special = monthly - basic - hra - conveyance - medical;

    return [
      { component: 'Basic Salary', perMonth: basic, annual: basic * 12 },
      { component: 'HRA', perMonth: hra, annual: hra * 12 },
      { component: 'Conveyance Allowance', perMonth: conveyance, annual: conveyance * 12 },
      { component: 'Medical Allowance', perMonth: medical, annual: medical * 12 },
      { component: 'Special Allowance', perMonth: special, annual: special * 12 },
    ];
  };

  const handlePromptSubmit = async () => {
    if (!inputValue.trim() || isProcessing) return;

    const userPrompt = inputValue.trim();
    setInputValue('');

    addMessage({
      role: 'user',
      content: userPrompt,
      type: 'text',
    });

    // Parse the prompt to extract new details
    const parsed = parsePromptDetails(userPrompt);

    // Merge with previously collected details
    const updatedDetails = {
      candidate_name: parsed.candidateName || collectedDetails.candidate_name,
      candidate_address: parsed.candidateAddress || collectedDetails.candidate_address,
      designation: parsed.designation || collectedDetails.designation,
      joining_date: parsed.joiningDate || collectedDetails.joining_date,
      annual_ctc: parsed.salary || collectedDetails.annual_ctc,
    };

    setCollectedDetails(updatedDetails);

    // Check what's still missing
    const missingFields = getMissingFields(updatedDetails);

    if (missingFields.length > 0) {
      // Build response showing what we have and what's missing
      const capturedFields = MANDATORY_FIELDS
        .filter(f => !missingFields.some(m => m.key === f.key))
        .map(f => {
          const value = updatedDetails[f.key as keyof typeof updatedDetails];
          if (f.key === 'annual_ctc' && typeof value === 'number') {
            return `✓ **${f.label}:** ₹${value.toLocaleString('en-IN')} (${(value / 100000).toFixed(2)} LPA)`;
          }
          return `✓ **${f.label}:** ${value}`;
        });

      const missingList = missingFields.map(f =>
        `❌ **${f.label}** _(e.g., "${f.example}")_`
      );

      let responseContent = '';
      if (capturedFields.length > 0) {
        responseContent += `**Captured Details:**\n${capturedFields.join('\n')}\n\n`;
      }
      responseContent += `**Still Required:**\n${missingList.join('\n')}`;

      // If address is missing, add a specific prompt
      if (missingFields.some(f => f.key === 'candidate_address')) {
        responseContent += `\n\n⚠️ **Please enter the candidate's full address** - this is mandatory for the offer letter.`;
      }

      addMessage({
        role: 'assistant',
        content: responseContent,
        type: 'validation-error',
        missingFields: missingFields.map(f => f.key),
      });
      return;
    }

    // All mandatory fields are present - check for reference documents
    const refDocsCount = referenceDocuments?.length || 0;
    if (refDocsCount === 0) {
      addMessage({
        role: 'assistant',
        content: `⚠️ **No Reference Documents**

I have all the details, but no reference offer letters are uploaded.
Please upload at least one reference offer letter in the **"Reference Documents"** tab first.

This ensures I can match your company's:
- Exact letter formatting and style
- Tone and language
- Section structure
- Terms and conditions`,
        type: 'text',
      });
      return;
    }

    // Check for mandatory signatories
    if (!selectedSignatory || !selectedSecondarySignatory) {
      addMessage({
        role: 'assistant',
        content: `⚠️ **Missing Signatories**

Both HR Manager and Director signatures are **mandatory** for offer letters.

${!selectedSignatory ? '❌ HR Signatory not selected' : '✓ HR Signatory selected'}
${!selectedSecondarySignatory ? '❌ Director Signatory not selected' : '✓ Director Signatory selected'}

Please configure signatories in the Settings panel or in Signatories section.`,
        type: 'text',
      });
      return;
    }

    const loadingId = addMessage({
      role: 'assistant',
      content: 'Generating offer letter using reference template...',
      type: 'loading',
    });

    setIsProcessing(true);

    try {
      // Generate offer letter data from collected details
      const today = new Date();
      const offerValidDate = new Date(today);
      offerValidDate.setDate(today.getDate() + 7);

      const salaryBreakdown = generateSalaryBreakdown(updatedDetails.annual_ctc!);

      // Determine template type based on designation
      const designation = updatedDetails.designation!.toLowerCase();
      let templateType: 'short' | 'long' | 'internship' = 'long';
      if (designation.includes('trainee') || designation.includes('junior') || designation.includes('intern')) {
        templateType = designation.includes('intern') ? 'internship' : 'short';
      }

      const offerLetterData = {
        candidate_name: updatedDetails.candidate_name!,
        candidate_address: updatedDetails.candidate_address!,
        designation: updatedDetails.designation!,
        joining_date: updatedDetails.joining_date!,
        annual_ctc: updatedDetails.annual_ctc!,
        offer_valid_till: offerValidDate.toISOString().split('T')[0],
        letter_date: today.toISOString().split('T')[0],
        working_location: 'Phoneme Solutions Pvt Ltd, Advant Navis Business Park, B-614 Sector 142, Noida-201307',
        hr_manager_name: 'Deepika',
        hr_manager_title: 'Manager-Human Resource',
        template_type: templateType,
        salary_breakdown: salaryBreakdown,
        signatory_id: selectedSignatory,
        secondary_signatory_id: selectedSecondarySignatory,
      };

      // Fetch HR signatory details
      let signatoryData = null;
      if (selectedSignatory && signatories) {
        signatoryData = signatories.find((s: Signatory) => s.id === selectedSignatory);
      }

      // Fetch Director/Secondary signatory details
      let secondarySignatoryData = null;
      if (selectedSecondarySignatory && signatories) {
        secondarySignatoryData = signatories.find((s: Signatory) => s.id === selectedSecondarySignatory);
      }

      // Fetch letterhead
      let letterheadData = null;
      if (selectedLetterhead) {
        try {
          letterheadData = await getLetterheadWithImages(selectedLetterhead);
        } catch (e) {
          console.error('Error fetching letterhead:', e);
        }
      }
      if (!letterheadData) {
        try {
          const response = await fetch(`${API_BASE_URL}/letterheads/default/active`, {
            credentials: 'include',
          });
          if (response.ok) {
            letterheadData = await response.json();
          }
        } catch (e) {
          console.error('Error fetching default letterhead:', e);
        }
      }

      // Build letter content for PDF with all required fields for the template
      const formattedDate = today.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
      const formattedOfferValidDate = offerValidDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
      const formattedSalary = updatedDetails.annual_ctc?.toLocaleString('en-IN');
      const candidateFirstName = updatedDetails.candidate_name?.split(' ')[0];

      const letterContent = {
        templateType: templateType,
        header: 'OFFER LETTER',
        to: updatedDetails.candidate_name,
        address: updatedDetails.candidate_address,
        date: formattedDate,
        subject: `Offer for the post of ${updatedDetails.designation}`,
        body: {
          greeting: `Dear ${candidateFirstName},`,
          congratulations: 'Congratulations!',
          opening: `This is with reference to your application and subsequent interview held with Phoneme Solution Pvt. Ltd. We are pleased to offer you as "${updatedDetails.designation}" in our organization on the following terms and conditions.`,
          commencement: `Commencement of employment: Your joining date is ${updatedDetails.joining_date}.`,
          remuneration: `Remuneration: Your total annual compensation would be in INR ${formattedSalary}/- per annum. CTC Breakup is at Annexure A.`,
          salaryNote: 'Please note that the salary structure of the company may be altered/modified at any time with notice and your remuneration package may accordingly be altered/modified from time to time.',
          workingHours: 'Working Hours: Your working hours will be 9:00 am to 06:00 pm. As per the current company policy you need to complete 9 hours in a day, company observes a 5-day work week and all Saturday and Sunday will be full day week off.',
          probation: 'Probation/Confirmation: You will be on a Probation period for Six months. Based on your performance your services will be confirmed with the company in written after six months.',
          leave: "Leave: You will be entitled for the benefits of leaves as per the company's leave policy after successful completion of your probation period.",
          notice: "Notice Period: This appointment may be terminated by either side by giving Thirty days' notice or one months' salary in lieu of notice period.",
          general: {
            title: 'General:',
            points: [
              "You will be governed by the company's rules and regulations (as well as practices) as enforced from time to time.",
              'If you remain absent for more than three days without any information or beyond the period of leave originally granted or subsequently extended, you shall be considered as abscond.',
              'Your services are transferable at short notice, to any group company.',
            ]
          },
          confidentiality: {
            title: 'Confidentiality:',
            text: 'During your employment with the company and thereafter you will, at all times, hold in strictest confidence, and not use, except for the benefit of the company, any confidential information of the company or related corporations, clients, etc.'
          },
          conflictOfInterest: {
            title: 'Conflict of Interest:',
            points: [
              'During the period of your employment with the Company, you will devote full time to the work of the Company.',
              'You will not accept any present, commission or any sort of gratification in cash or kind from any person, party or firm.',
              'If at any time you are found non-performer or guilty of misconduct, your services may be terminated without notice.',
            ]
          },
          termination: {
            title: 'Termination:',
            text: 'The Company reserves the right to terminate your employment without any notice period or termination payment, if it has reasonable ground to believe you are guilty of misconduct or negligence.',
            nonCompete: 'You shall not be engaged in any type of business/commercial association with any of company\'s competitors for a period of two years from the date of your leaving the services of the company.'
          },
          acceptance: `If the terms and conditions offered herein are acceptable to you, please return the acceptance copy duly signed on or before ${formattedOfferValidDate} else this offer will automatically be cancelled.`,
          closing: 'We welcome you to the Phoneme family and wish you a successful career with us.'
        },
        signature: {
          regards: 'Regards,',
          company: 'For Phoneme Solutions Private Limited.',
          name: signatoryData?.name || 'Deepika',
          title: signatoryData?.position || 'Manager-Human Resource',
        },
        signatory: signatoryData ? {
          name: signatoryData.name,
          position: signatoryData.position,
          signature: signatoryData.signatureImage,
          stamp: signatoryData.stampImage,
        } : null,
        secondarySignatory: secondarySignatoryData ? {
          name: secondarySignatoryData.name,
          position: secondarySignatoryData.position,
          signature: secondarySignatoryData.signatureImage,
          stamp: secondarySignatoryData.stampImage,
        } : null,
        annexure: {
          title: 'Annexure A',
          subtitle: 'Salary Break Up',
          table: salaryBreakdown,
          total: {
            perMonth: salaryBreakdown.reduce((sum, item) => sum + item.perMonth, 0),
            annual: salaryBreakdown.reduce((sum, item) => sum + item.annual, 0),
          }
        },
        letterhead: letterheadData,
        designation: updatedDetails.designation,
        joining_date: updatedDetails.joining_date,
        working_location: offerLetterData.working_location,
        hr_manager_name: signatoryData?.name || 'Deepika',
        hr_manager_title: signatoryData?.position || 'Manager-Human Resource',
        salary_breakdown: salaryBreakdown,
        annual_ctc: updatedDetails.annual_ctc,
        offer_valid_till: formattedOfferValidDate,
      };

      const hrSignatoryDisplay = signatoryData
        ? `${signatoryData.name} (${signatoryData.position})`
        : 'Not set';
      const directorSignatoryDisplay = secondarySignatoryData
        ? `${secondarySignatoryData.name} (${secondarySignatoryData.position})`
        : 'Not set';

      updateMessage(loadingId, {
        content: `**✅ Offer Letter Generated Successfully!**

**Candidate Details:**
- **Name:** ${updatedDetails.candidate_name}
- **Address:** ${updatedDetails.candidate_address}
- **Designation:** ${updatedDetails.designation}
- **Annual CTC:** ₹${formattedSalary} (${(updatedDetails.annual_ctc! / 100000).toFixed(2)} LPA)
- **Joining Date:** ${updatedDetails.joining_date}
- **Template:** ${templateType === 'short' ? 'Short Form (Trainee/Junior)' : templateType === 'internship' ? 'Internship' : 'Long Form'}

**Signatures:**
- **HR:** ${hrSignatoryDisplay}
- **Director:** ${directorSignatoryDisplay}

📎 Reference documents used: ${referenceDocuments?.length || 0}

Click **"Download PDF"** to get the offer letter, or **"Save"** to store it in the system.`,
        type: 'offer-letter',
        offerLetter: offerLetterData,
        letterContent: letterContent,
      });

      // Reset collected details for next letter
      setCollectedDetails({});
    } catch (error: any) {
      updateMessage(loadingId, {
        content: `Error: ${error.message}`,
        type: 'text',
      });
    } finally {
      setIsProcessing(false);
    }
  };



  const handleDownloadPDF = async (letterContent: any) => {
    try {
      const blob = await pdf(<OfferLetterPDF letterContent={letterContent} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Offer_Letter_${letterContent.to?.replace(/\s+/g, '_') || 'Candidate'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF');
    }
  };

  // Build letter content from saved database record
  const buildLetterContentFromSaved = async (savedLetter: OfferLetterRecord) => {
    let letterheadData = null;
    if (savedLetter.letterhead_id) {
      try {
        letterheadData = await getLetterheadWithImages(savedLetter.letterhead_id);
      } catch (e) {
        console.error('Error fetching letterhead:', e);
      }
    }
    if (!letterheadData) {
      try {
        const response = await fetch(`${API_BASE_URL}/letterheads/default/active`, { credentials: 'include' });
        if (response.ok) letterheadData = await response.json();
      } catch (e) { /* ignore */ }
    }

    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const day = date.getDate();
      const suffix = day === 1 || day === 21 || day === 31 ? 'st' : day === 2 || day === 22 ? 'nd' : day === 3 || day === 23 ? 'rd' : 'th';
      return `${months[date.getMonth()]} ${day}${suffix}, ${date.getFullYear()}`;
    };

    const salaryBreakdown = typeof savedLetter.salary_breakdown === 'string'
      ? JSON.parse(savedLetter.salary_breakdown)
      : savedLetter.salary_breakdown || [];

    // Fetch signatory images if we have signatory info
    let signatorySignatureBase64 = null;
    let signatoryStampBase64 = null;
    if (savedLetter.signatory_id) {
      try {
        const sigResponse = await fetch(`${API_BASE_URL}/signatories/${savedLetter.signatory_id}`, { credentials: 'include' });
        if (sigResponse.ok) {
          const sigData = await sigResponse.json();
          signatorySignatureBase64 = sigData.signature_image_base64;
          signatoryStampBase64 = sigData.stamp_image_base64;
        }
      } catch (e) { /* ignore */ }
    }

    return {
      templateType: savedLetter.template_type || 'long',
      optionalSections: [],
      header: 'OFFER LETTER',
      date: formatDate(savedLetter.letter_date),
      to: savedLetter.candidate_name,
      address: savedLetter.candidate_address,
      subject: `Offer for the post of ${savedLetter.designation}`,
      signatory: savedLetter.signatory_name ? {
        name: savedLetter.signatory_name,
        position: savedLetter.signatory_position,
        signature: signatorySignatureBase64,
        stamp: signatoryStampBase64,
      } : null,
      letterhead: letterheadData,
      body: {
        greeting: `Dear ${savedLetter.candidate_name.split(' ')[0]},`,
        congratulations: 'Congratulations!',
        opening: `This is with reference to your application and subsequent interview held with Phoneme Solution Pvt. Ltd. We are pleased to offer you as "${savedLetter.designation}" in our organization on the following terms and conditions.`,
        commencement: `Commencement of employment: Your joining date is ${formatDate(savedLetter.joining_date)}.`,
        remuneration: `Remuneration: Your total annual compensation would be in INR ${savedLetter.annual_ctc?.toLocaleString('en-IN')}/- per annum. CTC Breakup is at Annexure A.`,
        salaryNote: `Please note that the salary structure of the company may be altered/modified at any time with notice.`,
        workingHours: `Working Hours: Your working hours will be 9:00 am to 06:00 pm. You need to complete 9 hours in a day, company observes a 5-day work week.`,
        probation: `Probation/Confirmation: You will be on a Probation period for Six months.`,
        leave: `Leave: You will be entitled for the benefits of leaves as per the company's leave policy after successful completion of your probation period.`,
        notice: `Notice Period: This appointment may be terminated by either side by giving Thirty days' notice.`,
        general: { title: 'General:', points: ['You will be governed by the company\'s rules and regulations.', 'If you remain absent for more than three days without any information, you shall be considered as absconded.'] },
        confidentiality: { title: 'Confidentiality:', text: 'During your employment with the company and thereafter you will hold in strictest confidence all confidential information.' },
        conflictOfInterest: { title: 'Conflict of Interest:', points: ['You will devote full time to the work of the Company.', 'You will not accept any present, commission or gratification from any party.'] },
        termination: { title: 'Termination:', text: 'The Company reserves the right to terminate your employment without notice for misconduct.', nonCompete: '' },
        acceptance: `Please return the acceptance copy duly signed on or before ${formatDate(savedLetter.offer_valid_till)}.`,
        closing: 'We welcome you to the Phoneme family and wish you a successful career with us.'
      },
      signature: {
        regards: 'Regards,',
        company: 'For Phoneme Solutions Private Limited.',
        name: savedLetter.hr_manager_name,
        title: savedLetter.hr_manager_title
      },
      annexure: {
        title: 'Annexure A',
        subtitle: 'Salary Break Up',
        table: salaryBreakdown,
        total: {
          perMonth: salaryBreakdown.reduce((sum: number, item: any) => sum + (item.perMonth || 0), 0),
          annual: salaryBreakdown.reduce((sum: number, item: any) => sum + (item.annual || 0), 0)
        }
      }
    };
  };

  const handleSaveOfferLetter = async (offerLetterData: any, letterContent: any) => {
    try {
      const signatoryId = offerLetterData.signatory_id || letterContent?.signatory?.id || selectedSignatory;
      const letterheadId = offerLetterData.letterhead_id || letterContent?.letterhead?.id || selectedLetterhead;

      const response = await fetch(`${API_BASE_URL}/offer-letters`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_name: offerLetterData.candidate_name,
          candidate_address: offerLetterData.candidate_address,
          designation: offerLetterData.designation,
          joining_date: offerLetterData.joining_date,
          annual_ctc: offerLetterData.annual_ctc,
          salary_breakdown: offerLetterData.salary_breakdown || [],
          working_location: offerLetterData.working_location,
          hr_manager_name: offerLetterData.hr_manager_name,
          hr_manager_title: offerLetterData.hr_manager_title,
          offer_valid_till: offerLetterData.offer_valid_till,
          letter_date: offerLetterData.letter_date,
          template_type: offerLetterData.template_type || 'long',
          kra_details: offerLetterData.kra_details || [],
          signatory_id: signatoryId,
          letterhead_id: letterheadId,
          status: 'draft',
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Save failed' }));
        throw new Error(error.error || 'Failed to save offer letter');
      }

      const savedData = await response.json();

      addMessage({
        role: 'assistant',
        content: `Offer letter saved successfully! ID: **#${savedData.id}**

You can view it in the offer letters list.`,
        type: 'text',
      });
    } catch (error: any) {
      addMessage({
        role: 'assistant',
        content: `Error saving: ${error.message}`,
        type: 'text',
      });
    }
  };

  const handleDeleteOfferLetter = async (id: number, candidateName: string) => {
    if (!confirm(`Delete offer letter for ${candidateName}?`)) return;

    try {
      const response = await fetch(`${API_BASE_URL}/offer-letters/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (response.ok) {
        loadOfferLetters();
      } else {
        alert('Failed to delete offer letter');
      }
    } catch (error) {
      console.error('Error deleting:', error);
      alert('Failed to delete offer letter');
    }
  };

  const handleUpdateStatus = async (id: number, status: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/offer-letters/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (response.ok) {
        loadOfferLetters();
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  // Filter offer letters
  const filteredOfferLetters = offerLetters.filter((letter) => {
    const matchesSearch =
      letter.candidate_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      letter.designation.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || letter.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Start create mode
  const startCreateMode = () => {
    setViewMode('create');
    initializeChat();

  };

  // Handle reference document upload
  const handleReferenceDocUpload = async (file: File) => {
    if (!file || file.type !== 'application/pdf') {
      alert('Please upload a PDF file');
      return;
    }
    try {
      await uploadReferenceDocument(file);
    } catch (error: any) {
      alert(`Failed to upload: ${error.message}`);
    }
  };

  // ==================== RENDER ====================

  // TRAINING/REFERENCE DOCUMENTS VIEW
  if (viewMode === 'training') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {onBack && (
                <button
                  onClick={onBack}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  <svg className="w-6 h-6 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Reference Documents</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Upload offer letters to use as templates</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-4 flex gap-2 border-b dark:border-gray-700 -mb-px">
            <button
              onClick={() => setViewMode('list')}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border-b-2 border-transparent"
            >
              Offer Letters
            </button>
            <button
              onClick={() => setViewMode('training')}
              className="px-4 py-2 text-orange-600 dark:text-orange-400 font-medium border-b-2 border-orange-600 dark:border-orange-400"
            >
              Reference Documents ({referenceDocuments?.length || 0})
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-w-4xl mx-auto">
          {/* Info Card */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6">
            <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">How Reference Documents Work</h3>
            <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <li>• Upload your company's existing offer letters as PDF</li>
              <li>• AI will learn your company's style, tone, and formatting</li>
              <li>• New letters will match the exact structure and wording</li>
              <li>• Header, footer, logo, and signature styles will be preserved</li>
            </ul>
          </div>

          {/* Upload Zone */}
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center mb-6 transition-colors ${
              isUploadingReferenceDoc
                ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20'
                : 'border-gray-300 dark:border-gray-600 hover:border-orange-400 dark:hover:border-orange-500 bg-white dark:bg-gray-800'
            }`}
          >
            {isUploadingReferenceDoc ? (
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-gray-600 dark:text-gray-300">Uploading and processing...</p>
              </div>
            ) : (
              <>
                <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Upload Reference Offer Letter</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">PDF files only • These become your templates</p>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => e.target.files?.[0] && handleReferenceDocUpload(e.target.files[0])}
                  className="hidden"
                  id="ref-doc-upload"
                />
                <label
                  htmlFor="ref-doc-upload"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-lg cursor-pointer"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Select PDF File
                </label>
              </>
            )}
          </div>

          {/* Uploaded Documents List */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-3 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <h3 className="font-medium text-gray-900 dark:text-white">Uploaded Reference Documents</h3>
            </div>

            {isLoadingReferenceDocuments ? (
              <div className="p-8 text-center">
                <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              </div>
            ) : referenceDocuments?.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-gray-500 dark:text-gray-400">No reference documents uploaded yet</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Upload at least one offer letter to get started</p>
              </div>
            ) : (
              <div className="divide-y dark:divide-gray-700">
                {referenceDocuments?.map((doc: RAGDocument) => (
                  <div key={doc.id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{doc.filename}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Uploaded {new Date(doc.createdAt).toLocaleDateString('en-IN')}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (confirm(`Delete "${doc.filename}"?`)) {
                          deleteReferenceDocument(doc.id);
                        }
                      }}
                      className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Button */}
          {(referenceDocuments?.length || 0) > 0 && (
            <div className="mt-6 text-center">
              <button
                onClick={startCreateMode}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg inline-flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Start Creating Offer Letters
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // LIST VIEW
  if (viewMode === 'list') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {onBack && (
                <button
                  onClick={onBack}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  <svg className="w-6 h-6 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Offer Letter Generator</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {referenceDocuments?.length || 0} reference document(s) • Create letters matching your company style
                </p>
              </div>
            </div>

            <button
              onClick={startCreateMode}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Offer Letter
            </button>
          </div>

          {/* Tabs */}
          <div className="mt-4 flex gap-2 border-b dark:border-gray-700 -mb-px">
            <button
              onClick={() => setViewMode('list')}
              className="px-4 py-2 text-orange-600 dark:text-orange-400 font-medium border-b-2 border-orange-600 dark:border-orange-400"
            >
              Offer Letters
            </button>
            <button
              onClick={() => setViewMode('training')}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border-b-2 border-transparent flex items-center gap-2"
            >
              Reference Documents
              {(referenceDocuments?.length || 0) === 0 && (
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
              )}
            </button>
          </div>

          {/* Filters */}
          <div className="mt-4 flex gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by candidate name or designation..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="approved">Approved</option>
              <option value="sent">Sent</option>
            </select>
          </div>
        </div>

        {/* Offer Letters Table */}
        <div className="p-6">
          {isLoadingList ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-600"></div>
            </div>
          ) : filteredOfferLetters.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Offer Letters Found</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                {searchTerm || statusFilter !== 'all'
                  ? 'Try adjusting your search or filter criteria'
                  : 'Get started by creating your first offer letter'}
              </p>
              {!searchTerm && statusFilter === 'all' && (
                <button
                  onClick={startCreateMode}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                >
                  Create Offer Letter
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Letter Info
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Recipient
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Subject
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredOfferLetters.map((letter) => (
                    <tr key={letter.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">#{letter.id}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{letter.candidate_name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{letter.candidate_name}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{letter.candidate_address?.substring(0, 30)}...</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 dark:text-white">{letter.designation}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">₹{letter.annual_ctc?.toLocaleString('en-IN')} / year</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {new Date(letter.letter_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          letter.status === 'approved'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : letter.status === 'sent'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                        }`}>
                          {letter.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={async () => {
                              const content = await buildLetterContentFromSaved(letter);
                              // Show in a modal or new view
                              handleDownloadPDF(content);
                            }}
                            className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
                          >
                            View
                          </button>
                          <button
                            onClick={async () => {
                              const content = await buildLetterContentFromSaved(letter);
                              handleDownloadPDF(content);
                            }}
                            className="text-sm text-orange-600 hover:text-orange-800 dark:text-orange-400"
                          >
                            Download
                          </button>
                          <button
                            onClick={() => {
                              // For now, just show alert - full edit would need a form
                              alert('Edit feature: Coming soon! Currently you can delete and recreate.');
                            }}
                            className="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400"
                          >
                            Edit
                          </button>
                          {letter.status === 'draft' && (
                            <button
                              onClick={() => handleUpdateStatus(letter.id, 'approved')}
                              className="text-sm text-green-600 hover:text-green-800 dark:text-green-400"
                            >
                              Finalize
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteOfferLetter(letter.id, letter.candidate_name)}
                            className="text-sm text-red-600 hover:text-red-800 dark:text-red-400"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // CREATE VIEW (Chat Interface)
  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-b dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setViewMode('list')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <svg className="w-6 h-6 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Create Offer Letter</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Upload resume + describe offer in plain English</p>
            </div>
          </div>

          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`px-4 py-2 text-sm rounded-lg flex items-center gap-2 ${
              showSettings
                ? 'bg-orange-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </button>
        </div>

        {/* Settings Panel - Only show available signatories */}
        {showSettings && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Available Signatories (mention by name or position in prompt)
              </label>
              {signatories.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {signatories.map((s: Signatory) => (
                    <span key={s.id} className="px-2 py-1 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded text-sm">
                      {s.name} ({s.position})
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500">
                  No signatories configured. Add them in Signatories menu.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-orange-600 text-white'
                    : message.role === 'system'
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100 border border-blue-200 dark:border-blue-800'
                    : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm border dark:border-gray-700'
                }`}
              >
                {message.type === 'loading' ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600"></div>
                    <span>{message.content}</span>
                  </div>
                ) : message.type === 'file' ? (
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>{message.content}</span>
                  </div>
                ) : message.type === 'offer-letter' ? (
                  <div>
                    <div className="whitespace-pre-wrap mb-4">{message.content}</div>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => handleDownloadPDF(message.letterContent)}
                        className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Download PDF
                      </button>
                      <button
                        onClick={() => handleSaveOfferLetter(message.offerLetter, message.letterContent)}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Save to System
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap">{message.content}</div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-t dark:border-gray-700 px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-3">
            {/* Text Input */}
            <div className="flex-1 relative">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handlePromptSubmit()}
                placeholder="Type: Name, Designation, Salary (LPA), Joining Date..."
                disabled={isProcessing}
                className="w-full px-4 py-3 pr-12 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:opacity-50"
              />
            </div>

            {/* Send Button */}
            <button
              onClick={handlePromptSubmit}
              disabled={isProcessing || !inputValue.trim()}
              className="p-3 bg-orange-600 text-white rounded-xl hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
